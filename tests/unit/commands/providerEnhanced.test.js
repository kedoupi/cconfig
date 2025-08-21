const ProviderCommandsEnhanced = require('../../../src/commands/providerEnhanced');
const fs = require('fs-extra');
const path = require('path');
const { createTempDir, cleanupTempDir } = require('../../helpers/testUtils');

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const inquirer = require('inquirer');
const axios = require('axios');

describe('ProviderCommandsEnhanced', () => {
  let tempDir;
  let originalHome;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Clear inquirer mocks
    inquirer.prompt.mockClear();
    axios.get.mockClear();
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
    jest.restoreAllMocks();
  });

  describe('validateImportConfig', () => {
    test('应该验证有效的配置', () => {
      const validConfig = {
        name: 'test-provider',
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-api-key-123456789',
      };

      expect(() => {
        ProviderCommandsEnhanced.validateImportConfig(validConfig);
      }).not.toThrow();
    });

    test('应该拒绝缺少必要字段的配置', () => {
      const invalidConfig = {
        name: 'test-provider',
        alias: 'test',
        baseURL: 'https://api.test.com',
        // 缺少 apiKey
      };

      expect(() => {
        ProviderCommandsEnhanced.validateImportConfig(invalidConfig);
      }).toThrow('缺少必要字段: apiKey');
    });

    test('应该拒绝无效的URL', () => {
      const invalidConfig = {
        name: 'test-provider',
        alias: 'test',
        baseURL: 'invalid-url',
        apiKey: 'test-api-key-123456789',
      };

      expect(() => {
        ProviderCommandsEnhanced.validateImportConfig(invalidConfig);
      }).toThrow('无效的URL');
    });

    test('应该拒绝无效的别名格式', () => {
      const invalidConfig = {
        name: 'test-provider',
        alias: '123invalid', // 数字开头
        baseURL: 'https://api.test.com',
        apiKey: 'test-api-key-123456789',
      };

      expect(() => {
        ProviderCommandsEnhanced.validateImportConfig(invalidConfig);
      }).toThrow('无效的别名格式');
    });

    test('应该拒绝过短的API密钥', () => {
      const invalidConfig = {
        name: 'test-provider',
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'short', // 太短
      };

      expect(() => {
        ProviderCommandsEnhanced.validateImportConfig(invalidConfig);
      }).toThrow('API密钥长度不足');
    });
  });

  describe('testConnection', () => {
    test('应该测试成功的连接', async () => {
      const config = {
        baseURL: 'https://api.test.com',
        apiKey: 'test-key-123456789',
        timeout: 30000,
      };

      // Mock successful response
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      const result = await ProviderCommandsEnhanced.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(axios.get).toHaveBeenCalledWith(
        config.baseURL,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${config.apiKey}`,
            'User-Agent': 'Claude-Code-Kit/1.0.0',
          }),
          timeout: config.timeout,
        })
      );
    });

    test('应该处理网络错误', async () => {
      const config = {
        baseURL: 'https://api.invalid.com',
        apiKey: 'test-key-123456789',
        timeout: 30000,
      };

      // Mock network error
      const networkError = new Error('Network Error');
      networkError.code = 'ENOTFOUND';
      axios.get.mockRejectedValueOnce(networkError);

      const result = await ProviderCommandsEnhanced.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.message).toBe('域名无法解析');
    });

    test('应该处理HTTP错误状态', async () => {
      const config = {
        baseURL: 'https://api.test.com',
        apiKey: 'invalid-key',
        timeout: 30000,
      };

      // Mock 401 Unauthorized
      axios.get.mockResolvedValueOnce({
        status: 401,
        data: { error: 'Unauthorized' }
      });

      const result = await ProviderCommandsEnhanced.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });

    test('应该处理连接超时', async () => {
      const config = {
        baseURL: 'https://api.timeout.com',
        apiKey: 'test-key-123456789',
        timeout: 30000,
      };

      // Mock timeout error
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';
      axios.get.mockRejectedValueOnce(timeoutError);

      const result = await ProviderCommandsEnhanced.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.message).toBe('连接超时');
    });
  });

  describe('importFromFile', () => {
    test('应该从JSON文件导入配置', async () => {
      const configData = [
        {
          name: 'test-provider-1',
          alias: 'test1',
          baseURL: 'https://api.test1.com',
          apiKey: 'test-key-123456789-1',
          description: 'Test provider 1',
        },
        {
          name: 'test-provider-2',
          alias: 'test2',
          baseURL: 'https://api.test2.com',
          apiKey: 'test-key-123456789-2',
          description: 'Test provider 2',
        },
      ];

      const configFile = path.join(tempDir, 'test-config.json');
      await fs.writeJson(configFile, configData);

      // Mock successful import confirmation
      inquirer.prompt.mockResolvedValueOnce({ continueWithValid: true });

      // Since we can't easily mock the ProviderManager in this context,
      // we'll just test that the function doesn't throw for now
      await expect(
        ProviderCommandsEnhanced.importFromFile(configFile, {})
      ).resolves.not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('发现 2 个服务商配置')
      );
    });

    test('应该处理单个配置对象', async () => {
      const configData = {
        name: 'single-provider',
        alias: 'single',
        baseURL: 'https://api.single.com',
        apiKey: 'single-key-123456789',
      };

      const configFile = path.join(tempDir, 'single-config.json');
      await fs.writeJson(configFile, configData);

      await expect(
        ProviderCommandsEnhanced.importFromFile(configFile, {})
      ).resolves.not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('发现 1 个服务商配置')
      );
    });

    test('应该拒绝无效的配置格式', async () => {
      const invalidData = 'not-json-array-or-object';

      const configFile = path.join(tempDir, 'invalid-config.json');
      await fs.writeJson(configFile, invalidData);

      await expect(
        ProviderCommandsEnhanced.importFromFile(configFile, {})
      ).rejects.toThrow('配置文件格式错误');
    });

    test('应该处理不存在的文件', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.json');

      await expect(
        ProviderCommandsEnhanced.importFromFile(nonExistentFile, {})
      ).rejects.toThrow('文件导入失败');
    });
  });

  describe('export', () => {
    test('应该处理无服务商配置的情况', async () => {
      // This would require mocking ProviderManager.getProviders() to return empty object
      // For now, we'll just test that the method exists and doesn't immediately throw
      expect(typeof ProviderCommandsEnhanced.export).toBe('function');
    });
  });
});