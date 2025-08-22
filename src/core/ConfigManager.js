const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.cc-config');
    this.providersDir = path.join(this.configDir, 'providers');
    this.aliasesFile = path.join(this.configDir, 'aliases.sh');
    this.backupDir = path.join(this.configDir, 'backups');
    this.historyFile = path.join(this.configDir, 'history.json');

    // Claude 配置目录
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  /**
   * 初始化配置目录和文件
   */
  async initialize(force = false) {
    try {
      // 创建配置目录
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.providersDir);
      await fs.ensureDir(this.backupDir);
      await fs.ensureDir(this.claudeDir);

      // 设置目录权限 (仅用户可读写)
      await fs.chmod(this.configDir, 0o700);
      await fs.chmod(this.providersDir, 0o700);
      await fs.chmod(this.backupDir, 0o700);

      // 初始化历史记录文件
      if (force || !(await fs.exists(this.historyFile))) {
        await this.writeHistory(this.getDefaultHistory());
      }

      return true;
    } catch (error) {
      throw new Error(`配置初始化失败: ${error.message}`);
    }
  }

  /**
   * 读取服务商配置
   */
  async readProviders() {
    try {
      const providers = {};
      const files = await fs.readdir(this.providersDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const providerName = path.basename(file, '.json');
          const filePath = path.join(this.providersDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          providers[providerName] = JSON.parse(data);
        }
      }

      return providers;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw new Error(`读取服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 写入服务商配置
   */
  async writeProvider(name, config) {
    try {
      const validatedConfig = this.validateProviderConfig(config);

      // 加密 API 密钥
      if (validatedConfig.apiKey) {
        validatedConfig.apiKey = this.encryptApiKey(validatedConfig.apiKey);
      }

      const filePath = path.join(this.providersDir, `${name}.json`);
      const data = JSON.stringify(validatedConfig, null, 2);

      await fs.writeFile(filePath, data, 'utf8');
      await fs.chmod(filePath, 0o600); // 仅用户可读写

      return true;
    } catch (error) {
      throw new Error(`写入服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 删除服务商配置
   */
  async removeProvider(name) {
    try {
      const filePath = path.join(this.providersDir, `${name}.json`);

      if (await fs.exists(filePath)) {
        await fs.remove(filePath);
        return true;
      }

      return false;
    } catch (error) {
      throw new Error(`删除服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 获取指定服务商配置
   */
  async getProvider(name) {
    try {
      const filePath = path.join(this.providersDir, `${name}.json`);

      if (!(await fs.exists(filePath))) {
        throw new Error(`服务商 "${name}" 不存在`);
      }

      const data = await fs.readFile(filePath, 'utf8');
      const config = JSON.parse(data);

      // 解密 API 密钥
      if (config.apiKey) {
        config.apiKey = this.decryptApiKey(config.apiKey);
      }

      return config;
    } catch (error) {
      throw new Error(`获取服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 创建配置备份
   */
  async createBackup(description = '手动备份') {
    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const backupPath = path.join(this.backupDir, timestamp);

      // 创建备份目录
      await fs.ensureDir(backupPath);

      // 备份 Claude 配置目录
      if (await fs.exists(this.claudeDir)) {
        await fs.copy(this.claudeDir, path.join(backupPath, 'claude'));
      }

      // 记录备份信息
      const history = await this.readHistory();
      history.backups.push({
        timestamp,
        description,
        size: await this.getDirectorySize(backupPath),
        created: new Date().toISOString(),
      });

      await this.writeHistory(history);

      return timestamp;
    } catch (error) {
      throw new Error(`创建备份失败: ${error.message}`);
    }
  }

  /**
   * 恢复配置备份
   */
  async restoreBackup(timestamp) {
    try {
      const backupPath = path.join(this.backupDir, timestamp, 'claude');

      if (!(await fs.exists(backupPath))) {
        throw new Error(`备份 ${timestamp} 不存在`);
      }

      // 创建当前状态备份
      await this.createBackup('恢复前自动备份');

      // 清除当前配置
      if (await fs.exists(this.claudeDir)) {
        await fs.remove(this.claudeDir);
      }

      // 恢复配置
      await fs.copy(backupPath, this.claudeDir);

      return true;
    } catch (error) {
      throw new Error(`恢复备份失败: ${error.message}`);
    }
  }

  /**
   * 读取备份历史
   */
  async readHistory() {
    try {
      if (!(await fs.exists(this.historyFile))) {
        return this.getDefaultHistory();
      }

      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultHistory();
    }
  }

  /**
   * 写入备份历史
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
   * 验证服务商配置格式
   */
  validateProviderConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('无效的配置格式');
    }

    if (!config.alias || !config.baseURL) {
      throw new Error('缺少必要字段: alias 和 baseURL');
    }

    // 验证别名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.alias)) {
      throw new Error(
        '别名只能包含字母、数字、下划线和连字符，且必须以字母开头'
      );
    }

    // 验证 URL 格式
    try {
      new URL(config.baseURL);
    } catch {
      throw new Error('无效的 Base URL 格式');
    }

    return {
      alias: config.alias,
      baseURL: config.baseURL,
      apiKey: config.apiKey || '',
      timeout: Number(config.timeout) || 30000,
      enabled: Boolean(config.enabled !== false),
      description: config.description || '',
    };
  }

  /**
   * 简单的 API 密钥加密
   */
  encryptApiKey(apiKey) {
    if (!apiKey || apiKey.startsWith('enc:')) {
      return apiKey;
    }

    try {
      const key = this.getEncryptionKey(); // 已经是 32 字节的 Buffer
      const iv = crypto.randomBytes(16); // 16 字节初始化向量
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 格式: iv:encryptedData
      const result = `${iv.toString('hex')}:${encrypted}`;
      return 'enc:' + result;
    } catch (error) {
      throw new Error(`API密钥加密失败: ${error.message}`);
    }
  }

  /**
   * 解密 API 密钥
   */
  decryptApiKey(encryptedKey) {
    if (!encryptedKey || !encryptedKey.startsWith('enc:')) {
      return encryptedKey;
    }

    try {
      const encryptedData = encryptedKey.substring(4);
      const [ivHex, encrypted] = encryptedData.split(':');

      if (!ivHex || !encrypted) {
        throw new Error('无效的加密数据格式');
      }

      const key = this.getEncryptionKey(); // 已经是 Buffer
      const iv = Buffer.from(ivHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`API密钥解密失败: ${error.message}`);
    }
  }

  /**
   * 获取加密密钥 (基于机器特征)
   */
  getEncryptionKey() {
    const machineId = os.hostname() + os.userInfo().username;
    return crypto.createHash('sha256').update(machineId).digest(); // 直接返回 Buffer，32 字节用于 AES-256
  }

  /**
   * 获取默认历史记录
   */
  getDefaultHistory() {
    return {
      version: '1.0.0',
      backups: [],
      created: new Date().toISOString(),
    };
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
   * 获取配置路径信息
   */
  getPaths() {
    return {
      configDir: this.configDir,
      providersDir: this.providersDir,
      aliasesFile: this.aliasesFile,
      backupDir: this.backupDir,
      claudeDir: this.claudeDir,
      historyFile: this.historyFile,
    };
  }
}

module.exports = ConfigManager;
