const AliasGenerator = require('../../../src/core/AliasGenerator');
const ConfigStorage = require('../../../src/core/ConfigStorage');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { createTempDir, cleanupTempDir } = require('../../helpers/testUtils');

describe('AliasGenerator', () => {
  let tempDir;
  let configStorage;
  let aliasGenerator;
  let originalHome;

  beforeEach(async () => {
    tempDir = await createTempDir();
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    configStorage = new ConfigStorage({
      baseDir: path.join(tempDir, '.cc-config'),
    });
    
    aliasGenerator = new AliasGenerator(configStorage);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('应该正确初始化 AliasGenerator', () => {
      expect(aliasGenerator.configStorage).toBe(configStorage);
      expect(aliasGenerator.aliasesFile).toBe(path.join(tempDir, '.cc-config', 'aliases.sh'));
      expect(aliasGenerator.sourceCommand).toBe('source ~/.cc-config/aliases.sh');
    });

    test('应该设置正确的 Shell 配置文件路径', () => {
      expect(aliasGenerator.profileFiles.bash).toBe(path.join(tempDir, '.bashrc'));
      expect(aliasGenerator.profileFiles.zsh).toBe(path.join(tempDir, '.zshrc'));
      expect(aliasGenerator.profileFiles.fish).toBe(path.join(tempDir, '.config', 'fish', 'config.fish'));
    });
  });

  describe('detectShell', () => {
    test('应该检测 zsh', () => {
      process.env.SHELL = '/bin/zsh';
      expect(aliasGenerator.detectShell()).toBe('zsh');
    });

    test('应该检测 bash', () => {
      process.env.SHELL = '/bin/bash';
      expect(aliasGenerator.detectShell()).toBe('bash');
    });

    test('应该检测 fish', () => {
      process.env.SHELL = '/usr/bin/fish';
      expect(aliasGenerator.detectShell()).toBe('fish');
    });

    test('应该默认返回 bash', () => {
      process.env.SHELL = '/unknown/shell';
      expect(aliasGenerator.detectShell()).toBe('bash');
    });
  });

  describe('sanitizeAlias', () => {
    test('应该清理无效字符', () => {
      expect(aliasGenerator.sanitizeAlias('test@#$')).toBe('test');
      expect(aliasGenerator.sanitizeAlias('test-name_123')).toBe('test-name_123');
      expect(aliasGenerator.sanitizeAlias('test spaces')).toBe('testspaces');
    });
  });

  describe('generateHeader', () => {
    test('应该生成包含版本信息的头部', () => {
      const header = aliasGenerator.generateHeader();
      
      expect(header).toContain('#!/bin/bash');
      expect(header).toContain('Claude Code Kit - 自动生成的别名配置');
      expect(header).toContain('生成时间:');
      expect(header).toContain('使用方法：');
      expect(header).toContain('管理命令：');
    });
  });

  describe('generateHelperFunction', () => {
    test('应该生成配置加载辅助函数', () => {
      const helpers = aliasGenerator.generateHelperFunction();
      
      expect(helpers).toContain('_cc_load_config()');
      expect(helpers).toContain('_cc_show_config()');
      expect(helpers).toContain('_cc_test_config()');
      expect(helpers).toContain('_cc_reload_aliases()');
      expect(helpers).toContain('cc-config provider get');
    });
  });

  describe('generateFooter', () => {
    test('应该生成脚本尾部', () => {
      const footer = aliasGenerator.generateFooter();
      
      expect(footer).toContain('脚本完成标记');
      expect(footer).toContain('CC_ALIASES_LOADED');
      expect(footer).toContain('Claude Code Kit 别名已加载');
    });
  });

  describe('generateEmptyScript', () => {
    test('应该生成空脚本框架', () => {
      const script = aliasGenerator.generateEmptyScript();
      
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('暂无启用的服务商配置');
      expect(script).toContain('cc-config provider add');
      expect(script).toContain('CC_ALIASES_LOADED');
    });
  });

  describe('generateAliasCommands', () => {
    test('应该为服务商生成别名命令', () => {
      const providers = [
        ['claude', {
          alias: 'claude',
          baseURL: 'https://api.anthropic.com',
          description: 'Anthropic Claude API',
          enabled: true,
        }],
        ['openai', {
          alias: 'gpt',
          baseURL: 'https://api.openai.com',
          description: 'OpenAI GPT API',
          enabled: true,
        }],
      ];

      const aliases = aliasGenerator.generateAliasCommands(providers);
      
      expect(aliases).toContain('alias claude=');
      expect(aliases).toContain('alias claude-info=');
      expect(aliases).toContain('alias claude-test=');
      expect(aliases).toContain('alias gpt=');
      expect(aliases).toContain('alias gpt-info=');
      expect(aliases).toContain('alias gpt-test=');
      
      expect(aliases).toContain('管理命令别名');
      expect(aliases).toContain('cc-providers');
      expect(aliases).toContain('cc-reload');
      expect(aliases).toContain('cc-help');
    });
  });

  describe('writeAliasFile', () => {
    test('应该写入别名文件并设置权限', async () => {
      const content = 'test content';
      
      await aliasGenerator.writeAliasFile(content);
      
      expect(await fs.pathExists(aliasGenerator.aliasesFile)).toBe(true);
      
      const fileContent = await fs.readFile(aliasGenerator.aliasesFile, 'utf8');
      expect(fileContent).toBe(content);
      
      const stats = await fs.stat(aliasGenerator.aliasesFile);
      expect(stats.mode & parseInt('777', 8)).toBe(parseInt('755', 8));
    });
  });

  describe('getAllShellConfigFiles', () => {
    test('应该返回存在的 Shell 配置文件', async () => {
      // 创建一些配置文件
      await fs.ensureFile(path.join(tempDir, '.bashrc'));
      await fs.ensureFile(path.join(tempDir, '.zshrc'));
      
      const files = aliasGenerator.getAllShellConfigFiles();
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.shell === 'bash')).toBe(true);
      expect(files.some(f => f.shell === 'zsh')).toBe(true);
    });
  });

  describe('updateSingleShellConfig', () => {
    test('应该向 Shell 配置文件添加 source 命令', async () => {
      const configFile = path.join(tempDir, '.bashrc');
      await fs.writeFile(configFile, 'export PATH=$PATH:/usr/local/bin\n');
      
      const result = await aliasGenerator.updateSingleShellConfig('bash', configFile);
      
      expect(result.updated).toBe(true);
      expect(result.message).toContain('已更新 bash 配置文件');
      
      const content = await fs.readFile(configFile, 'utf8');
      expect(content).toContain('Claude Code Kit 别名配置');
      expect(content).toContain('source ~/.cc-config/aliases.sh');
    });

    test('应该检测已存在的配置', async () => {
      const configFile = path.join(tempDir, '.bashrc');
      await fs.writeFile(configFile, `
export PATH=$PATH:/usr/local/bin

# Claude Code Kit 别名配置
source ~/.cc-config/aliases.sh
`);
      
      const result = await aliasGenerator.updateSingleShellConfig('bash', configFile, false);
      
      expect(result.updated).toBe(false);
      expect(result.message).toContain('bash 配置已存在');
    });

    test('应该在强制模式下更新已存在的配置', async () => {
      const configFile = path.join(tempDir, '.bashrc');
      await fs.writeFile(configFile, `
export PATH=$PATH:/usr/local/bin

# Claude Code Kit 别名配置
source ~/.cc-config/aliases.sh
`);
      
      const result = await aliasGenerator.updateSingleShellConfig('bash', configFile, true);
      
      expect(result.updated).toBe(true);
      expect(result.message).toContain('已更新 bash 配置文件');
    });
  });

  describe('removeSingleShellConfig', () => {
    test('应该从 Shell 配置文件中移除相关配置', async () => {
      const configFile = path.join(tempDir, '.bashrc');
      await fs.writeFile(configFile, `
export PATH=$PATH:/usr/local/bin

# Claude Code Kit 别名配置
# 自动生成于: 2023-01-01 12:00:00
source ~/.cc-config/aliases.sh

export EDITOR=vim
`);
      
      const result = await aliasGenerator.removeSingleShellConfig('bash', configFile);
      
      expect(result.removed).toBe(true);
      expect(result.message).toContain('已从 bash 配置文件中移除相关配置');
      
      const content = await fs.readFile(configFile, 'utf8');
      expect(content).not.toContain('Claude Code Kit 别名配置');
      expect(content).not.toContain('source ~/.cc-config/aliases.sh');
      expect(content).toContain('export PATH=$PATH:/usr/local/bin');
      expect(content).toContain('export EDITOR=vim');
    });

    test('应该处理不存在相关配置的情况', async () => {
      const configFile = path.join(tempDir, '.bashrc');
      await fs.writeFile(configFile, 'export PATH=$PATH:/usr/local/bin\n');
      
      const result = await aliasGenerator.removeSingleShellConfig('bash', configFile);
      
      expect(result.removed).toBe(false);
      expect(result.message).toContain('bash 配置中未找到相关配置');
    });
  });

  describe('validateAliases', () => {
    test('应该验证别名配置并返回问题报告', async () => {
      // 准备测试数据
      await configStorage.initialize();
      
      // 添加一些测试服务商
      await configStorage.writeProvider('test1', {
        alias: 'test1',
        baseURL: 'https://api.test1.com',
        apiKey: 'test-key-1',
        enabled: true,
      });
      
      await configStorage.writeProvider('test2', {
        alias: 'test1', // 重复别名
        baseURL: 'https://api.test2.com',
        apiKey: 'test-key-2',
        enabled: true,
      });
      
      await configStorage.writeProvider('test3', {
        alias: 'ls', // 与系统命令冲突
        baseURL: 'https://api.test3.com',
        apiKey: 'test-key-3',
        enabled: true,
      });
      
      const validation = await aliasGenerator.validateAliases();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(3); // 重复别名 + 系统冲突 + 缺少别名文件
      
      const duplicateIssue = validation.issues.find(i => i.type === 'duplicate_alias');
      expect(duplicateIssue).toBeDefined();
      expect(duplicateIssue.severity).toBe('error');
      
      const conflictIssue = validation.issues.find(i => i.type === 'system_conflict');
      expect(conflictIssue).toBeDefined();
      expect(conflictIssue.severity).toBe('warning');
      
      expect(validation.summary.total).toBe(3);
      expect(validation.summary.enabled).toBe(3);
      expect(validation.summary.aliasCount).toBe(3);
    });
  });

  describe('generateAliases', () => {
    test('应该生成完整的别名脚本', async () => {
      // 准备测试数据
      await configStorage.initialize();
      
      await configStorage.writeProvider('claude', {
        alias: 'claude',
        baseURL: 'https://api.anthropic.com',
        apiKey: 'test-key',
        description: 'Anthropic Claude API',
        enabled: true,
      });
      
      const script = await aliasGenerator.generateAliases();
      
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('Claude Code Kit - 自动生成的别名配置');
      expect(script).toContain('_cc_load_config()');
      expect(script).toContain('alias claude=');
      expect(script).toContain('alias claude-info=');
      expect(script).toContain('alias claude-test=');
      expect(script).toContain('CC_ALIASES_LOADED');
      
      // 验证文件已写入
      expect(await fs.pathExists(aliasGenerator.aliasesFile)).toBe(true);
    });

    test('应该为空的服务商列表生成空脚本', async () => {
      await configStorage.initialize();
      
      const script = await aliasGenerator.generateAliases();
      
      expect(script).toContain('暂无启用的服务商配置');
      expect(script).toContain('cc-config provider add');
    });
  });

  describe('getAliasStats', () => {
    test('应该返回详细的别名统计信息', async () => {
      // 准备测试数据
      await configStorage.initialize();
      
      await configStorage.writeProvider('claude', {
        alias: 'claude',
        baseURL: 'https://api.anthropic.com',
        apiKey: 'test-key',
        enabled: true,
      });
      
      await configStorage.writeProvider('gpt', {
        alias: 'gpt',
        baseURL: 'https://api.openai.com',
        apiKey: 'test-key',
        enabled: false,
      });
      
      const stats = await aliasGenerator.getAliasStats();
      
      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.withApiKeys).toBe(2);
      expect(stats.aliases).toHaveLength(2);
      expect(stats.validation).toBeDefined();
      expect(stats.shell.current).toBeDefined();
    });
  });

  describe('cleanupAliases', () => {
    test('应该清理别名文件和 Shell 配置', async () => {
      // 创建别名文件
      await fs.writeFile(aliasGenerator.aliasesFile, 'test content');
      
      // 创建 Shell 配置
      const bashConfig = path.join(tempDir, '.bashrc');
      await fs.writeFile(bashConfig, `
export PATH=$PATH:/usr/local/bin

# Claude Code Kit 别名配置
source ~/.cc-config/aliases.sh
`);
      
      const result = await aliasGenerator.cleanupAliases();
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(true);
      expect(result.details.aliasFile).toBe(true);
      
      expect(await fs.pathExists(aliasGenerator.aliasesFile)).toBe(false);
      
      const content = await fs.readFile(bashConfig, 'utf8');
      expect(content).not.toContain('Claude Code Kit 别名配置');
    });
  });

  describe('getInstallStatus', () => {
    test('应该返回完整的安装状态', async () => {
      // 创建别名文件
      await fs.writeFile(aliasGenerator.aliasesFile, 'test content');
      
      // 创建部分 Shell 配置
      await fs.writeFile(path.join(tempDir, '.bashrc'), 'export PATH=$PATH:/usr/local/bin\n');
      
      const status = await aliasGenerator.getInstallStatus();
      
      expect(status.aliasFile.exists).toBe(true);
      expect(status.shells).toHaveLength(3);
      expect(status.recommendations).toHaveLength(1); // install shell
      
      const bashShell = status.shells.find(s => s.shell === 'bash');
      expect(bashShell.exists).toBe(true);
      expect(bashShell.configured).toBe(false);
    });
  });
});