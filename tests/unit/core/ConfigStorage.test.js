const ConfigStorage = require('../../../src/core/ConfigStorage');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { createTempDir, cleanupTempDir } = require('../../helpers/testUtils');

describe('ConfigStorage', () => {
  let tempDir;
  let configStorage;
  let originalHome;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    configStorage = new ConfigStorage({
      baseDir: path.join(tempDir, '.cc-config'),
    });

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('应该正确初始化配置路径', () => {
      expect(configStorage.baseDir).toBe(path.join(tempDir, '.cc-config'));
      expect(configStorage.providersDir).toBe(path.join(tempDir, '.cc-config', 'providers'));
      expect(configStorage.schemasDir).toBe(path.join(tempDir, '.cc-config', 'schemas'));
    });

    test('应该设置正确的文件权限', () => {
      expect(configStorage.dirMode).toBe(0o700);
      expect(configStorage.fileMode).toBe(0o600);
    });
  });

  describe('initialize', () => {
    test('应该创建必要的目录结构', async () => {
      await configStorage.initialize();

      expect(await fs.pathExists(configStorage.baseDir)).toBe(true);
      expect(await fs.pathExists(configStorage.providersDir)).toBe(true);
      expect(await fs.pathExists(configStorage.schemasDir)).toBe(true);
      expect(await fs.pathExists(configStorage.metadataFile)).toBe(true);
    });

    test('应该创建 JSON schema 文件', async () => {
      await configStorage.initialize();

      const schemaPath = path.join(configStorage.schemasDir, 'provider.json');
      expect(await fs.pathExists(schemaPath)).toBe(true);

      const schema = await fs.readJson(schemaPath);
      expect(schema.type).toBe('object');
      expect(schema.properties.alias).toBeDefined();
      expect(schema.properties.baseURL).toBeDefined();
      expect(schema.properties.apiKey).toBeDefined();
    });
  });

  describe('加密和解密', () => {
    test('应该正确加密和解密 API 密钥', () => {
      const originalKey = 'test-api-key-12345';
      
      const encrypted = configStorage.encryptApiKey(originalKey);
      expect(encrypted).toMatch(/^enc:/);
      expect(encrypted).not.toContain(originalKey);

      const decrypted = configStorage.decryptApiKey(encrypted);
      expect(decrypted).toBe(originalKey);
    });

    test('应该跳过已加密的密钥', () => {
      const alreadyEncrypted = 'enc:abc123:def456';
      
      const result = configStorage.encryptApiKey(alreadyEncrypted);
      expect(result).toBe(alreadyEncrypted);
    });

    test('应该跳过未加密的密钥解密', () => {
      const plainKey = 'plain-api-key';
      
      const result = configStorage.decryptApiKey(plainKey);
      expect(result).toBe(plainKey);
    });
  });

  describe('配置验证', () => {
    test('应该验证有效的服务商配置', async () => {
      const validConfig = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key-123',
        timeout: 30000,
        enabled: true,
        description: 'Test provider',
      };

      expect(() => {
        configStorage.validateProviderConfig(validConfig);
      }).not.toThrow();
    });

    test('应该拒绝缺少必要字段的配置', async () => {
      const invalidConfig = {
        alias: 'test',
        // 缺少 baseURL 和 apiKey
      };

      let errorThrown = false;
      try {
        configStorage.validateProviderConfig(invalidConfig);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toMatch(/缺少必要字段/);
      }
      expect(errorThrown).toBe(true);
    });

    test('应该拒绝无效的别名格式', async () => {
      const invalidConfig = {
        alias: '123invalid', // 数字开头
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
      };

      let errorThrown = false;
      try {
        configStorage.validateProviderConfig(invalidConfig);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toMatch(/别名格式无效/);
      }
      expect(errorThrown).toBe(true);
    });

    test('应该拒绝无效的 URL', async () => {
      const invalidConfig = {
        alias: 'test',
        baseURL: 'invalid-url',
        apiKey: 'test-key',
      };

      let errorThrown = false;
      try {
        configStorage.validateProviderConfig(invalidConfig);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toMatch(/无效的 Base URL 格式/);
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('服务商配置管理', () => {
    beforeEach(async () => {
      await configStorage.initialize();
    });

    test('应该写入和读取服务商配置', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key-123456789',
        timeout: 30000,
        enabled: true,
        description: 'Test provider',
      };

      await configStorage.writeProvider('test-provider', config);

      const savedConfig = await configStorage.readProvider('test-provider');
      expect(savedConfig.alias).toBe(config.alias);
      expect(savedConfig.baseURL).toBe(config.baseURL);
      expect(savedConfig.apiKey).toBe(config.apiKey); // 应该被解密
      expect(savedConfig.enabled).toBe(config.enabled);
    });

    test('应该列出所有服务商配置', async () => {
      const config1 = {
        alias: 'test1',
        baseURL: 'https://api.test1.com',
        apiKey: 'test-key-1',
        enabled: true,
      };

      const config2 = {
        alias: 'test2',
        baseURL: 'https://api.test2.com',
        apiKey: 'test-key-2',
        enabled: false,
      };

      await configStorage.writeProvider('provider1', config1);
      await configStorage.writeProvider('provider2', config2);

      const providers = await configStorage.listProviders();
      expect(Object.keys(providers)).toHaveLength(2);
      expect(providers.provider1.alias).toBe('test1');
      expect(providers.provider2.alias).toBe('test2');
    });

    test('应该删除服务商配置', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true,
      };

      await configStorage.writeProvider('test-provider', config);
      expect(await configStorage.removeProvider('test-provider')).toBe(true);

      await expect(
        configStorage.readProvider('test-provider')
      ).rejects.toThrow('服务商 "test-provider" 不存在');
    });

    test('应该处理不存在的服务商删除', async () => {
      const result = await configStorage.removeProvider('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('批量操作', () => {
    beforeEach(async () => {
      await configStorage.initialize();
    });

    test('应该批量导入配置', async () => {
      const configs = {
        provider1: {
          alias: 'test1',
          baseURL: 'https://api.test1.com',
          apiKey: 'key1',
          enabled: true,
        },
        provider2: {
          alias: 'test2',
          baseURL: 'https://api.test2.com',
          apiKey: 'key2',
          enabled: true,
        },
      };

      const result = await configStorage.batchImport(configs);
      
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      
      const providers = await configStorage.listProviders();
      expect(Object.keys(providers)).toHaveLength(2);
    });

    test('应该批量导出配置', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true,
      };

      await configStorage.writeProvider('test-provider', config);

      const exportData = await configStorage.batchExport();
      
      expect(exportData.count).toBe(1);
      expect(exportData.providers['test-provider']).toBeDefined();
      expect(exportData.providers['test-provider'].alias).toBe('test');
    });

    test('应该排除敏感数据的导出', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true,
      };

      await configStorage.writeProvider('test-provider', config);

      const exportData = await configStorage.batchExport({ excludeSensitive: true });
      
      expect(exportData.providers['test-provider'].apiKey).toBe('[REDACTED]');
    });
  });

  describe('存储统计', () => {
    beforeEach(async () => {
      await configStorage.initialize();
    });

    test('应该返回存储统计信息', async () => {
      const config1 = {
        alias: 'test1',
        baseURL: 'https://api.test1.com',
        apiKey: 'key1',
        enabled: true,
      };

      const config2 = {
        alias: 'test2',
        baseURL: 'https://api.test2.com',
        apiKey: 'key2',
        enabled: false,
      };

      await configStorage.writeProvider('provider1', config1);
      await configStorage.writeProvider('provider2', config2);

      const stats = await configStorage.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.withApiKeys).toBe(2);
      expect(stats.version).toBe('1.0.0');
    });
  });

  describe('备份管理', () => {
    beforeEach(async () => {
      await configStorage.initialize();
    });

    test('应该创建配置备份', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true,
      };

      await configStorage.writeProvider('test-provider', config);

      const backup = await configStorage.createBackup();
      expect(typeof backup).toBe('string');

      const backupDir = path.join(configStorage.baseDir, 'backups', backup);
      expect(await fs.pathExists(backupDir)).toBe(true);
    });

    test('应该恢复配置备份', async () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true,
      };

      await configStorage.writeProvider('test-provider', config);
      const backup = await configStorage.createBackup();

      // 删除配置
      await configStorage.removeProvider('test-provider');

      // 恢复备份
      const result = await configStorage.restoreBackup(backup);
      expect(result).toBe(true);

      // 验证恢复的配置
      const restoredConfig = await configStorage.readProvider('test-provider');
      expect(restoredConfig.alias).toBe('test');
    });
  });
});