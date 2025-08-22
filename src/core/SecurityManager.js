const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const chalk = require('chalk');

/**
 * 安全更新管理器
 * 负责更新文件的签名验证、回滚机制和安全检查
 */
class SecurityManager {
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(require('os').homedir(), '.cc-config');
    this.securityDir = path.join(this.configDir, '.security');
    this.checksumFile = path.join(this.securityDir, 'checksums.json');
    this.signatureFile = path.join(this.securityDir, 'signatures.json');
    this.rollbackDir = path.join(this.configDir, '.rollback');
    
    // 安全配置
    this.trustedKeys = options.trustedKeys || [
      // Anthropic 官方公钥 (示例)
      '-----BEGIN PUBLIC KEY-----\n' +
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n' +
      '-----END PUBLIC KEY-----'
    ];
    
    this.maxDownloadSize = options.maxDownloadSize || 50 * 1024 * 1024; // 50MB
    this.allowedDomains = options.allowedDomains || [
      'raw.githubusercontent.com',
      'github.com'
    ];
    
    this.securityPolicies = {
      requireSignature: options.requireSignature !== false,
      requireChecksum: options.requireChecksum !== false,
      allowUnsignedUpdates: options.allowUnsignedUpdates === true,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000
    };
  }

  /**
   * 初始化安全管理器
   */
  async initialize() {
    try {
      await fs.ensureDir(this.securityDir);
      await fs.ensureDir(this.rollbackDir);
      
      // 设置安全目录权限
      await fs.chmod(this.securityDir, 0o700);
      await fs.chmod(this.rollbackDir, 0o700);
      
      // 初始化安全文件
      if (!await fs.pathExists(this.checksumFile)) {
        await this.writeChecksums({});
      }
      
      if (!await fs.pathExists(this.signatureFile)) {
        await this.writeSignatures({});
      }
      
      return true;
    } catch (error) {
      throw new Error(`安全管理器初始化失败: ${error.message}`);
    }
  }

  /**
   * 验证更新文件的安全性
   */
  async verifyUpdateSecurity(filePath, options = {}) {
    try {
      const {
        expectedChecksum = null,
        signature = null,
        allowUnsigned = this.securityPolicies.allowUnsignedUpdates
      } = options;

      const results = {
        valid: false,
        checks: {
          fileExists: false,
          sizeValid: false,
          checksumValid: false,
          signatureValid: false,
          domainTrusted: false
        },
        errors: []
      };

      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        results.errors.push('文件不存在');
        return results;
      }
      results.checks.fileExists = true;

      // 检查文件大小
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxDownloadSize) {
        results.errors.push(`文件过大: ${stats.size} > ${this.maxDownloadSize}`);
        return results;
      }
      results.checks.sizeValid = true;

      // 验证校验和
      if (expectedChecksum) {
        const actualChecksum = await this.calculateFileChecksum(filePath);
        if (actualChecksum !== expectedChecksum) {
          results.errors.push('文件校验和不匹配');
          return results;
        }
        results.checks.checksumValid = true;
      } else if (this.securityPolicies.requireChecksum) {
        results.errors.push('缺少必需的校验和');
        return results;
      }

      // 验证数字签名
      if (signature) {
        const signatureValid = await this.verifyFileSignature(filePath, signature);
        if (!signatureValid) {
          results.errors.push('数字签名验证失败');
          if (!allowUnsigned) {
            return results;
          }
        } else {
          results.checks.signatureValid = true;
        }
      } else if (this.securityPolicies.requireSignature && !allowUnsigned) {
        results.errors.push('缺少必需的数字签名');
        return results;
      }

      // 所有检查通过
      results.valid = results.errors.length === 0;
      return results;
    } catch (error) {
      throw new Error(`安全验证失败: ${error.message}`);
    }
  }

  /**
   * 验证下载URL的安全性
   */
  async verifyDownloadUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // 检查协议
      if (urlObj.protocol !== 'https:') {
        return {
          valid: false,
          reason: '仅允许HTTPS协议'
        };
      }

      // 检查域名白名单
      if (!this.allowedDomains.includes(urlObj.hostname)) {
        return {
          valid: false,
          reason: `域名不在信任列表中: ${urlObj.hostname}`
        };
      }

      // 检查路径安全性
      if (urlObj.pathname.includes('..') || urlObj.pathname.includes('//')) {
        return {
          valid: false,
          reason: '检测到不安全的路径'
        };
      }

      return {
        valid: true,
        hostname: urlObj.hostname,
        protocol: urlObj.protocol
      };
    } catch (error) {
      return {
        valid: false,
        reason: `无效的URL: ${error.message}`
      };
    }
  }

  /**
   * 安全下载文件
   */
  async secureDownload(url, outputPath, options = {}) {
    try {
      const {
        expectedChecksum = null,
        signature = null,
        maxRetries = this.securityPolicies.maxRetries
      } = options;

      // 验证URL安全性
      const urlCheck = await this.verifyDownloadUrl(url);
      if (!urlCheck.valid) {
        throw new Error(`URL安全检查失败: ${urlCheck.reason}`);
      }

      let lastError;
      
      // 重试下载
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(chalk.gray(`尝试下载 (${attempt}/${maxRetries}): ${url}`));
          
          const tempPath = `${outputPath}.tmp`;
          await this.downloadFile(url, tempPath);

          // 验证下载文件的安全性
          const verification = await this.verifyUpdateSecurity(tempPath, {
            expectedChecksum,
            signature
          });

          if (!verification.valid) {
            await fs.remove(tempPath);
            throw new Error(`安全验证失败: ${verification.errors.join(', ')}`);
          }

          // 原子性移动文件
          await fs.move(tempPath, outputPath);
          
          return {
            success: true,
            size: (await fs.stat(outputPath)).size,
            attempts: attempt,
            verification
          };
        } catch (error) {
          lastError = error;
          console.warn(chalk.yellow(`下载尝试 ${attempt} 失败: ${error.message}`));
          
          if (attempt < maxRetries) {
            // 指数退避
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('下载失败，已达到最大重试次数');
    } catch (error) {
      throw new Error(`安全下载失败: ${error.message}`);
    }
  }

  /**
   * 创建回滚点
   */
  async createRollbackPoint(description = '自动回滚点') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rollbackPath = path.join(this.rollbackDir, timestamp);
      
      await fs.ensureDir(rollbackPath);

      // 保存当前配置状态
      const configFiles = [
        path.join(this.configDir, 'version.json'),
        path.join(this.configDir, 'history.json'),
        this.checksumFile,
        this.signatureFile
      ];

      const rollbackInfo = {
        timestamp,
        description,
        created: new Date().toISOString(),
        files: []
      };

      for (const configFile of configFiles) {
        if (await fs.pathExists(configFile)) {
          const fileName = path.basename(configFile);
          const backupPath = path.join(rollbackPath, fileName);
          
          await fs.copy(configFile, backupPath);
          rollbackInfo.files.push({
            original: configFile,
            backup: backupPath,
            size: (await fs.stat(configFile)).size
          });
        }
      }

      // 保存回滚信息
      const rollbackInfoPath = path.join(rollbackPath, 'rollback-info.json');
      await fs.writeJson(rollbackInfoPath, rollbackInfo, { spaces: 2 });

      return {
        timestamp,
        path: rollbackPath,
        fileCount: rollbackInfo.files.length
      };
    } catch (error) {
      throw new Error(`创建回滚点失败: ${error.message}`);
    }
  }

  /**
   * 执行回滚
   */
  async performRollback(timestamp) {
    try {
      const rollbackPath = path.join(this.rollbackDir, timestamp);
      const rollbackInfoPath = path.join(rollbackPath, 'rollback-info.json');

      if (!await fs.pathExists(rollbackInfoPath)) {
        throw new Error(`回滚点不存在: ${timestamp}`);
      }

      const rollbackInfo = await fs.readJson(rollbackInfoPath);
      
      // 创建当前状态的备份
      const currentBackup = await this.createRollbackPoint('回滚前备份');

      // 恢复文件
      let restoredCount = 0;
      const failures = [];

      for (const fileInfo of rollbackInfo.files) {
        try {
          if (await fs.pathExists(fileInfo.backup)) {
            // 确保目标目录存在
            await fs.ensureDir(path.dirname(fileInfo.original));
            
            // 恢复文件
            await fs.copy(fileInfo.backup, fileInfo.original);
            restoredCount++;
          } else {
            failures.push(`备份文件不存在: ${fileInfo.backup}`);
          }
        } catch (error) {
          failures.push(`恢复文件失败 ${fileInfo.original}: ${error.message}`);
        }
      }

      if (failures.length > 0 && restoredCount === 0) {
        throw new Error(`回滚失败: ${failures.join(', ')}`);
      }

      return {
        success: true,
        restoredFiles: restoredCount,
        failures,
        currentBackup: currentBackup.timestamp,
        rollbackInfo
      };
    } catch (error) {
      throw new Error(`执行回滚失败: ${error.message}`);
    }
  }

  /**
   * 监控更新状态
   */
  async monitorUpdateStatus(updateId, options = {}) {
    try {
      const {
        checkInterval = 5000,
        maxChecks = 60,
        expectedStates = ['downloading', 'verifying', 'installing', 'completed']
      } = options;

      const statusFile = path.join(this.securityDir, `update-${updateId}.status`);
      let checks = 0;

      while (checks < maxChecks) {
        if (await fs.pathExists(statusFile)) {
          const status = await fs.readJson(statusFile);
          
          // 检查状态
          if (status.state === 'completed') {
            return {
              success: true,
              finalStatus: status,
              checks
            };
          } else if (status.state === 'failed') {
            return {
              success: false,
              error: status.error || '更新失败',
              checks
            };
          } else if (status.state === 'timeout') {
            throw new Error('更新超时');
          }

          // 验证状态合法性
          if (!expectedStates.includes(status.state)) {
            throw new Error(`检测到异常状态: ${status.state}`);
          }
        }

        checks++;
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      throw new Error('更新状态监控超时');
    } catch (error) {
      throw new Error(`监控更新状态失败: ${error.message}`);
    }
  }

  /**
   * 网络异常处理
   */
  async handleNetworkError(error, operation) {
    const networkErrors = {
      'ENOTFOUND': '域名解析失败，请检查网络连接',
      'ECONNREFUSED': '连接被拒绝，服务器可能不可用',
      'ECONNRESET': '连接被重置，网络可能不稳定',
      'ETIMEDOUT': '连接超时，网络可能较慢',
      'CERT_HAS_EXPIRED': 'SSL证书已过期',
      'CERT_UNTRUSTED': 'SSL证书不受信任'
    };

    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = networkErrors[errorCode] || error.message;

    const recommendations = [];
    
    if (errorCode === 'ENOTFOUND') {
      recommendations.push('检查网络连接是否正常');
      recommendations.push('尝试使用VPN或更换网络');
    } else if (errorCode.startsWith('CERT_')) {
      recommendations.push('检查系统时间是否正确');
      recommendations.push('更新系统根证书');
    } else if (errorCode === 'ETIMEDOUT') {
      recommendations.push('稍后重试');
      recommendations.push('检查防火墙设置');
    }

    return {
      type: 'network_error',
      code: errorCode,
      message: errorMessage,
      recommendations,
      retryable: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(errorCode),
      operation
    };
  }

  /**
   * 计算文件校验和
   */
  async calculateFileChecksum(filePath) {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      return new Promise((resolve, reject) => {
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`计算校验和失败: ${error.message}`);
    }
  }

  /**
   * 验证文件数字签名
   */
  async verifyFileSignature(filePath, signature) {
    try {
      // 简化的签名验证实现
      // 在实际生产环境中，这里应该使用真正的数字签名验证
      const fileHash = await this.calculateFileChecksum(filePath);
      
      // 模拟签名验证逻辑
      for (const trustedKey of this.trustedKeys) {
        try {
          // 这里应该是真正的RSA/ECDSA签名验证
          // 当前实现仅作为示例
          if (signature.includes(fileHash.substring(0, 16))) {
            return true;
          }
        } catch (error) {
          continue;
        }
      }
      
      return false;
    } catch (error) {
      throw new Error(`签名验证失败: ${error.message}`);
    }
  }

  /**
   * 下载文件的底层实现
   */
  async downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        // 检查内容长度
        const contentLength = parseInt(res.headers['content-length'] || '0');
        if (contentLength > this.maxDownloadSize) {
          reject(new Error(`文件过大: ${contentLength} > ${this.maxDownloadSize}`));
          return;
        }

        const writeStream = fs.createWriteStream(outputPath);
        let downloadedBytes = 0;

        res.on('data', chunk => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > this.maxDownloadSize) {
            writeStream.destroy();
            reject(new Error('下载文件过大'));
            return;
          }
        });

        res.pipe(writeStream);

        writeStream.on('finish', () => {
          writeStream.close();
          resolve();
        });

        writeStream.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(this.securityPolicies.timeout, () => {
        req.destroy();
        reject(new Error('下载超时'));
      });
    });
  }

  /**
   * 读取校验和文件
   */
  async readChecksums() {
    try {
      if (!await fs.pathExists(this.checksumFile)) {
        return {};
      }
      return await fs.readJson(this.checksumFile);
    } catch (error) {
      return {};
    }
  }

  /**
   * 写入校验和文件
   */
  async writeChecksums(checksums) {
    try {
      await fs.writeJson(this.checksumFile, checksums, { spaces: 2 });
      await fs.chmod(this.checksumFile, 0o600);
    } catch (error) {
      throw new Error(`写入校验和失败: ${error.message}`);
    }
  }

  /**
   * 读取签名文件
   */
  async readSignatures() {
    try {
      if (!await fs.pathExists(this.signatureFile)) {
        return {};
      }
      return await fs.readJson(this.signatureFile);
    } catch (error) {
      return {};
    }
  }

  /**
   * 写入签名文件
   */
  async writeSignatures(signatures) {
    try {
      await fs.writeJson(this.signatureFile, signatures, { spaces: 2 });
      await fs.chmod(this.signatureFile, 0o600);
    } catch (error) {
      throw new Error(`写入签名失败: ${error.message}`);
    }
  }

  /**
   * 清理旧的回滚点
   */
  async cleanupRollbackPoints(keepCount = 10) {
    try {
      const rollbackPoints = await fs.readdir(this.rollbackDir);
      
      if (rollbackPoints.length <= keepCount) {
        return { cleaned: 0, kept: rollbackPoints.length };
      }

      // 按时间排序，保留最新的
      rollbackPoints.sort((a, b) => b.localeCompare(a));
      const toDelete = rollbackPoints.slice(keepCount);

      let cleaned = 0;
      for (const point of toDelete) {
        try {
          await fs.remove(path.join(this.rollbackDir, point));
          cleaned++;
        } catch (error) {
          console.warn(chalk.yellow(`清理回滚点失败 ${point}: ${error.message}`));
        }
      }

      return { cleaned, kept: rollbackPoints.length - cleaned };
    } catch (error) {
      throw new Error(`清理回滚点失败: ${error.message}`);
    }
  }
}

module.exports = SecurityManager;