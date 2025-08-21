#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

// 导入命令模块
const providerCommands = require('../src/commands/provider');
const aliasCommands = require('../src/commands/alias');
const deployCommands = require('../src/commands/deploy');
const wizardCommands = require('../src/commands/wizard');
const {
  handleError,
  setupGlobalErrorHandlers,
} = require('../src/utils/errorHandler');

// 设置全局错误处理
setupGlobalErrorHandlers();

// CLI 主程序
program
  .name('cc-config')
  .description('Claude Code 配置工具集 - 支持多服务商API切换和配置管理')
  .version(pkg.version, '-v, --version', '显示版本号');

// 服务商管理命令
const providerCmd = program
  .command('provider')
  .description('服务商配置管理')
  .alias('p');

providerCmd
  .command('add')
  .description('添加新的服务商配置')
  .option('-i, --interactive', '交互式配置模式', true)
  .option('--name <name>', '服务商名称')
  .option('--alias <alias>', '服务商别名')
  .option('--url <url>', 'API基础URL')
  .option('--key <key>', 'API密钥')
  .option('--timeout <timeout>', '请求超时时间(秒)', '30')
  .action(providerCommands.add);

providerCmd
  .command('list')
  .description('列出所有配置的服务商')
  .option('-d, --detail', '显示详细信息', false)
  .action(providerCommands.list);

providerCmd
  .command('edit <name>')
  .description('编辑指定服务商配置')
  .action(providerCommands.edit);

providerCmd
  .command('remove <name>')
  .description('删除指定服务商配置')
  .option('-f, --force', '强制删除无需确认', false)
  .action(providerCommands.remove);

providerCmd
  .command('test <name>')
  .description('测试服务商配置')
  .action(providerCommands.test);

providerCmd
  .command('stats')
  .description('显示服务商统计信息')
  .action(providerCommands.stats);

