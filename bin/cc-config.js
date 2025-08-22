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
  .command('get <name>')
  .description('获取指定服务商配置')
  .option('--json', '以JSON格式输出', false)
  .action(providerCommands.get);

providerCmd
  .command('regenerate-aliases')
  .description('重新生成别名配置')
  .option('-f, --force', '强制重新生成', false)
  .action(providerCommands.regenerateAliases);

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

backupCmd
  .command('clean')
  .description('清理旧备份文件')
  .option('-k, --keep <number>', '保留备份数量', '10')
  .option('-d, --days <number>', '保留天数', '30')
  .option('-f, --force', '强制清理无需确认', false)
  .action(async options => {
    try {
      const BackupManager = require('../src/core/BackupManager');
      const backupManager = new BackupManager();

      const result = await backupManager.cleanOldBackups({
        keepCount: parseInt(options.keep),
        keepDays: parseInt(options.days),
        force: options.force
      });

      if (result.cleaned > 0) {
        console.log(chalk.green(`✅ 已清理 ${result.cleaned} 个旧备份`));
        console.log(chalk.gray(`释放空间: ${(result.spaceFreed / 1024 / 1024).toFixed(2)} MB`));
      } else {
        console.log(chalk.blue('ℹ️  没有需要清理的备份'));
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

backupCmd
  .command('verify [timestamp]')
  .description('验证备份完整性')
  .action(async timestamp => {
    try {
      const BackupManager = require('../src/core/BackupManager');
      const backupManager = new BackupManager();

      const result = await backupManager.verifyBackup(timestamp);

      if (result.summary) {
        // 验证所有备份的汇总结果
        console.log(chalk.blue('📊 备份验证汇总'));
        console.log(`验证备份数: ${result.verified}`);
        console.log(`有效备份: ${chalk.green(result.valid)}`);
        console.log(`无效备份: ${chalk.red(result.invalid)}`);
        
        if (result.invalid > 0) {
          console.log(chalk.yellow('\n⚠️ 有备份存在问题:'));
          result.results.filter(r => !r.valid).forEach(backup => {
            console.log(`  - ${backup.timestamp}: ${backup.issues.join(', ')}`);
          });
        }
      } else if (result.valid) {
        console.log(chalk.green('✅ 备份验证通过'));
        console.log(`文件数量: ${result.fileCount || 0}`);
        console.log(`总大小: ${((result.totalSize || 0) / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.log(chalk.red('❌ 备份验证失败'));
        if (result.issues && result.issues.length > 0) {
          result.issues.forEach(issue => {
            console.log(chalk.yellow(`  ⚠️  ${issue}`));
          });
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

backupCmd
  .command('compress <timestamp>')
  .description('压缩指定备份')
  .action(async timestamp => {
    try {
      const BackupManager = require('../src/core/BackupManager');
      const backupManager = new BackupManager();

      const result = await backupManager.compressBackup(timestamp);
      
      console.log(chalk.green('✅ 备份压缩完成'));
      console.log(`原始大小: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`压缩后: ${(result.compressedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`压缩率: ${result.compressionRatio.toFixed(1)}%`);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

backupCmd
  .command('export <timestamp>')
  .description('导出备份到指定位置')
  .option('-o, --output <path>', '输出路径')
  .option('-f, --format <format>', '导出格式 (tar|zip)', 'tar')
  .action(async (timestamp, options) => {
    try {
      const BackupManager = require('../src/core/BackupManager');
      const backupManager = new BackupManager();

      const result = await backupManager.exportBackup(timestamp, {
        outputPath: options.output,
        format: options.format
      });

      console.log(chalk.green('✅ 备份导出成功'));
      console.log(`导出文件: ${result.exportPath}`);
      console.log(`文件大小: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
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

// 历史记录命令
program
  .command('history')
  .description('查看和管理配置历史')
  .option('-l, --limit <number>', '显示数量限制', '10')
  .option('-t, --type <type>', '过滤类型 (backup|deploy|all)', 'all')
  .option('--interactive', '交互式选择备份恢复', false)
  .action(async options => {
    try {
      const BackupManager = require('../src/core/BackupManager');
      const inquirer = require('inquirer');
      
      const backupManager = new BackupManager();
      const backups = await backupManager.listBackups({
        limit: parseInt(options.limit),
        sortBy: 'created'
      });

      if (backups.length === 0) {
        console.log(chalk.yellow('📝 暂无历史记录'));
        console.log(chalk.blue('💡 使用 "cc-config backup create" 创建备份'));
        return;
      }

      console.log(chalk.blue(`📚 配置历史记录 (最近${Math.min(backups.length, parseInt(options.limit))}条)\n`));

      // 显示备份列表
      backups.forEach((backup, index) => {
        const age = Math.floor((new Date() - new Date(backup.created)) / (24 * 60 * 60 * 1000));
        const sizeFormatted = (backup.totalSize / 1024 / 1024).toFixed(2);
        const statusIcon = backup.exists ? '📁' : '❌';
        const compressIcon = backup.compressed ? '🗜️' : '';
        
        console.log(`${index + 1}. ${statusIcon}${compressIcon} ${chalk.cyan(backup.timestamp)}`);
        console.log(`   描述: ${backup.description}`);
        console.log(`   时间: ${new Date(backup.created).toLocaleString()} (${age}天前)`);
        console.log(`   大小: ${sizeFormatted} MB`);
        console.log(`   状态: ${backup.exists ? chalk.green('可用') : chalk.red('缺失')}`);
        console.log();
      });

      // 交互式恢复选择
      if (options.interactive) {
        const availableBackups = backups.filter(b => b.exists);
        
        if (availableBackups.length === 0) {
          console.log(chalk.red('❌ 没有可用的备份进行恢复'));
          return;
        }

        const { selectedBackup } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedBackup',
          message: '选择要恢复的备份:',
          choices: [
            ...availableBackups.map(backup => ({
              name: `${backup.timestamp} - ${backup.description} (${new Date(backup.created).toLocaleString()})`,
              value: backup.timestamp
            })),
            { name: '取消', value: null }
          ]
        }]);

        if (!selectedBackup) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }

        // 确认恢复
        const { confirmRestore } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmRestore',
          message: `确认恢复备份 ${selectedBackup}? (当前配置将被备份)`,
          default: false
        }]);

        if (confirmRestore) {
          const ConfigManager = require('../src/core/ConfigManager');
          const configManager = new ConfigManager();
          
          console.log(chalk.blue('🔄 正在恢复备份...'));
          await configManager.restoreBackup(selectedBackup);
          console.log(chalk.green('✅ 备份恢复成功'));
          
          // 重新生成别名
          console.log(chalk.blue('🔗 重新生成别名配置...'));
          const { regenerateAliases } = require('../src/commands/provider');
          await regenerateAliases({ force: true });
        } else {
          console.log(chalk.yellow('恢复操作已取消'));
        }
      }
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

// 更新命令
program
  .command('update')
  .description('检查和下载配置更新')
  .option('-c, --check', '仅检查更新，不下载', false)
  .option('-f, --force', '强制检查更新', false)
  .option('-t, --templates', '仅更新模板', false)
  .option('--no-backup', '跳过更新前备份', false)
  .option('--dry-run', '显示更新计划但不执行', false)
  .action(async options => {
    try {
      const VersionManager = require('../src/core/VersionManager');
      const inquirer = require('inquirer');
      
      const versionManager = new VersionManager();
      await versionManager.initialize();

      console.log(chalk.blue('🔍 检查配置更新...\n'));

      // 检查更新
      const updateCheck = await versionManager.checkForUpdates({
        force: options.force,
        includeTemplates: true
      });

      if (!updateCheck.updateAvailable) {
        console.log(chalk.green('✅ 配置已是最新版本'));
        console.log(`当前版本: ${updateCheck.appUpdate.current}`);
        console.log(`检查时间: ${new Date(updateCheck.checkTime).toLocaleString()}`);
        return;
      }

      // 显示可用更新
      console.log(chalk.yellow('🆕 发现可用更新:\n'));

      if (updateCheck.appUpdate.available) {
        console.log(chalk.blue('📦 应用更新:'));
        console.log(`  当前版本: ${updateCheck.appUpdate.current}`);
        console.log(`  最新版本: ${chalk.green(updateCheck.appUpdate.latest)}`);
        
        if (updateCheck.appUpdate.changelog.length > 0) {
          console.log(`  更新内容:`);
          updateCheck.appUpdate.changelog.forEach(change => {
            console.log(`    - ${change}`);
          });
        }
        console.log();
      }

      if (updateCheck.templateUpdates.available) {
        console.log(chalk.blue('🎨 模板更新:'));
        updateCheck.templateUpdates.changes.forEach(change => {
          const icon = {
            'new': '🆕',
            'updated': '⬆️',
            'modified': '✏️',
            'removed': '❌'
          }[change.type] || '📝';
          
          console.log(`  ${icon} ${change.name} - ${change.description}`);
          if (change.oldVersion && change.newVersion) {
            console.log(`    版本: ${change.oldVersion} → ${change.newVersion}`);
          }
        });
        console.log();
      }

      // 仅检查模式
      if (options.check) {
        console.log(chalk.blue('💡 使用 "cc-config update" 下载更新'));
        return;
      }

      // 预演模式
      if (options.dryRun) {
        console.log(chalk.yellow('🧪 更新预演模式'));
        const plan = await versionManager.performIncrementalUpdate({
          dryRun: true,
          includeTemplates: true
        });
        
        if (plan.plan.actions.length > 0) {
          console.log('计划执行的操作:');
          plan.plan.actions.forEach(action => {
            console.log(`  - ${action}`);
          });
        }
        
        console.log(chalk.blue('\n💡 使用 "cc-config update" 执行更新'));
        return;
      }

      // 确认更新
      const { confirmUpdate } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmUpdate',
        message: '确认下载并应用这些更新?',
        default: true
      }]);

      if (!confirmUpdate) {
        console.log(chalk.yellow('更新已取消'));
        return;
      }

      // 执行更新
      console.log(chalk.blue('📥 正在下载更新...'));
      
      const downloadResult = await versionManager.downloadUpdates({
        includeApp: updateCheck.appUpdate.available,
        includeTemplates: updateCheck.templateUpdates.available || options.templates,
        backup: options.backup
      });

      // 显示结果
      if (downloadResult.backup) {
        console.log(chalk.green(`✅ 已创建备份: ${downloadResult.backup}`));
      }

      if (downloadResult.templates.updated.length > 0) {
        console.log(chalk.green(`✅ 已更新模板: ${downloadResult.templates.updated.join(', ')}`));
      }

      if (downloadResult.templates.failed.length > 0) {
        console.log(chalk.red('❌ 更新失败的模板:'));
        downloadResult.templates.failed.forEach(failure => {
          console.log(`  - ${failure.name}: ${failure.error}`);
        });
      }

      if (updateCheck.appUpdate.available) {
        console.log(chalk.yellow('\n⚠️ 应用更新需要重新安装 Claude Code Kit'));
        console.log(chalk.blue('请访问 https://github.com/anthropics/claude-code-kit 获取最新版本'));
      }

      // 重新生成别名（如果模板有更新）
      if (downloadResult.templates.updated.length > 0) {
        console.log(chalk.blue('\n🔗 重新生成别名配置...'));
        const { regenerateAliases } = require('../src/commands/provider');
        await regenerateAliases({ force: true });
      }

      console.log(chalk.green('\n🎉 更新完成!'));
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('显示版本信息和更新状态')
  .action(async () => {
    try {
      const VersionManager = require('../src/core/VersionManager');
      const versionManager = new VersionManager();
      await versionManager.initialize();

      const status = await versionManager.getVersionStatus();

      console.log(chalk.blue('📋 Claude Code Kit 版本信息\n'));
      
      console.log(`当前版本: ${chalk.green(status.currentVersion)}`);
      console.log(`远程版本: ${status.remoteVersion}`);
      console.log(`上次检查: ${status.lastCheck}`);
      console.log(`下次检查: ${status.nextCheck}`);
      console.log(`上次更新: ${status.lastUpdate}`);
      console.log(`模板数量: ${status.templateCount}`);
      console.log(`缓存大小: ${(status.cacheSize / 1024).toFixed(2)} KB`);

      console.log(chalk.gray('\n💡 使用 "cc-config update --check" 检查更新'));
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
      const ConfigStorage = require('../src/core/ConfigStorage');
      const ProviderManager = require('../src/core/ProviderManager');
      const AliasGenerator = require('../src/core/AliasGenerator');

      const configManager = new ConfigManager();
      const configStorage = new ConfigStorage();
      const providerManager = new ProviderManager();
      const aliasGenerator = new AliasGenerator(configStorage);

      console.log(chalk.blue('📊 Claude Code Kit 状态信息\n'));

      // 配置目录信息
      const paths = configManager.getPaths();
      console.log(chalk.green('📁 配置目录:'));
      console.log(`   主目录: ${paths.configDir}`);
      console.log(`   服务商: ${paths.providersDir}`);
      console.log(`   备份: ${paths.backupDir}`);
      console.log(`   别名: ${aliasGenerator.aliasesFile}`);
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
