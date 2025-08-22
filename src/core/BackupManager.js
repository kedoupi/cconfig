const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * 增强的备份管理系统
 * 提供完整的备份生命周期管理功能
 */
class BackupManager {
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(os.homedir(), '.cc-config');
    this.backupDir = path.join(this.configDir, 'backups');
    this.historyFile = path.join(this.configDir, 'history.json');
    this.claudeDir = path.join(os.homedir(), '.claude');
    
    // 备份配置
    this.maxBackups = options.maxBackups || 20;
    this.maxBackupDays = options.maxBackupDays || 90;
    this.compressionEnabled = options.compressionEnabled !== false;
    this.checksumEnabled = options.checksumEnabled !== false;
  }

  /**
   * 创建增强的配置备份
   */
  async createBackup(description = '手动备份', options = {}) {
    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      
      const backupPath = path.join(this.backupDir, timestamp);
      await fs.ensureDir(backupPath);

      const backupInfo = {
        timestamp,
        description,
        created: new Date().toISOString(),
        version: require('../../package.json').version,
        type: options.type || 'manual',
        files: [],
        metadata: {
          hostname: os.hostname(),
          platform: os.platform(),
          nodeVersion: process.version,
          user: os.userInfo().username
        }
      };

      // 备份 Claude 配置目录
      if (await fs.pathExists(this.claudeDir)) {
        const claudeBackupPath = path.join(backupPath, 'claude');
        await fs.copy(this.claudeDir, claudeBackupPath);
        
        // 记录备份的文件
        backupInfo.files.push({
          source: this.claudeDir,
          destination: 'claude',
          size: await this.getDirectorySize(claudeBackupPath),
          checksum: this.checksumEnabled ? await this.calculateChecksum(claudeBackupPath) : null
        });
      }

      // 备份 cc-config 目录（除了 backups 目录本身）
      const ccConfigBackupPath = path.join(backupPath, 'cc-config');
      await fs.ensureDir(ccConfigBackupPath);

      const configItems = await fs.readdir(this.configDir);
      for (const item of configItems) {
        if (item === 'backups') continue; // 跳过备份目录本身
        
        const sourcePath = path.join(this.configDir, item);
        const destPath = path.join(ccConfigBackupPath, item);
        
        await fs.copy(sourcePath, destPath);
        
        backupInfo.files.push({
          source: sourcePath,
          destination: path.join('cc-config', item),
          size: await this.getDirectorySize(destPath),
          checksum: this.checksumEnabled ? await this.calculateChecksum(destPath) : null
        });
      }

      // 计算总大小
      backupInfo.totalSize = await this.getDirectorySize(backupPath);

      // 保存备份元数据
      const metadataPath = path.join(backupPath, 'backup-info.json');
      await fs.writeJson(metadataPath, backupInfo, { spaces: 2 });

      // 可选压缩
      if (options.compress || this.compressionEnabled) {
        await this.compressBackup(timestamp);
      }

      // 更新历史记录
      await this.updateHistory(backupInfo);

      // 自动清理旧备份
      if (options.autoClean !== false) {
        await this.autoCleanBackups();
      }

      return {
        timestamp,
        size: backupInfo.totalSize,
        fileCount: backupInfo.files.length,
        compressed: options.compress || this.compressionEnabled
      };
    } catch (error) {
      throw new Error(`创建备份失败: ${error.message}`);
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(options = {}) {
    try {
      const history = await this.readHistory();
      let backups = [...history.backups];

      // 排序
      if (options.sortBy === 'size') {
        backups.sort((a, b) => b.totalSize - a.totalSize);
      } else if (options.sortBy === 'name') {
        backups.sort((a, b) => a.description.localeCompare(b.description));
      } else {
        // 默认按时间排序（最新的在前）
        backups.sort((a, b) => new Date(b.created) - new Date(a.created));
      }

      // 分页
      if (options.limit) {
        backups = backups.slice(0, options.limit);
      }

      // 添加状态信息
      for (const backup of backups) {
        const backupPath = path.join(this.backupDir, backup.timestamp);
        backup.exists = await fs.pathExists(backupPath);
        backup.compressed = await fs.pathExists(`${backupPath}.tar.gz`);
        
        if (backup.exists) {
          backup.actualSize = await this.getDirectorySize(backupPath);
        }
      }

      return backups;
    } catch (error) {
      throw new Error(`列出备份失败: ${error.message}`);
    }
  }

  /**
   * 验证备份完整性
   */
  async verifyBackup(timestamp) {
    try {
      if (!timestamp) {
        // 验证所有备份
        const backups = await this.listBackups();
        const results = [];
        
        for (const backup of backups) {
          const result = await this.verifyBackup(backup.timestamp);
          results.push({
            timestamp: backup.timestamp,
            ...result
          });
        }
        
        return {
          verified: results.length,
          valid: results.filter(r => r.valid).length,
          invalid: results.filter(r => !r.valid).length,
          results,
          summary: true
        };
      }

      const backupPath = path.join(this.backupDir, timestamp);
      const metadataPath = path.join(backupPath, 'backup-info.json');

      if (!await fs.pathExists(backupPath)) {
        return {
          valid: false,
          issues: [`备份目录不存在: ${timestamp}`]
        };
      }

      const issues = [];
      let fileCount = 0;
      let totalSize = 0;

      // 检查元数据文件
      if (!await fs.pathExists(metadataPath)) {
        issues.push('备份元数据文件缺失');
      } else {
        try {
          const metadata = await fs.readJson(metadataPath);
          
          // 验证文件完整性
          if (metadata.files && Array.isArray(metadata.files)) {
            for (const fileInfo of metadata.files) {
            const filePath = path.join(backupPath, fileInfo.destination);
            
            if (!await fs.pathExists(filePath)) {
              issues.push(`文件缺失: ${fileInfo.destination}`);
              continue;
            }

            const actualSize = await this.getDirectorySize(filePath);
            if (actualSize !== fileInfo.size) {
              issues.push(`文件大小不匹配: ${fileInfo.destination}`);
            }

            // 校验和验证
            if (fileInfo.checksum && this.checksumEnabled) {
              const actualChecksum = await this.calculateChecksum(filePath);
              if (actualChecksum !== fileInfo.checksum) {
                issues.push(`文件校验失败: ${fileInfo.destination}`);
              }
            }

              fileCount++;
              totalSize += actualSize;
            }
          }
        } catch (error) {
          issues.push(`元数据文件损坏: ${error.message}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        fileCount,
        totalSize,
        timestamp
      };
    } catch (error) {
      throw new Error(`验证备份失败: ${error.message}`);
    }
  }

  /**
   * 清理旧备份
   */
  async cleanOldBackups(options = {}) {
    try {
      const {
        keepCount = this.maxBackups,
        keepDays = this.maxBackupDays,
        force = false
      } = options;

      const backups = await this.listBackups({ sortBy: 'created' });
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000);

      // 确定要删除的备份
      const toDelete = [];
      
      // 按数量清理（保留最新的N个）
      if (backups.length > keepCount) {
        toDelete.push(...backups.slice(keepCount));
      }

      // 按时间清理（删除超过N天的）
      for (const backup of backups) {
        const backupDate = new Date(backup.created);
        if (backupDate < cutoffDate && !toDelete.includes(backup)) {
          toDelete.push(backup);
        }
      }

      if (toDelete.length === 0) {
        return {
          cleaned: 0,
          spaceFreed: 0,
          kept: backups.length
        };
      }

      // 确认删除
      if (!force) {
        console.log(chalk.yellow(`\n准备清理 ${toDelete.length} 个备份:`));
        toDelete.forEach(backup => {
          const age = Math.floor((now - new Date(backup.created)) / (24 * 60 * 60 * 1000));
          console.log(`  - ${backup.timestamp} (${age}天前) - ${backup.description}`);
        });

        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: '确认删除这些备份?',
          default: false
        }]);

        if (!confirm) {
          return {
            cleaned: 0,
            spaceFreed: 0,
            kept: backups.length,
            cancelled: true
          };
        }
      }

      // 执行删除
      let spaceFreed = 0;
      let cleaned = 0;

      for (const backup of toDelete) {
        try {
          const backupPath = path.join(this.backupDir, backup.timestamp);
          const compressedPath = `${backupPath}.tar.gz`;

          // 计算释放的空间
          if (await fs.pathExists(backupPath)) {
            spaceFreed += await this.getDirectorySize(backupPath);
            await fs.remove(backupPath);
          }

          if (await fs.pathExists(compressedPath)) {
            const stats = await fs.stat(compressedPath);
            spaceFreed += stats.size;
            await fs.remove(compressedPath);
          }

          cleaned++;
        } catch (error) {
          console.warn(chalk.yellow(`警告: 删除备份 ${backup.timestamp} 失败: ${error.message}`));
        }
      }

      // 更新历史记录
      const history = await this.readHistory();
      history.backups = history.backups.filter(b => !toDelete.some(d => d.timestamp === b.timestamp));
      await this.writeHistory(history);

      return {
        cleaned,
        spaceFreed,
        kept: backups.length - cleaned
      };
    } catch (error) {
      throw new Error(`清理备份失败: ${error.message}`);
    }
  }

  /**
   * 压缩备份
   */
  async compressBackup(timestamp) {
    try {
      const backupPath = path.join(this.backupDir, timestamp);
      const compressedPath = `${backupPath}.tar.gz`;

      if (!await fs.pathExists(backupPath)) {
        throw new Error(`备份不存在: ${timestamp}`);
      }

      if (await fs.pathExists(compressedPath)) {
        throw new Error(`压缩文件已存在: ${timestamp}`);
      }

      const originalSize = await this.getDirectorySize(backupPath);

      // 使用 tar 压缩
      await this.runCommand('tar', [
        '-czf',
        compressedPath,
        '-C',
        this.backupDir,
        timestamp
      ]);

      const compressedStats = await fs.stat(compressedPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      // 删除原始目录
      await fs.remove(backupPath);

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        compressedPath
      };
    } catch (error) {
      throw new Error(`压缩备份失败: ${error.message}`);
    }
  }

  /**
   * 解压备份
   */
  async decompressBackup(timestamp) {
    try {
      const backupPath = path.join(this.backupDir, timestamp);
      const compressedPath = `${backupPath}.tar.gz`;

      if (!await fs.pathExists(compressedPath)) {
        throw new Error(`压缩备份不存在: ${timestamp}`);
      }

      if (await fs.pathExists(backupPath)) {
        throw new Error(`备份目录已存在: ${timestamp}`);
      }

      // 使用 tar 解压
      await this.runCommand('tar', [
        '-xzf',
        compressedPath,
        '-C',
        this.backupDir
      ]);

      return {
        decompressedPath: backupPath,
        compressedPath
      };
    } catch (error) {
      throw new Error(`解压备份失败: ${error.message}`);
    }
  }

  /**
   * 导出备份
   */
  async exportBackup(timestamp, options = {}) {
    try {
      const {
        outputPath = path.join(os.homedir(), 'Downloads'),
        format = 'tar'
      } = options;

      const backupPath = path.join(this.backupDir, timestamp);
      const compressedPath = `${backupPath}.tar.gz`;
      
      let sourcePath;
      let sourceExists = false;

      // 检查备份是否存在
      if (await fs.pathExists(compressedPath)) {
        sourcePath = compressedPath;
        sourceExists = true;
      } else if (await fs.pathExists(backupPath)) {
        sourcePath = backupPath;
        sourceExists = true;
      }

      if (!sourceExists) {
        throw new Error(`备份不存在: ${timestamp}`);
      }

      await fs.ensureDir(outputPath);

      const exportFileName = `claude-config-backup-${timestamp}.${format === 'zip' ? 'zip' : 'tar.gz'}`;
      const exportPath = path.join(outputPath, exportFileName);

      if (format === 'zip') {
        // 创建 ZIP 文件
        await this.runCommand('zip', [
          '-r',
          exportPath,
          sourcePath.endsWith('.tar.gz') ? sourcePath : timestamp
        ], {
          cwd: sourcePath.endsWith('.tar.gz') ? this.backupDir : this.backupDir
        });
      } else {
        // 复制 tar.gz 文件或创建新的 tar.gz
        if (sourcePath.endsWith('.tar.gz')) {
          await fs.copy(sourcePath, exportPath);
        } else {
          await this.runCommand('tar', [
            '-czf',
            exportPath,
            '-C',
            this.backupDir,
            timestamp
          ]);
        }
      }

      const exportStats = await fs.stat(exportPath);

      return {
        exportPath,
        fileSize: exportStats.size,
        format
      };
    } catch (error) {
      throw new Error(`导出备份失败: ${error.message}`);
    }
  }

  /**
   * 自动清理备份（内部使用）
   */
  async autoCleanBackups() {
    try {
      await this.cleanOldBackups({
        keepCount: this.maxBackups,
        keepDays: this.maxBackupDays,
        force: true // 自动清理不需要确认
      });
    } catch (error) {
      // 自动清理失败不应该阻止主要功能
      console.warn(chalk.yellow(`自动清理警告: ${error.message}`));
    }
  }

  /**
   * 计算文件/目录校验和
   */
  async calculateChecksum(filePath) {
    try {
      const hash = crypto.createHash('sha256');
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const content = await fs.readFile(filePath);
        hash.update(content);
      } else if (stats.isDirectory()) {
        const files = await this.getFileList(filePath);
        files.sort(); // 确保顺序一致

        for (const file of files) {
          const relativePath = path.relative(filePath, file);
          hash.update(relativePath);
          
          const content = await fs.readFile(file);
          hash.update(content);
        }
      }

      return hash.digest('hex');
    } catch (error) {
      throw new Error(`计算校验和失败: ${error.message}`);
    }
  }

  /**
   * 获取目录下所有文件列表
   */
  async getFileList(dirPath) {
    const files = [];
    
    async function walk(dir) {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await walk(itemPath);
        } else {
          files.push(itemPath);
        }
      }
    }
    
    await walk(dirPath);
    return files;
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isFile()) {
        return stats.size;
      }

      let totalSize = 0;
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        totalSize += await this.getDirectorySize(itemPath);
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 读取历史记录
   */
  async readHistory() {
    try {
      if (!await fs.pathExists(this.historyFile)) {
        return this.getDefaultHistory();
      }

      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultHistory();
    }
  }

  /**
   * 写入历史记录
   */
  async writeHistory(history) {
    try {
      const data = JSON.stringify(history, null, 2);
      await fs.writeFile(this.historyFile, data, 'utf8');
      await fs.chmod(this.historyFile, 0o600);
    } catch (error) {
      throw new Error(`写入历史记录失败: ${error.message}`);
    }
  }

  /**
   * 更新历史记录
   */
  async updateHistory(backupInfo) {
    const history = await this.readHistory();
    history.backups.push(backupInfo);
    history.lastBackup = backupInfo.timestamp;
    history.totalBackups = history.backups.length;
    await this.writeHistory(history);
  }

  /**
   * 获取默认历史记录
   */
  getDefaultHistory() {
    return {
      version: '1.0.0',
      backups: [],
      created: new Date().toISOString(),
      lastBackup: null,
      totalBackups: 0
    };
  }

  /**
   * 运行命令
   */
  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });
    });
  }
}

module.exports = BackupManager;