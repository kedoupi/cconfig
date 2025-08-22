#!/usr/bin/env node

const CLIFramework = require('../src/core/CLIFramework');
const { handleError } = require('../src/utils/errorHandler');

// 导入命令模块
const providerCommands = require('../src/commands/provider');
const aliasCommands = require('../src/commands/alias');
const deployCommands = require('../src/commands/deploy');
const wizardCommands = require('../src/commands/wizard');

/**
 * 创建和配置 CLI 应用
 */
async function createApp() {
  const cli = new CLIFramework({
    name: 'cc-config',
    description: 'Claude Code 配置工具集 - 支持多服务商API切换和配置管理',
    logLevel: 'info',
    enableFileLogging: true,
  });

  // 设置帮助配置
  cli.configureHelp({
    sortSubcommands: true,
    subcommandTerm: cmd => cmd.name() + (cmd.alias() ? `|${cmd.alias()}` : ''),
  });

  // 添加全局错误处理
  cli.addErrorHandler(error => {
    handleError(error);
    process.exit(1);
  });

  // 注册服务商管理命令
  registerProviderCommands(cli);

  // 注册别名管理命令
  registerAliasCommands(cli);

  // 注册部署管理命令
  registerDeployCommands(cli);

  // 注册向导命令
  registerWizardCommands(cli);

  // 注册备份管理命令
  registerBackupCommands(cli);

  // 注册系统命令
  registerSystemCommands(cli);

  return cli;
}

/**
 * 注册服务商管理命令
 */
function registerProviderCommands(cli) {
  const providerCmd = cli.commandGroup('provider', '服务商配置管理').alias('p');

  providerCmd
    .command('add')
    .description('添加新的服务商配置')
    .option('-i, --interactive', '交互式配置模式', true)
    .option('--name <name>', '服务商名称')
    .option('--alias <alias>', '服务商别名')
    .option('--url <url>', 'API基础URL')
    .option('--key <key>', 'API密钥')
    .option('--timeout <timeout>', '请求超时时间(秒)', '30')
    .action(async options => {
      cli.log('info', 'Adding new provider...');
      await providerCommands.add(options);
    });

  providerCmd
    .command('list')
    .description('列出所有配置的服务商')
    .option('-d, --detail', '显示详细信息', false)
    .action(async options => {
      cli.log('debug', 'Listing providers...');
      await providerCommands.list(options);
    });

  providerCmd
    .command('edit <name>')
    .description('编辑指定服务商配置')
    .action(async (name, options) => {
      cli.log('info', `Editing provider: ${name}`);
      await providerCommands.edit(name, options);
    });

  providerCmd
    .command('remove <name>')
    .description('删除指定服务商配置')
    .option('-f, --force', '强制删除无需确认', false)
    .action(async (name, options) => {
      cli.log('info', `Removing provider: ${name}`);
      await providerCommands.remove(name, options);
    });

  providerCmd
    .command('test <name>')
    .description('测试服务商配置')
    .action(async (name, options) => {
      cli.log('info', `Testing provider: ${name}`);
      await providerCommands.test(name, options);
    });

  providerCmd
    .command('stats')
    .description('显示服务商统计信息')
    .action(async options => {
      cli.log('debug', 'Getting provider stats...');
      await providerCommands.stats(options);
    });

  providerCmd
    .command('wizard')
    .description('交互式服务商配置向导')
    .option(
      '-m, --mode <mode>',
      '配置模式 (template|quick|advanced)',
      'template'
    )
    .action(async options => {
      cli.log('info', 'Starting provider configuration wizard...');
      await wizardCommands.wizard(options);
    });
}

/**
 * 注册别名管理命令
 */
