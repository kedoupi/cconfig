/**
 * Configuration Management Integration Tests
 * 配置管理集成测试
 */

const fs = require('fs-extra');
const path = require('path');
const { createTempTestDir, cleanupTempDir, setupTestConfig, createTestProvider } = require('../helpers/testUtils');

describe('Configuration Management Integration', () => {
  let tempDir;
  let originalHome;
  let originalCconfigHome;

  beforeEach(async () => {
    tempDir = await createTempTestDir();
    originalHome = process.env.HOME;
    originalCconfigHome = process.env.CCONFIG_HOME;
    process.env.HOME = tempDir;
    process.env.CCONFIG_HOME = path.join(tempDir, '.cconfig');
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.CCONFIG_HOME = originalCconfigHome;
    await cleanupTempDir(tempDir);
  });

  describe('Configuration Directory Setup', () => {
    test('should create config directory structure', async () => {
      const { configDir, providersDir } = await setupTestConfig(tempDir);
      
      expect(await fs.pathExists(configDir)).toBe(true);
      expect(await fs.pathExists(providersDir)).toBe(true);
      
      const configFile = path.join(configDir, 'config.json');
      expect(await fs.pathExists(configFile)).toBe(true);
      
      const config = await fs.readJson(configFile);
      expect(config).toHaveProperty('defaultProvider');
    });
  });

  describe('Provider Management', () => {
    test('should handle provider creation workflow', async () => {
      const { providersDir } = await setupTestConfig(tempDir);
      
      // 模拟创建provider
      const provider = createTestProvider();
      const providerFile = path.join(providersDir, `${provider.alias}.json`);
      
      await fs.writeJson(providerFile, provider);
      await fs.chmod(providerFile, 0o600);
      
      // 验证文件创建和权限
      expect(await fs.pathExists(providerFile)).toBe(true);
      
      const savedProvider = await fs.readJson(providerFile);
      expect(savedProvider.alias).toBe(provider.alias);
      expect(savedProvider.apiUrl).toBe(provider.apiUrl);
      expect(savedProvider.apiKey).toBe(provider.apiKey);
      
      // 验证文件权限
      const stats = await fs.stat(providerFile);
      const permissions = stats.mode & parseInt('777', 8);
      expect(permissions).toBe(0o600);
    });
  });

});
