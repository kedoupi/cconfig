const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const chalk = require('chalk');

/**
 * 配置存储管理类
 * 负责配置文件的读写、验证、权限管理和格式转换
 */
class ConfigStorage {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(os.homedir(), '.cc-config');
    this.providersDir = path.join(this.baseDir, 'providers');
    this.schemasDir = path.join(this.baseDir, 'schemas');
    this.metadataFile = path.join(this.baseDir, 'metadata.json');

    // 配置文件权限
    this.dirMode = 0o700; // 仅用户可读写执行
    this.fileMode = 0o600; // 仅用户可读写

    // 支持的配置格式版本
    this.currentVersion = '1.0.0';
    this.supportedVersions = ['1.0.0'];

    // 初始化状态
    this.initialized = false;
  }

  /**
   * 初始化配置存储
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建必要的目录
      await this.ensureDirectories();

      // 初始化元数据文件
      await this.initializeMetadata();

      // 初始化配置模式
      await this.initializeSchemas();

      this.initialized = true;
    } catch (error) {
      throw new Error(`配置存储初始化失败: ${error.message}`);
    }
  }

  /**
   * 确保必要的目录存在
   */
  async ensureDirectories() {
    const directories = [this.baseDir, this.providersDir, this.schemasDir];

    for (const dir of directories) {
      await fs.ensureDir(dir);
      await fs.chmod(dir, this.dirMode);
    }
  }

  /**
   * 初始化元数据文件
   */
  async initializeMetadata() {
    if (!(await fs.pathExists(this.metadataFile))) {
      const metadata = {
        version: this.currentVersion,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        configCount: 0,
        format: 'json',
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm',
        },
      };

      await this.writeMetadata(metadata);
    }
  }

  /**
   * 初始化配置模式
   */
  async initializeSchemas() {
    const providerSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Provider Configuration Schema',
      description: '服务商配置文件模式',
      properties: {
        alias: {
          type: 'string',
          pattern: '^[a-zA-Z][a-zA-Z0-9_-]*$',
          minLength: 1,
          maxLength: 50,
          description: '服务商别名，用于命令行调用',
        },
        baseURL: {
          type: 'string',
          format: 'uri',
          description: 'API 基础 URL',
        },
        apiKey: {
          type: 'string',
          minLength: 10,
          description: 'API 密钥 (加密存储)',
        },
        timeout: {
          type: 'integer',
          minimum: 1000,
          maximum: 300000,
          default: 30000,
          description: '请求超时时间 (毫秒)',
        },
        description: {
          type: 'string',
          maxLength: 500,
          description: '服务商描述信息',
        },
        enabled: {
          type: 'boolean',
          default: true,
          description: '是否启用此服务商',
        },
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description: '自定义请求头',
        },
        metadata: {
          type: 'object',
          properties: {
            created: { type: 'string', format: 'date-time' },
            modified: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            source: { type: 'string' },
          },
        },
      },
      required: ['alias', 'baseURL', 'apiKey'],
      additionalProperties: false,
    };

    const schemaPath = path.join(this.schemasDir, 'provider.json');
    if (!(await fs.pathExists(schemaPath))) {
      await fs.writeJson(schemaPath, providerSchema, { spaces: 2 });
      await fs.chmod(schemaPath, this.fileMode);
    }
  }

  /**
   * 读取元数据
   */
  async readMetadata() {
    try {
      return await fs.readJson(this.metadataFile);
    } catch (error) {
      throw new Error(`读取元数据失败: ${error.message}`);
    }
  }

  /**
   * 写入元数据
   */
  async writeMetadata(metadata) {
    try {
      metadata.lastModified = new Date().toISOString();
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });
      await fs.chmod(this.metadataFile, this.fileMode);
    } catch (error) {
      throw new Error(`写入元数据失败: ${error.message}`);
    }
  }

  /**
   * 读取服务商配置
   */
  async readProvider(name) {
    await this.initialize();

    try {
      const filePath = path.join(this.providersDir, `${name}.json`);

      if (!(await fs.pathExists(filePath))) {
        throw new Error(`服务商 "${name}" 不存在`);
      }

      const data = await fs.readJson(filePath);

      // 验证配置格式
      await this.validateProviderConfig(data);

      // 解密 API 密钥
      if (data.apiKey && data.apiKey.startsWith('enc:')) {
        data.apiKey = this.decryptApiKey(data.apiKey);
      }

      return data;
    } catch (error) {
      throw new Error(`读取服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 写入服务商配置
   */
  async writeProvider(name, config) {
    await this.initialize();

    try {
      // 验证配置格式
      await this.validateProviderConfig(config);

      // 准备配置数据
      const configToSave = {
        ...config,
        metadata: {
          created: config.metadata?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
          version: this.currentVersion,
          source: config.metadata?.source || 'manual',
        },
      };

      // 加密 API 密钥
      if (configToSave.apiKey && !configToSave.apiKey.startsWith('enc:')) {
        configToSave.apiKey = this.encryptApiKey(configToSave.apiKey);
      }

      const filePath = path.join(this.providersDir, `${name}.json`);

      // 原子性写入：先写临时文件，然后重命名
      const tempPath = `${filePath}.tmp`;
      await fs.writeJson(tempPath, configToSave, { spaces: 2 });
      await fs.chmod(tempPath, this.fileMode);
      await fs.move(tempPath, filePath);

      // 更新元数据
      await this.updateConfigCount();

      return true;
    } catch (error) {
      throw new Error(`写入服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 删除服务商配置
   */
  async removeProvider(name) {
    await this.initialize();

    try {
      const filePath = path.join(this.providersDir, `${name}.json`);

      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      // 创建备份
      const backupPath = path.join(
        this.baseDir,
        'backups',
        `${name}-${Date.now()}.json.bak`
      );
      await fs.ensureDir(path.dirname(backupPath));
      await fs.copy(filePath, backupPath);

      // 删除配置文件
      await fs.remove(filePath);

      // 更新元数据
      await this.updateConfigCount();

      return true;
    } catch (error) {
      throw new Error(`删除服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 列出所有服务商配置
   */
  async listProviders(options = {}) {
    await this.initialize();

    try {
      const providers = {};
      const files = await fs.readdir(this.providersDir);

      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          const name = path.basename(file, '.json');

          try {
            if (options.includeMetadata) {
              providers[name] = await this.readProvider(name);
            } else {
              // 只读取基本信息，不解密
              const filePath = path.join(this.providersDir, file);
              const data = await fs.readJson(filePath);
              providers[name] = {
                alias: data.alias,
                baseURL: data.baseURL,
                enabled: data.enabled,
                description: data.description,
                hasApiKey: !!data.apiKey,
                lastModified: data.metadata?.modified,
              };
            }
          } catch (error) {
            // 记录错误但继续处理其他配置
            console.warn(
              chalk.yellow(`警告: 无法读取配置 ${name}: ${error.message}`)
            );
          }
        }
      }

      return providers;
    } catch (error) {
      throw new Error(`列出服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 批量导入配置
   */
  async batchImport(configs, options = {}) {
    await this.initialize();

    const results = [];
    const backup = options.createBackup ? await this.createBackup() : null;

    try {
      for (const [name, config] of Object.entries(configs)) {
        try {
          await this.writeProvider(name, config);
          results.push({ name, success: true });
        } catch (error) {
          results.push({ name, success: false, error: error.message });

          if (options.stopOnError) {
            throw error;
          }
        }
      }

      return {
        results,
        backup,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      };
    } catch (error) {
      // 如果启用了备份且出现错误，可以选择回滚
      if (backup && options.rollbackOnError) {
        await this.restoreBackup(backup);
      }
      throw error;
    }
  }

  /**
   * 批量导出配置
   */
  async batchExport(options = {}) {
    await this.initialize();

    try {
      const providers = await this.listProviders({ includeMetadata: true });
      const exportData = {};

      for (const [name, config] of Object.entries(providers)) {
        if (options.excludeSensitive) {
          // 移除敏感信息
          const { apiKey, ...safeConfig } = config;
          exportData[name] = {
            ...safeConfig,
            apiKey: '[REDACTED]',
          };
        } else {
          exportData[name] = config;
        }
      }

      return {
        version: this.currentVersion,
        exportDate: new Date().toISOString(),
        count: Object.keys(exportData).length,
        providers: exportData,
      };
    } catch (error) {
      throw new Error(`批量导出失败: ${error.message}`);
    }
  }

  /**
   * 验证配置格式
   */
  async validateProviderConfig(config) {
    // 基础验证
    if (!config || typeof config !== 'object') {
      throw new Error('配置必须是对象');
    }

    const required = ['alias', 'baseURL', 'apiKey'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    }

    // 验证别名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.alias)) {
      throw new Error(
        '别名格式无效：只能包含字母、数字、下划线和连字符，且必须以字母开头'
      );
    }

    // 验证 URL 格式
    try {
      new URL(config.baseURL);
    } catch {
      throw new Error('无效的 Base URL 格式');
    }

    // 验证超时时间
    if (config.timeout !== undefined) {
      const timeout = parseInt(config.timeout);
      if (isNaN(timeout) || timeout < 1000 || timeout > 300000) {
        throw new Error('超时时间必须在 1000-300000 毫秒之间');
      }
    }

    return true;
  }

  /**
   * 加密 API 密钥
   */
  encryptApiKey(apiKey) {
    if (!apiKey || apiKey.startsWith('enc:')) {
      return apiKey;
    }

    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 格式: enc:iv:encryptedData
      return `enc:${iv.toString('hex')}:${encrypted}`;
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
      const parts = encryptedKey.split(':');
      if (parts.length !== 3) {
        throw new Error('无效的加密数据格式');
      }

      const [, ivHex, encrypted] = parts;
      const key = this.getEncryptionKey();
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
   * 获取加密密钥
   */
  getEncryptionKey() {
    // 基于机器和用户信息生成密钥
    const machineId = `${os.hostname()}-${os.userInfo().username}`;
    return crypto.createHash('sha256').update(machineId).digest();
  }

  /**
   * 更新配置计数
   */
  async updateConfigCount() {
    try {
      const metadata = await this.readMetadata();
      const files = await fs.readdir(this.providersDir);
      const configCount = files.filter(f => f.endsWith('.json')).length;

      metadata.configCount = configCount;
      await this.writeMetadata(metadata);
    } catch (error) {
      // 忽略计数更新错误
    }
  }

  /**
   * 创建配置备份
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.baseDir, 'backups', timestamp);

    await fs.ensureDir(backupDir);
    await fs.copy(this.providersDir, path.join(backupDir, 'providers'));
    await fs.copy(this.metadataFile, path.join(backupDir, 'metadata.json'));

    return timestamp;
  }

  /**
   * 恢复配置备份
   */
  async restoreBackup(timestamp) {
    const backupDir = path.join(this.baseDir, 'backups', timestamp);

    if (!(await fs.pathExists(backupDir))) {
      throw new Error(`备份 ${timestamp} 不存在`);
    }

    // 创建当前状态的备份
    await this.createBackup();

    // 恢复配置
    await fs.copy(path.join(backupDir, 'providers'), this.providersDir);
    await fs.copy(path.join(backupDir, 'metadata.json'), this.metadataFile);

    return true;
  }

  /**
   * 获取存储统计信息
   */
  async getStats() {
    await this.initialize();

    try {
      const metadata = await this.readMetadata();
      const providers = await this.listProviders();

      const enabled = Object.values(providers).filter(p => p.enabled).length;
      const disabled = Object.values(providers).filter(p => !p.enabled).length;
      const withApiKeys = Object.values(providers).filter(
        p => p.hasApiKey
      ).length;

      return {
        version: metadata.version,
        created: metadata.created,
        lastModified: metadata.lastModified,
        total: Object.keys(providers).length,
        enabled,
        disabled,
        withApiKeys,
        storageSize: await this.getStorageSize(),
      };
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }

  /**
   * 获取存储大小
   */
  async getStorageSize() {
    try {
      let totalSize = 0;
      const items = await fs.readdir(this.baseDir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(this.baseDir, item.name);
        if (item.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          const stat = await fs.stat(itemPath);
          totalSize += stat.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          const stat = await fs.stat(itemPath);
          totalSize += stat.size;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }

    return totalSize;
  }
}

module.exports = ConfigStorage;
