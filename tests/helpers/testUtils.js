const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * 创建临时测试目录
 */
async function createTempDir(prefix = 'claude-code-test-') {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return tempDir;
}

/**
 * 清理临时测试目录
 */
async function cleanupTempDir(tempDir) {
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
}

/**
 * 创建模拟的配置文件
 */
async function createMockConfig(tempDir, config) {
  const configPath = path.join(tempDir, '.claude', 'settings.json');
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config);
  return configPath;
}

/**
 * 创建模拟的服务商配置
 */
function createMockProvider(overrides = {}) {
  return {
    name: 'test-provider',
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com',
    enabled: true,
    alias: 'test',
    ...overrides,
  };
}

/**
 * 延迟执行
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 捕获控制台输出
 */
function captureConsole() {
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => logs.push({ type: 'log', args });
  console.error = (...args) => logs.push({ type: 'error', args });
  console.warn = (...args) => logs.push({ type: 'warn', args });

  return {
    getLogs: () => logs,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

module.exports = {
  createTempDir,
  cleanupTempDir,
  createMockConfig,
  createMockProvider,
  delay,
  captureConsole,
};