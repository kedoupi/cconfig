jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');

const config = require('../../lib/config');
const { commands } = require('../../bin/cconfig.js');

describe('CLI executable coverage', () => {
  let logSpy;
  let errorSpy;
  let exitSpy;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await fs.remove(config.CONFIG_DIR);
    await fs.ensureDir(config.CONFIG_DIR);
    await fs.ensureDir(config.PROVIDERS_DIR);
    await fs.writeJson(config.CONFIG_FILE, { defaultProvider: null });

    inquirer.prompt.mockReset();
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    await fs.remove(config.CONFIG_DIR);
  });

  test('add command handles setup failure gracefully', async () => {
    const ensureSpy = jest
      .spyOn(config, 'ensureDirectories')
      .mockRejectedValue(new Error('permission denied'));

    await expect(commands.addProvider()).rejects.toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalled();

    ensureSpy.mockRestore();
  });

  test('list command shows guidance when no providers exist', async () => {
    await commands.listProviders();
    expect(logSpy).toHaveBeenCalledWith('📝 No providers configured');
    expect(logSpy).toHaveBeenCalledWith('   Run: cconfig add');
  });

  test('add prompt validates alias, URL, and API key', async () => {
    const duplicatePath = path.join(config.PROVIDERS_DIR, 'p1.json');
    await fs.writeJson(duplicatePath, { alias: 'p1' });

    inquirer.prompt.mockImplementation(async questions => {
      const aliasQuestion = questions.find(q => q.name === 'alias');
      const apiUrlQuestion = questions.find(q => q.name === 'apiUrl');
      const apiKeyQuestion = questions.find(q => q.name === 'apiKey');

      await expect(aliasQuestion.validate('bad alias')).resolves.toMatch('别名仅允许');
      await expect(aliasQuestion.validate('p1')).resolves.toMatch('别名已存在');
      await expect(aliasQuestion.validate('valid_alias')).resolves.toBe(true);

      expect(apiUrlQuestion.validate('ftp://bad.example')).toBe('请输入有效的 HTTP 或 HTTPS URL');
      expect(apiUrlQuestion.validate('https://good.example')).toBe(true);

      expect(apiKeyQuestion.validate('   ')).toBe('API Key is required');
      expect(apiKeyQuestion.validate('secret')).toBe(true);

      return {
        alias: 'valid_alias',
        apiUrl: 'https://good.example',
        apiKey: 'secret',
      };
    });

    await commands.addProvider();

    const stored = await fs.readJson(path.join(config.PROVIDERS_DIR, 'valid_alias.json'));
    expect(stored.alias).toBe('valid_alias');
  });

  test('supports end-to-end command workflow without interactive input', async () => {
    inquirer.prompt
      .mockResolvedValueOnce({
        alias: 'p1',
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'key-1',
      })
      .mockResolvedValueOnce({
        apiUrl: 'https://api.updated.com',
        apiKey: 'key-2',
      })
      .mockResolvedValueOnce({
        confirm: true,
      });

    await commands.addProvider();

    // 手动写入一个不合规的 Provider 以触发 doctor --fix 分支
    const invalidProviderPath = path.join(config.PROVIDERS_DIR, 'p2.json');
    await fs.writeJson(invalidProviderPath, {
      alias: 'mismatch',
      apiUrl: 'ftp://invalid.example',
      apiKey: '',
    });

    // 覆盖列表、状态、env、doctor、edit、use、remove 等命令分支
    await commands.listProviders();
    await commands.statusCommand({ detailed: true });
    await commands.useProvider('p1');
    await commands.outputEnv({ provider: 'p1', shell: 'bash' });
    await commands.doctorCommand({ fix: true });
    await commands.editProvider('p1');
    await commands.removeProvider('p1');

    // 校验默认配置已清空，p1 删除成功
    const configJson = await fs.readJson(config.CONFIG_FILE);
    expect(configJson.defaultProvider).toBeNull();
    expect(await fs.pathExists(path.join(config.PROVIDERS_DIR, 'p1.json'))).toBe(false);

    // doctor --fix 应修复别名不一致问题
    const repaired = await fs.readJson(invalidProviderPath);
    expect(repaired.alias).toBe('p2');

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
