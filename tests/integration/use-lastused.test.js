/**
 * Integration: `use` updates lastUsed and defaultProvider
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createTempTestDir, cleanupTempDir, setupTestConfig, createTestProvider } = require('../helpers/testUtils');

describe('use command updates lastUsed', () => {
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

  test('should set defaultProvider and update lastUsed', async () => {
    const { providersDir, configDir } = await setupTestConfig(tempDir);
    const provider = createTestProvider({ alias: 'p1' });
    const providerFile = path.join(providersDir, `${provider.alias}.json`);
    await fs.writeJson(providerFile, provider);

    // Run use command
    const cliPath = path.resolve(__dirname, '../../bin/cconfig.js');
    execSync(`node ${cliPath} use ${provider.alias}`, { encoding: 'utf8', env: { ...process.env, HOME: tempDir } });

    // Assert config defaultProvider
    const cfg = await fs.readJson(path.join(configDir, 'config.json'));
    expect(cfg.defaultProvider).toBe(provider.alias);

    // Assert lastUsed updated
    const saved = await fs.readJson(providerFile);
    expect(saved.lastUsed).toBeTruthy();
    const t = Date.parse(saved.lastUsed);
    expect(Number.isNaN(t)).toBe(false);
  });
});