providerCmd
  .command('wizard')
  .description('交互式服务商配置向导')
  .option('-m, --mode <mode>', '配置模式 (template|quick|advanced)', 'template')
  .action(async options => {
    try {
      await wizardCommands.wizard(options);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 独立的向导命令 (更方便的访问)
program
  .command('wizard')
  .description('🧙‍♂️ 启动配置向导')
  .option('-m, --mode <mode>', '配置模式 (template|quick|advanced)', 'template')
  .action(async options => {
    try {
      await wizardCommands.wizard(options);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 别名管理命令
const aliasCmd = program
  .command('alias')
  .description('别名配置管理')
  .alias('a');

aliasCmd
  .command('generate')
  .description('生成Shell别名配置')
  .option('-s, --shell <shell>', 'Shell类型 (bash/zsh)', null)
  .option('-f, --force', '强制重新生成', false)
  .action(aliasCommands.generate);

aliasCmd
  .command('install')
  .description('安装别名到Shell配置')
  .option('-s, --shell <shell>', 'Shell类型 (bash/zsh)', null)
  .option('-f, --force', '强制重新安装', false)
  .action(aliasCommands.install);

aliasCmd
  .command('uninstall')
  .description('从Shell配置中移除别名')
  .action(aliasCommands.uninstall);

aliasCmd
  .command('validate')
  .description('验证别名配置')
  .action(aliasCommands.validate);

aliasCmd
  .command('stats')
  .description('显示别名统计信息')
  .action(aliasCommands.stats);

// 备份管理命令
const backupCmd = program
  .command('backup')
  .description('配置备份管理')
  .alias('b');

backupCmd
  .command('create [description]')
  .description('创建配置备份')
  .action(async description => {
    try {
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      const timestamp = await configManager.createBackup(
        description || '手动备份'
      );
      console.log(chalk.green('✅ 备份创建成功:'), timestamp);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

backupCmd
  .command('list')
  .description('列出所有备份')
  .action(async () => {
    try {
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      const history = await configManager.readHistory();

      if (history.backups.length === 0) {
        console.log(chalk.yellow('📝 暂无备份记录'));
        return;
      }

      console.log(chalk.blue('📋 备份列表:\n'));
      history.backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.timestamp}`);
        console.log(`   描述: ${backup.description}`);
        console.log(`   时间: ${new Date(backup.created).toLocaleString()}`);
        console.log(`   大小: ${(backup.size / 1024).toFixed(2)} KB`);
        console.log();
      });
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

backupCmd
  .command('restore <timestamp>')
  .description('恢复指定备份')
  .action(async timestamp => {
    try {
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      await configManager.restoreBackup(timestamp);
      console.log(chalk.green('✅ 备份恢复成功'));
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 配置部署命令
const deployCmd = program
  .command('deploy')
  .description('配置模板部署管理')
  .alias('d');

deployCmd
  .command('run [template]')
  .description('部署配置模板')
  .option('-f, --force', '跳过现有配置检查', false)
  .option('-o, --overwrite', '覆盖现有文件', false)
  .option('-t, --template <name>', '指定模板名称')
  .action(async (template, options) => {
    try {
      await deployCommands.deploy({
        template: template || options.template,
        force: options.force,
        overwrite: options.overwrite,
      });
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

deployCmd
  .command('list')
  .description('列出可用配置模板')
  .action(async () => {
    try {
      await deployCommands.listTemplates();
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

deployCmd
  .command('show <template>')
  .description('显示模板详情')
  .action(async template => {
    try {
      await deployCommands.showTemplate(template);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 初始化命令
program
  .command('init')
  .description('初始化配置目录和默认配置')
  .option('-f, --force', '强制重新初始化', false)
  .action(async options => {
    try {
      const ConfigManager = require('../src/core/ConfigManager');
      const configManager = new ConfigManager();

      await configManager.initialize(options.force);
      console.log(chalk.green('✅ 配置初始化成功'));
      console.log(chalk.blue('ℹ️  配置目录:'), configManager.configDir);

      // 显示下一步提示
      console.log(chalk.yellow('\n📋 下一步操作:'));
      console.log('1. 添加服务商配置: cc-config provider add');
      console.log('2. 生成别名配置: cc-config alias generate');
      console.log('3. 安装别名到Shell: cc-config alias install');
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 状态信息命令
program
  .command('status')
  .description('显示当前配置状态')
  .action(async () => {
    try {
      const ConfigManager = require('../src/core/ConfigManager');
      const ProviderManager = require('../src/core/ProviderManager');
      const AliasGenerator = require('../src/core/AliasGenerator');

      const configManager = new ConfigManager();
      const providerManager = new ProviderManager();
      const aliasGenerator = new AliasGenerator(configManager);

      console.log(chalk.blue('📊 Claude Code Kit 状态信息\n'));

      // 配置目录信息
      const paths = configManager.getPaths();
      console.log(chalk.green('📁 配置目录:'));
      console.log(`   主目录: ${paths.configDir}`);
      console.log(`   服务商: ${paths.providersDir}`);
      console.log(`   备份: ${paths.backupDir}`);
      console.log(`   别名: ${paths.aliasesFile}`);
      console.log();

      // 服务商统计
      const stats = await providerManager.getStats();
      console.log(chalk.green('🌐 服务商统计:'));
      console.log(`   总数: ${stats.total}`);
      console.log(`   启用: ${stats.enabled}`);
      console.log(`   禁用: ${stats.disabled}`);
      console.log(`   已配置密钥: ${stats.withApiKey}`);
      console.log();

      // 别名信息
      const aliasStats = await aliasGenerator.getAliasStats();
      console.log(chalk.green('🔗 别名信息:'));
      console.log(`   可用别名: ${aliasStats.enabled}`);
      if (aliasStats.aliases.length > 0) {
        aliasStats.aliases.forEach(alias => {
          const status = alias.enabled ? '✅' : '❌';
          console.log(
            `   ${status} ${alias.alias} - ${alias.description || '无描述'}`
          );
        });
      }
      console.log();

      // 备份信息
      const history = await configManager.readHistory();
      console.log(chalk.green('💾 备份信息:'));
      console.log(`   备份数量: ${history.backups.length}`);
      if (history.backups.length > 0) {
        const latest = history.backups[history.backups.length - 1];
        console.log(`   最新备份: ${latest.timestamp} (${latest.description})`);
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// 错误处理
program.exitOverride(err => {
  handleError(err);
  process.exit(1);
});

// 未知命令处理
program.on('command:*', () => {
  console.error(chalk.red('❌ 未知命令:'), program.args.join(' '));
  console.log();
  program.help();
});

// 解析命令行参数
program.parse();

// 如果没有提供任何参数，显示帮助信息
if (!process.argv.slice(2).length) {
  console.log(chalk.blue.bold('🔧 Claude Code Kit 配置工具\n'));
  program.help();
}