function registerAliasCommands(cli) {
  const aliasCmd = cli.commandGroup('alias', '别名配置管理').alias('a');

  aliasCmd
    .command('generate')
    .description('生成Shell别名配置')
    .option('-o, --output <file>', '输出文件路径')
    .action(async options => {
      cli.log('info', 'Generating aliases...');
      await aliasCommands.generate(options);
    });

  aliasCmd
    .command('install')
    .description('安装别名到Shell配置文件')
    .option('--shell <shell>', '指定Shell类型 (bash|zsh|fish)')
    .action(async options => {
      cli.log('info', 'Installing aliases to shell...');
      await aliasCommands.install(options);
    });

  aliasCmd
    .command('uninstall')
    .description('从Shell配置文件中移除别名')
    .action(async options => {
      cli.log('info', 'Uninstalling aliases...');
      await aliasCommands.uninstall(options);
    });

  aliasCmd
    .command('list')
    .description('列出所有可用别名')
    .action(async options => {
      cli.log('debug', 'Listing aliases...');
      await aliasCommands.list(options);
    });

  aliasCmd
    .command('stats')
    .description('显示别名统计信息')
    .action(async options => {
      cli.log('debug', 'Getting alias stats...');
      await aliasCommands.stats(options);
    });
}

/**
 * 注册部署管理命令
 */
function registerDeployCommands(cli) {
  const deployCmd = cli.commandGroup('deploy', '配置模板部署管理').alias('d');

  deployCmd
    .command('run [template]')
    .description('部署配置模板')
    .option('-f, --force', '跳过现有配置检查', false)
    .option('-o, --overwrite', '覆盖现有文件', false)
    .option('-t, --template <name>', '指定模板名称')
    .action(async (template, options) => {
      cli.log(
        'info',
        `Deploying template: ${template || options.template || 'default'}`
      );
      await deployCommands.deploy({
        template: template || options.template,
        force: options.force,
        overwrite: options.overwrite,
      });
    });

  deployCmd
    .command('list')
    .description('列出可用配置模板')
    .action(async () => {
      cli.log('debug', 'Listing deployment templates...');
      await deployCommands.listTemplates();
    });

  deployCmd
    .command('show <template>')
    .description('显示模板详情')
    .action(async template => {
      cli.log('debug', `Showing template: ${template}`);
      await deployCommands.showTemplate(template);
    });
}

/**
 * 注册向导命令
 */
function registerWizardCommands(cli) {
  // 独立的向导命令 (更方便的访问)
  cli
    .command('wizard')
    .description('🧙‍♂️ 启动配置向导')
    .option(
      '-m, --mode <mode>',
      '配置模式 (template|quick|advanced)',
      'template'
    )
    .action(async options => {
      cli.log('info', 'Starting configuration wizard...');
      await wizardCommands.wizard(options);
    });
}

/**
 * 注册备份管理命令
 */
