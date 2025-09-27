/**
 * Integration: status command
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createTempTestDir, cleanupTempDir, setupTestConfig, createTestProvider } = require('../helpers/testUtils');

describe('status command', () => {
  let tempDir;
  let originalHome;
  let cliPath;
  let originalCconfigHome;

  beforeEach(async () => {
    tempDir = await createTempTestDir();
    originalHome = process.env.HOME;
    originalCconfigHome = process.env.CCONFIG_HOME;
    process.env.HOME = tempDir;
    process.env.CCONFIG_HOME = path.join(tempDir, '.cconfig');
    cliPath = path.resolve(__dirname, '../../bin/cconfig.js');
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.CCONFIG_HOME = originalCconfigHome;
    await cleanupTempDir(tempDir);
  });

  test('should show zero providers and no default', async () => {
    await setupTestConfig(tempDir);
    const out = execSync(`node ${cliPath} status`, { encoding: 'utf8', env: { ...process.env, HOME: tempDir } });
    expect(out).toContain('系统状态');
    expect(out).toMatch(/配置数量:\s*0/);
    expect(out).toMatch(/默认配置:\s*无/);
  });

  test('should show providers count and default alias', async () => {
    const { providersDir, configDir } = await setupTestConfig(tempDir);
    const p = createTestProvider({ alias: 'p1' });
    // simulate lastUsed ~90 seconds ago
    p.lastUsed = new Date(Date.now() - 90 * 1000).toISOString();
    await fs.writeJson(path.join(providersDir, 'p1.json'), p);
    await fs.writeJson(path.join(configDir, 'config.json'), { defaultProvider: 'p1' });

    const out = execSync(`node ${cliPath} status --detailed`, { encoding: 'utf8', env: { ...process.env, HOME: tempDir } });
    expect(out).toMatch(/配置数量:\s*1/);
    expect(out).toMatch(/默认配置:\s*p1/);
    expect(out).toMatch(/- \[默认\] p1 ->/);
    // relative time string in Chinese, e.g., "分钟前"
    expect(out).toMatch(/lastUsed:\s*(刚刚|\d+ 分钟前|\d+ 小时前|\d+ 天前|\d{4}-|\d{1,2}\/\d{1,2}\/\d{2,4})/);
  });
});
