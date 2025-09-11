/**
 * Integration: doctor command
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createTempTestDir, cleanupTempDir, setupTestConfig } = require('../helpers/testUtils');

describe('doctor command', () => {
  let tempDir;
  let originalHome;
  let cliPath;

  beforeEach(async () => {
    tempDir = await createTempTestDir();
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    cliPath = path.resolve(__dirname, '../../bin/cconfig.js');
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
  });

  test('should warn invalid default and fix it with --fix', async () => {
    const { configDir } = await setupTestConfig(tempDir);
    // Set invalid defaultProvider
    await fs.writeJson(path.join(configDir, 'config.json'), { defaultProvider: 'missing' });

    const out1 = execSync(`node ${cliPath} doctor`, { encoding: 'utf8', env: { ...process.env, HOME: tempDir } });
    expect(out1).toMatch(/默认配置无效/);
    expect(out1).toMatch(/使用 --fix 可尝试自动修复/);

    const out2 = execSync(`node ${cliPath} doctor --fix`, { encoding: 'utf8', env: { ...process.env, HOME: tempDir } });
    expect(out2).toMatch(/已清空默认配置/);

    const cfg = await fs.readJson(path.join(configDir, 'config.json'));
    expect(cfg.defaultProvider).toBeNull();
  });
});