function registerBackupCommands(cli) {
  const backupCmd = cli.commandGroup('backup', '配置备份管理').alias('b');

  backupCmd
    .command('create [description]')
    .description('创建配置备份')
    .action(async description => {
      cli.log('info', 'Creating backup...');
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      const timestamp = await configManager.createBackup(
        description || '手动备份'
      );
      cli.log('info', `Backup created successfully: ${timestamp}`);
    });

  backupCmd
    .command('list')
    .description('列出所有备份')
    .action(async () => {
      cli.log('debug', 'Listing backups...');
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      const history = await configManager.readHistory();

      if (history.backups.length === 0) {
        console.log('📝 暂无备份记录');
        console.log('💡 使用 "cc-config backup create" 创建新的备份');
        return;
      }

      console.log('📋 备份列表:\n');
      console.log(`总计: ${history.backups.length} 个备份\n`);

      history.backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.timestamp}`);
        console.log(`   描述: ${backup.description}`);
        console.log(`   时间: ${new Date(backup.created).toLocaleString()}`);
        console.log(`   大小: ${(backup.size / 1024).toFixed(2)} KB`);
        console.log();
      });
    });

  backupCmd
    .command('restore <timestamp>')
    .description('恢复指定备份')
    .action(async timestamp => {
      cli.log('info', `Restoring backup: ${timestamp}`);
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      await configManager.restoreBackup(timestamp);
      cli.log('info', 'Backup restored successfully');
    });
}

/**
 * 注册系统命令
 */
function registerSystemCommands(cli) {
  // 初始化命令
  cli
    .command('init')
    .description('初始化配置目录和默认配置')
    .option('-f, --force', '强制重新初始化', false)
    .action(async options => {
      cli.log('info', 'Initializing configuration...');
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      await configManager.initialize(options.force);
      cli.log('info', 'Configuration initialized successfully');
      cli.log('info', `Configuration directory: ${configManager.configDir}`);

      // 显示下一步提示
      console.log('\n📋 下一步操作:');
      console.log('1. 添加服务商配置: cc-config provider add');
      console.log('2. 生成别名配置: cc-config alias generate');
      console.log('3. 安装别名到Shell: cc-config alias install');
    });

  // 状态信息命令
  cli
    .command('status')
    .description('显示配置状态信息')
    .action(async () => {
      cli.log('debug', 'Getting system status...');

      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      // 获取系统状态
      const cliStatus = await cli.getStatus();
      const paths = configManager.getPaths();

      console.log('🔧 Claude Code Kit 状态信息\n');
      console.log(`版本: ${cli.version}`);
      console.log(`配置目录: ${cli.configDir}`);
      console.log(
        `初始化状态: ${cliStatus.initialized ? '✅ 已初始化' : '❌ 未初始化'}`
      );

      if (cliStatus.configDirSize !== undefined) {
        console.log(
          `配置目录大小: ${(cliStatus.configDirSize / 1024).toFixed(2)} KB`
        );
        console.log(
          `最后修改: ${cliStatus.configDirModified.toLocaleString()}`
        );
      }

      console.log('\n📁 目录结构:');
      console.log(`   配置: ${paths.configDir}`);
      console.log(`   服务商: ${paths.providersDir}`);
      console.log(`   别名: ${paths.aliasesFile}`);
      console.log(`   备份: ${paths.backupDir}`);
      console.log(`   日志: ${cli.logDir}`);
      console.log(`   缓存: ${cli.cacheDir}`);

      // 获取服务商统计
      try {
        const ProviderManager = require('../src/core/ProviderManager');
        const providerManager = new ProviderManager();
        const providers = await providerManager.getProviders();
        const stats = await providerManager.getStats();

        console.log('\n🌐 服务商配置:');
        console.log(`   总数: ${stats.total}`);
        console.log(`   启用: ${stats.enabled}`);
        console.log(`   禁用: ${stats.disabled}`);

        if (stats.total > 0) {
          console.log('   列表:');
          Object.entries(providers).forEach(([name, config]) => {
            const status = config.enabled ? '🟢' : '🔴';
            console.log(`     ${status} ${name} (${config.alias})`);
          });
        }
      } catch (error) {
        cli.log('debug', `Failed to get provider stats: ${error.message}`);
      }

      // 获取备份信息
      try {
        const history = await configManager.readHistory();
        console.log('\n💾 备份信息:');
        console.log(`   备份数量: ${history.backups.length}`);
        if (history.backups.length > 0) {
          const latest = history.backups[history.backups.length - 1];
          console.log(`   最新备份: ${latest.timestamp}`);
          console.log(`   备份描述: ${latest.description}`);
        }
      } catch (error) {
        cli.log('debug', `Failed to get backup info: ${error.message}`);
      }
    });

  // 清理命令
  cli
    .command('cleanup')
    .description('清理缓存和临时文件')
    .action(async () => {
      cli.log('info', 'Starting cleanup...');
      const success = await cli.cleanup();
      if (success) {
        cli.log('info', 'Cleanup completed successfully');
      } else {
        cli.log('error', 'Cleanup failed');
        process.exit(1);
      }
    });

  // 配置命令
  cli
    .command('config')
    .description('显示配置信息')
    .action(() => {
      const config = cli.getConfig();
      console.log('⚙️  CLI 配置信息:\n');
      console.log(`名称: ${config.name}`);
      console.log(`版本: ${config.version}`);
      console.log(`配置目录: ${config.configDir}`);
      console.log(`日志目录: ${config.logDir}`);
      console.log(`缓存目录: ${config.cacheDir}`);
      console.log(`日志级别: ${config.logLevel}`);
      console.log(`文件日志: ${config.enableFileLogging ? '启用' : '禁用'}`);
    });
}

/**
 * 主函数
 */
async function main() {
  try {
    const cli = await createApp();

    // 添加帮助信息
    cli.addHelpText(
      'after',
      `
示例:
  $ cc-config wizard                    # 启动配置向导
  $ cc-config provider add              # 添加服务商
  $ cc-config alias install             # 安装别名到 Shell
  $ cc-config status                    # 查看状态信息

更多信息请访问: https://github.com/kedoupi/claude-code-kit`
    );

    await cli.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createApp, main };
