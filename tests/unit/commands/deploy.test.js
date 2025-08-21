const fs = require('fs-extra');
const path = require('path');
const deployCommands = require('../../../src/commands/deploy');
const ConfigManager = require('../../../src/core/ConfigManager');
const { createTempDir, cleanupTempDir } = require('../../helpers/testUtils');

// Mock inquirer for automated testing
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const inquirer = require('inquirer');

describe('deploy commands', () => {
  let tempDir;
  let originalHome;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    
    // Reset inquirer mock
    inquirer.prompt.mockReset();
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
  });

  describe('listTemplates', () => {
    test('应该列出所有可用模板', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await deployCommands.listTemplates();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('可用配置模板')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('claude: Claude (官方)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('minimal: 最小配置')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('development: 开发环境')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('showTemplate', () => {
    test('应该显示指定模板的详情', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await deployCommands.showTemplate('claude');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('模板详情: Claude (官方)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('settings.json')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md')
      );
      
      consoleSpy.mockRestore();
    });

    test('应该处理未知模板', async () => {
      await expect(deployCommands.showTemplate('unknown')).rejects.toThrow(
        '未知模板: unknown'
      );
    });
  });

  describe('deploy', () => {
    beforeEach(() => {
      // Clear previous mock calls
      inquirer.prompt.mockClear();
    });

    test('应该部署最小配置模板', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      try {
        // 由于使用了 force: true 和 overwrite: true，不应该有用户交互提示
        await deployCommands.deploy({ 
          template: 'minimal', 
          force: true, 
          overwrite: true 
        });
        
        // 检查文件是否创建
        const claudeDir = path.join(tempDir, '.claude');
        const settingsFile = path.join(claudeDir, 'settings.json');
        
        expect(await fs.pathExists(claudeDir)).toBe(true);
        expect(await fs.pathExists(settingsFile)).toBe(true);
        
        // 检查文件内容
        const settings = await fs.readJson(settingsFile);
        expect(settings).toHaveProperty('anthropic');
        expect(settings.anthropic).toHaveProperty('api_key', '');
        expect(settings.anthropic).toHaveProperty('base_url', 'https://api.anthropic.com');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('配置部署完成')
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    test('应该部署开发环境模板', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await deployCommands.deploy({ template: 'development', force: true, overwrite: true });
      
      const claudeDir = path.join(tempDir, '.claude');
      const settingsFile = path.join(claudeDir, 'settings.json');
      const claudeMdFile = path.join(claudeDir, 'CLAUDE.md');
      const outputStyleFile = path.join(claudeDir, 'output-styles', 'development.json');
      
      expect(await fs.pathExists(settingsFile)).toBe(true);
      expect(await fs.pathExists(claudeMdFile)).toBe(true);
      expect(await fs.pathExists(outputStyleFile)).toBe(true);
      
      // 检查设置文件内容
      const settings = await fs.readJson(settingsFile);
      expect(settings).toHaveProperty('development');
      expect(settings.development).toHaveProperty('verbose_logging', true);
      
      // 检查输出样式文件
      const outputStyle = await fs.readJson(outputStyleFile);
      expect(outputStyle).toHaveProperty('name', 'Development');
      expect(outputStyle).toHaveProperty('template');
      
      consoleSpy.mockRestore();
    });

    test('应该正确设置文件权限', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await deployCommands.deploy({ template: 'minimal', force: true, overwrite: true });
      
      const claudeDir = path.join(tempDir, '.claude');
      const settingsFile = path.join(claudeDir, 'settings.json');
      
      // 确保文件存在
      expect(await fs.pathExists(claudeDir)).toBe(true);
      expect(await fs.pathExists(settingsFile)).toBe(true);
      
      // 检查目录权限 (700 = 0o700)
      const dirStats = await fs.stat(claudeDir);
      expect((dirStats.mode & 0o777)).toBe(0o700);
      
      // 检查文件权限 (600 = 0o600)
      const fileStats = await fs.stat(settingsFile);
      expect((fileStats.mode & 0o777)).toBe(0o600);
      
      consoleSpy.mockRestore();
    });

    test('应该处理现有配置的情况', async () => {
      // 先创建一个现有配置
      const claudeDir = path.join(tempDir, '.claude');
      await fs.ensureDir(claudeDir);
      await fs.writeJson(path.join(claudeDir, 'settings.json'), { existing: true });
      
      // Mock 用户选择取消部署
      inquirer.prompt.mockResolvedValueOnce({ shouldContinue: false });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await deployCommands.deploy({ template: 'minimal' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('部署已取消')
      );
      
      consoleSpy.mockRestore();
    });
  });
});