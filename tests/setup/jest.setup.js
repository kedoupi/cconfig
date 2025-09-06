/**
 * Jest Test Setup
 * 
 * Global setup configuration for all tests.
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const testEnvManager = require('../helpers/TestEnvironmentManager');
const ResourceManager = require('../../src/utils/ResourceManager');

// Global test configuration
global.TEST_TIMEOUT = 30000;
global.TEST_CONFIG_DIR = path.join(os.tmpdir(), 'cc-test-config');
global.TEST_CLAUDE_DIR = path.join(os.tmpdir(), 'cc-test-claude');

// 安全的环境变量管理器
global.testEnvManager = testEnvManager;

// Setup before all tests
beforeAll(async () => {
  // Ensure test directories exist
  await fs.ensureDir(global.TEST_CONFIG_DIR);
  await fs.ensureDir(global.TEST_CLAUDE_DIR);
});

// Cleanup after all tests
afterAll(async () => {
  // 最终清理所有资源
  await ResourceManager.cleanupAll();
  
  // Clean up test directories
  try {
    await fs.remove(global.TEST_CONFIG_DIR);
    await fs.remove(global.TEST_CLAUDE_DIR);
  } catch (error) {
    console.warn('Failed to clean up test directories:', error.message);
  }
});

// Setup before each test
beforeEach(async () => {
  // 激活安全的测试环境
  testEnvManager.activate(global.TEST_CONFIG_DIR);
  
  // Clean test directories before each test
  await fs.emptyDir(global.TEST_CONFIG_DIR);
  await fs.emptyDir(global.TEST_CLAUDE_DIR);
});

// Cleanup after each test
afterEach(async () => {
  // 停用测试环境，恢复原始环境变量
  testEnvManager.deactivate();
  
  // 清理所有资源以避免测试间的资源泄漏
  try {
    await ResourceManager.cleanupAll();
  } catch (error) {
    // 静默处理清理错误，避免干扰测试结果
    console.warn('ResourceManager cleanup warning:', error.message);
  }
  
  // 给系统一些时间完成清理
  await new Promise(resolve => setTimeout(resolve, 10));
});

// Suppress console.log during tests unless explicitly testing logging
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Only suppress if not testing console output
  if (!expect.getState().currentTestName?.includes('console')) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Custom matchers
expect.extend({
  toBeValidProviderConfig(received) {
    const required = ['alias', 'baseURL', 'apiKey'];
    const missing = required.filter(key => !received[key]);
    
    if (missing.length > 0) {
      return {
        message: () => `Expected valid provider config, but missing: ${missing.join(', ')}`,
        pass: false
      };
    }

    // Validate alias format
    if (!/^[a-zA-Z0-9-_]+$/.test(received.alias)) {
      return {
        message: () => 'Expected valid alias format (letters, numbers, hyphens, underscores only)',
        pass: false
      };
    }

    // Validate URL format
    try {
      new URL(received.baseURL);
    } catch {
      return {
        message: () => 'Expected valid baseURL format',
        pass: false
      };
    }

    return {
      message: () => 'Expected invalid provider config',
      pass: true
    };
  },

  toBeValidTimestamp(received) {
    // Check if it's a valid timestamp format (YYYY-MM-DD_HH-MM-SS)
    const timestampPattern = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/;
    const pass = timestampPattern.test(received);
    
    return {
      message: () => pass 
        ? 'Expected invalid timestamp format'
        : 'Expected valid timestamp format (YYYY-MM-DD_HH-MM-SS)',
      pass
    };
  }
});

// Test utilities
global.testUtils = {
  /**
   * Create a test provider configuration
   */
  createTestProvider(overrides = {}) {
    return {
      alias: 'testprovider',
      baseURL: 'https://api.testprovider.com',
      apiKey: 'test-api-key-12345678901234567890',
      timeout: '3000000',
      ...overrides
    };
  },

  /**
   * Create multiple test providers
   */
  createTestProviders(count = 3) {
    return Array.from({ length: count }, (_, i) => ({
      alias: `testprovider${i + 1}`,
      baseURL: `https://api.testprovider${i + 1}.com`,
      apiKey: `test-api-key-${i + 1}-12345678901234567890`,
      timeout: '3000000'
    }));
  },

  /**
   * Wait for a specified amount of time
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate a random string
   */
  randomString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Create a test backup metadata object
   */
  createTestBackupMetadata(overrides = {}) {
    return {
      timestamp: '2023-01-01_12-00-00',
      description: 'Test backup',
      size: '1.2 MB',
      created_by: 'test',
      ...overrides
    };
  }
};