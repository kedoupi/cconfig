/**
 * Test Utilities
 * 测试工具函数
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 创建临时测试目录
 */
async function createTempTestDir(prefix = 'cconfig-test-') {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return tempDir;
}

/**
 * 清理临时测试目录
 */
async function cleanupTempDir(tempDir) {
  if (tempDir && await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }
}

/**
 * 创建测试配置数据
 */
function createTestProvider(overrides = {}) {
  return {
    alias: 'test-provider',
    apiUrl: 'https://api.test.com',
    apiKey: 'test-key-123',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 创建测试配置目录结构
 */
async function setupTestConfig(baseDir) {
  const rootDir = baseDir ? path.join(baseDir, '.cconfig') : process.env.CCONFIG_HOME;
  const configDir = rootDir;
  const providersDir = path.join(configDir, 'providers');
  
  await fs.ensureDir(configDir);
  await fs.ensureDir(providersDir);
  
  // 创建默认配置文件
  await fs.writeJson(path.join(configDir, 'config.json'), {
    defaultProvider: null
  });
  
  return {
    configDir,
    providersDir
  };
}

/**
 * 验证文件权限
 */
async function checkFilePermissions(filePath, expectedMode = 0o600) {
  const stats = await fs.stat(filePath);
  const actualMode = stats.mode & parseInt('777', 8);
  return actualMode === expectedMode;
}

module.exports = {
  createTempTestDir,
  cleanupTempDir,
  createTestProvider,
  setupTestConfig,
  checkFilePermissions
};
