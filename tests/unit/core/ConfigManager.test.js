const fs = require('fs-extra');
const path = require('path');
const ConfigManager = require('../../../src/core/ConfigManager');
const { createTempDir, cleanupTempDir } = require('../../helpers/testUtils');

describe('ConfigManager', () => {
  let tempDir;
  let configManager;

  beforeEach(async () => {
    tempDir = await createTempDir();
    configManager = new ConfigManager();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('constructor', () => {
    test('应该设置默认配置目录', () => {
      expect(configManager.configDir).toContain('.cc-config');
      expect(configManager.providersDir).toContain('providers');
      expect(configManager.claudeDir).toContain('.claude');
    });
  });

  describe('getPaths', () => {
    test('应该返回所有配置路径', () => {
      const paths = configManager.getPaths();
      
      expect(paths).toHaveProperty('configDir');
      expect(paths).toHaveProperty('providersDir');
      expect(paths).toHaveProperty('aliasesFile');
      expect(paths).toHaveProperty('backupDir');
      expect(paths).toHaveProperty('claudeDir');
      expect(paths).toHaveProperty('historyFile');
    });
  });

  describe('validateProviderConfig', () => {
    test('应该验证有效的配置', () => {
      const config = {
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
      };
      
      const validated = configManager.validateProviderConfig(config);
      
      expect(validated.alias).toBe('test');
      expect(validated.baseURL).toBe('https://api.test.com');
      expect(validated.enabled).toBe(true);
    });

    test('应该拒绝无效的别名', () => {
      const config = {
        alias: '123invalid', // 数字开头
        baseURL: 'https://api.test.com',
      };
      
      expect(() => {
        configManager.validateProviderConfig(config);
      }).toThrow('别名只能包含字母、数字、下划线和连字符，且必须以字母开头');
    });

    test('应该拒绝无效的URL', () => {
      const config = {
        alias: 'test',
        baseURL: 'invalid-url',
      };
      
      expect(() => {
        configManager.validateProviderConfig(config);
      }).toThrow('无效的 Base URL 格式');
    });

    test('应该拒绝缺少必要字段', () => {
      const config = {
        alias: 'test',
        // 缺少 baseURL
      };
      
      expect(() => {
        configManager.validateProviderConfig(config);
      }).toThrow('缺少必要字段: alias 和 baseURL');
    });
  });

  describe('encryptApiKey', () => {
    test('应该加密API密钥', () => {
      const apiKey = 'test-api-key';
      const encrypted = configManager.encryptApiKey(apiKey);
      
      expect(encrypted).toMatch(/^enc:/);
      expect(encrypted).not.toBe(apiKey);
    });

    test('应该不重复加密已加密的密钥', () => {
      const encryptedKey = 'enc:abc123def';
      const result = configManager.encryptApiKey(encryptedKey);
      
      expect(result).toBe(encryptedKey);
    });
  });

  describe('decryptApiKey', () => {
    test('应该解密加密的API密钥', () => {
      const apiKey = 'test-api-key';
      const encrypted = configManager.encryptApiKey(apiKey);
      const decrypted = configManager.decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    test('应该返回未加密的密钥不变', () => {
      const plainKey = 'plain-api-key';
      const result = configManager.decryptApiKey(plainKey);
      
      expect(result).toBe(plainKey);
    });
  });

  describe('getDefaultHistory', () => {
    test('应该返回默认历史记录格式', () => {
      const history = configManager.getDefaultHistory();
      
      expect(history).toHaveProperty('version');
      expect(history).toHaveProperty('backups');
      expect(history).toHaveProperty('created');
      expect(Array.isArray(history.backups)).toBe(true);
    });
  });
});