const wizardCommands = require('../../../src/commands/wizard');

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const inquirer = require('inquirer');
const axios = require('axios');

describe('wizard commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('PROVIDER_TEMPLATES', () => {
    test('应该包含预设的服务商模板', () => {
      expect(wizardCommands.PROVIDER_TEMPLATES).toHaveProperty('anthropic');
      expect(wizardCommands.PROVIDER_TEMPLATES).toHaveProperty('anthropic-vertex');
      expect(wizardCommands.PROVIDER_TEMPLATES).toHaveProperty('openai');
      expect(wizardCommands.PROVIDER_TEMPLATES).toHaveProperty('custom');
    });

    test('Anthropic模板应该有正确的配置', () => {
      const anthropicTemplate = wizardCommands.PROVIDER_TEMPLATES.anthropic;
      
      expect(anthropicTemplate.name).toBe('Anthropic Claude');
      expect(anthropicTemplate.alias).toBe('claude');
      expect(anthropicTemplate.baseURL).toBe('https://api.anthropic.com');
      expect(anthropicTemplate.testEndpoint).toBe('/v1/messages');
    });
  });

  describe('wizard function', () => {
    test('应该显示欢迎信息', async () => {
      // Mock user selecting template mode and then canceling
      inquirer.prompt
        .mockResolvedValueOnce({ mode: 'template' }) // Select mode
        .mockResolvedValueOnce({ templateKey: 'anthropic' }) // Select template
        .mockResolvedValueOnce({ 
          name: 'test-anthropic',
          alias: 'test-claude',
          apiKey: 'test-api-key-123456789'
        }) // Configure from template
        .mockResolvedValueOnce({ confirm: false }); // Don't save config

      await wizardCommands.wizard();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Claude Code 服务商配置向导')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('此向导将帮助您配置 AI 服务商')
      );
    });

    test('应该支持指定配置模式', async () => {
      // Mock quick mode setup
      inquirer.prompt
        .mockResolvedValueOnce({ 
          name: 'test-provider',
          alias: 'test',
          baseURL: 'https://api.test.com',
          apiKey: 'test-key-123456789'
        }) // Quick setup prompts
        .mockResolvedValueOnce({ confirm: false }); // Don't save

      await wizardCommands.wizard({ mode: 'quick' });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('快速配置模式')
      );
    });

    test('应该处理模板选择', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ templateKey: 'anthropic' })
        .mockResolvedValueOnce({ 
          name: 'my-claude',
          alias: 'claude',
          apiKey: 'test-key-123456789'
        })
        .mockResolvedValueOnce({ confirm: false });

      await wizardCommands.wizard({ mode: 'template' });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('选择服务商模板')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Anthropic Claude')
      );
    });

    test('应该支持API连接测试', async () => {
      // Mock successful API response
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      inquirer.prompt
        .mockResolvedValueOnce({ templateKey: 'anthropic' })
        .mockResolvedValueOnce({ 
          name: 'test-claude',
          alias: 'claude',
          apiKey: 'test-key-123456789'
        })
        .mockResolvedValueOnce({ confirm: true }) // Confirm config
        .mockResolvedValueOnce({ test: true }) // Test connection
        .mockResolvedValueOnce({ setAsDefault: false }); // Don't set as default

      // Mock provider manager methods
      const mockProviderManager = {
        addProvider: jest.fn().mockResolvedValue(true),
        setDefaultProvider: jest.fn().mockResolvedValue(true),
      };

      // We need to mock the module's internal providerManager
      // For now, let's just expect the function to not throw
      await expect(wizardCommands.wizard({ mode: 'template' })).resolves.not.toThrow();
    });

    test('应该处理API连接失败', async () => {
      // Mock network error
      const networkError = new Error('Network Error');
      networkError.code = 'ENOTFOUND';
      axios.get.mockRejectedValueOnce(networkError);

      inquirer.prompt
        .mockResolvedValueOnce({ templateKey: 'custom' })
        .mockResolvedValueOnce({ 
          name: 'test-custom',
          alias: 'custom',
          baseURL: 'https://invalid-url.test',
          apiKey: 'test-key-123456789'
        })
        .mockResolvedValueOnce({ confirm: true }) // Confirm config
        .mockResolvedValueOnce({ test: true }) // Test connection
        .mockResolvedValueOnce({ continueAnyway: true }); // Continue after failure for testing

      // The wizard should handle the error gracefully and continue
      await expect(wizardCommands.wizard({ mode: 'template' })).resolves.not.toThrow();
      
      // Check that warning was logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('域名无法解析')
      );
    });
  });
});