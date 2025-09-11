/**
 * Integration: doctor validation checks
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createTempTestDir, cleanupTempDir, setupTestConfig } = require('../helpers/testUtils');

describe('doctor validation', () => {
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

  test('warns on empty apiKey and alias mismatch, and fixes alias with --fix', async () => {
    const { providersDir } = await setupTestConfig(tempDir);
    // alias mismatch in filename vs content
    await fs.writeJson(path.join(providersDir, 'p3.json'), {
      alias: 'mismatch',
      apiUrl: 'https://api.test.com',
      apiKey: '',
    });
    // invalid URL: unsupported protocol
    await fs.writeJson(path.join(providersDir, 'p2.json'), {
      alias: 'p2',
      apiUrl: 'ftp://example.com',
      apiKey: 'k',
    });

    const env = { ...process.env, HOME: tempDir };
    const out = execSync(`node ${cliPath} doctor`, { encoding: 'utf8', env });
    expect(out).toMatch(/结构警告: p3.json 别名与文件名不一致/);
    expect(out).toMatch(/结构警告: p3.json API Key 为空/);
    expect(out).toMatch(/结构警告: p2.json URL 无效/);

    execSync(`node ${cliPath} doctor --fix`, { encoding: 'utf8', env });
    const p3 = await fs.readJson(path.join(providersDir, 'p3.json'));
    expect(p3.alias).toBe('p3');
  });
});
