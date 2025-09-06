#!/usr/bin/env node

/**
 * Claude Code Kit Configuration CLI
 * 
 * This tool manages Claude Code Kit configurations and providers.
 */

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Table = require('cli-table3');

// Import package.json for version
const packageJson = require('../package.json');

// Import core modules
const ConfigManager = require('../src/core/ConfigManager');
const ProviderManager = require('../src/core/ProviderManager');
const MCPManager = require('../src/core/MCPManager');

// Import utilities
const { displayBanner, displayBannerWithInfo, displayWelcome, displaySuccessBanner, displayErrorBanner } = require('../src/utils/banner');

// Configuration
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CONFIG_DIR = path.join(CLAUDE_DIR, 'ccvm');

// Initialize managers
const configManager = new ConfigManager(CONFIG_DIR);
const providerManager = new ProviderManager(CONFIG_DIR);
const mcpManager = new MCPManager(CONFIG_DIR);

// Main CLI program
const program = new Command();

program
  .name('ccvm')
  .description('Claude Code 版本管理器 - 多 Provider 配置管理工具')
  .version(packageJson.version, '-V, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息')
  .addHelpCommand('help [command]', '显示命令帮助');


// Direct commands (simplified)
program
  .command('add')
  .description('添加新的 API 配置')
  .action(async () => {
    try {
      const spinner = ora('正在初始化 Provider 设置...').start();
      await configManager.init();
      spinner.stop();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'aliasInput',
          message: chalk.blue('📡 添加新的 API Provider\n') + chalk.cyan('Provider 名称 (别名):'),
          validate: (input) => {
            if (!input) {return 'Provider 名称是必填的';}
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return 'Provider 名称只能包含字母、数字、连字符和下划线';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'baseURL',
          message: 'API 基础地址:',
          default: 'https://api.anthropic.com',
          validate: (input) => {
            if (!input) {return 'API 地址是必填的';}
            try {
              new URL(input);
              return true;
            } catch {
              return '请输入有效的 URL 地址';
            }
          }
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API 密钥:',
          mask: '*',
          validate: (input) => {
            if (!input) {return 'API 密钥是必填的';}
            if (input.length < 10) {return 'API 密钥太短了';}
            return true;
          }
        },
        {
          type: 'input',
          name: 'timeout',
          message: '请求超时时间 (毫秒):',
          default: '3000000',
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1000) {return '超时时间至少为 1000 毫秒';}
            return true;
          }
        }
      ]);

      // 使用用户输入的别名（不添加前缀）
      const providerData = {
        ...answers,
        alias: answers.aliasInput
      };
      delete providerData.aliasInput;

      const addSpinner = ora('正在添加 Provider...').start();
      
      await providerManager.addProvider(providerData);
      
      // 检查是否需要设置为默认provider
      const providers = await providerManager.listProviders();
      const currentConfig = await configManager.getConfig();
      
      if (providers.length === 1 || !currentConfig.defaultProvider) {
        // 如果是第一个provider或没有默认provider，自动设为默认
        await fs.writeJson(path.join(configManager.getConfigDir(), 'config.json'), {
          ...currentConfig,
          defaultProvider: providerData.alias,
          lastUpdated: new Date().toISOString()
        }, { spaces: 2 });
        
        // Provider configuration saved - no aliases needed
        
        addSpinner.succeed(chalk.green(`✅ Provider '${providerData.alias}' 添加成功并设为默认！`));
      } else {
        // Provider configuration saved - no aliases needed
        addSpinner.succeed(chalk.green(`✅ Provider '${providerData.alias}' 添加成功！`));
      }
      
      displaySuccessBanner('Provider 已准备就绪！');
      console.log(chalk.yellow('\n💡 使用方法: claude "你的消息"'));
      
      
      console.log(chalk.yellow('\n🚀 使用示例:'));
      console.log('   claude "你好，有什么可以帮助你的？"');
      console.log('   claude "请解释一下 React Hooks"');
      
      console.log(chalk.blue('\n📝 设为默认 Provider:'));
      console.log(`   ccvm use ${providerData.alias}`);

    } catch (error) {
      displayErrorBanner('添加 Provider 时出错');
      console.error(error.message);
      process.exit(1);
    }
  });

program
  .command('show <alias>')
  .description('显示配置详情')
  .action(async (alias) => {
    try {
      const spinner = ora(`正在加载 Provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' 未找到`));
        console.log(chalk.blue('\n运行: ccvm list'));
        return;
      }

      spinner.stop();

      console.log(chalk.blue(`\n📡 Provider 信息: ${alias}\n`));
      
      console.log(chalk.cyan('配置:'));
      console.log(`  别名: ${provider.alias}`);
      console.log(`  基础地址: ${provider.baseURL}`);
      console.log(`  超时时间: ${provider.timeout || '3000000'}ms`);
      console.log(`  创建时间: ${provider.created || '未知'}`);
      console.log(`  最后使用: ${provider.lastUsed || '从未'}`);
      
      console.log(chalk.cyan('\n使用方法:'));
      console.log(`  claude "你的消息"        # 使用当前 Provider`);
      console.log(`  ccvm edit ${provider.alias}   # 编辑该 Provider`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error showing provider:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有已配置的 API 端点')
  .action(async () => {
    try {
      const spinner = ora('正在加载配置...').start();
      
      await configManager.init();
      const providers = await providerManager.listProviders();
      const config = await configManager.getConfig();
      const defaultProvider = config.defaultProvider;
      
      spinner.stop();

      if (providers.length === 0) {
        console.log(chalk.yellow('\n📝 还没有配置任何 Provider'));
        console.log(chalk.blue('   运行: ccvm add'));
        return;
      }

      console.log(chalk.blue('\n📡 已配置的 API Provider\n'));
      
      // 创建表格
      const table = new Table({
        head: [
          chalk.bold('别名'),
          chalk.bold('API 地址'), 
          chalk.bold('备注')
        ],
        colWidths: [15, 50, 20],
        style: {
          border: ['gray'],
          head: []
        }
      });

      // 添加数据行
      providers.forEach(provider => {
        const isDefault = provider.alias === defaultProvider;
        const aliasDisplay = isDefault 
          ? chalk.green(`${provider.alias} ⭐`) 
          : chalk.cyan(provider.alias);
        const noteDisplay = isDefault 
          ? chalk.green('当前使用') 
          : chalk.gray('可用');
          
        table.push([
          aliasDisplay,
          provider.baseURL,
          noteDisplay
        ]);
      });

      console.log(table.toString());

      console.log(chalk.yellow(`\n💡 共计: ${providers.length} 个 Provider`));
      if (defaultProvider) {
        console.log(chalk.green(`⭐ 当前默认: ${defaultProvider}`));
      } else {
        console.log(chalk.gray('💡 提示: 使用 ccvm use <别名> 设置默认 Provider'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error listing providers:'), error.message);
      process.exit(1);
    }
  });

program
  .command('edit <alias>')
  .description('编辑现有配置')
  .action(async (alias) => {
    try {
      const spinner = ora(`正在加载 Provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' 未找到`));
        return;
      }

      spinner.stop();

      console.log(chalk.blue(`\n📝 编辑 Provider: ${alias}\n`));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'API 基础地址:',
          default: provider.baseURL
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API 密钥 (留空保持当前值):',
          mask: '*'
        },
        {
          type: 'input',
          name: 'timeout',
          message: '请求超时时间 (毫秒):',
          default: provider.timeout || '3000000'
        }
      ]);

      const updateSpinner = ora('正在更新 Provider...').start();

      const updatedProvider = {
        ...provider,
        baseURL: answers.baseURL,
        timeout: answers.timeout
      };

      if (answers.apiKey) {
        updatedProvider.apiKey = answers.apiKey;
      }

      await providerManager.updateProvider(alias, updatedProvider);
      // Configuration updated - no aliases needed
      
      // 自动加载更新的环境变量到当前进程
      process.env.ANTHROPIC_BASE_URL = updatedProvider.baseURL;
      process.env.ANTHROPIC_AUTH_TOKEN = updatedProvider.apiKey;
      process.env.API_TIMEOUT_MS = updatedProvider.timeout?.toString() || '3000000';

      updateSpinner.succeed(chalk.green(`Provider '${alias}' 更新成功！`));
      
      
      console.log(chalk.green('\n✅ Updated configuration loaded:'));
      console.log(chalk.dim(`   ANTHROPIC_BASE_URL=${updatedProvider.baseURL}`));
      console.log(chalk.dim(`   ANTHROPIC_AUTH_TOKEN=${updatedProvider.apiKey?.substring(0, 20)}...`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error editing provider:'), error.message);
      process.exit(1);
    }
  });

program
  .command('remove <alias>')
  .description('删除配置')
  .action(async (alias) => {
    try {
      const spinner = ora(`正在加载 Provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' 未找到`));
        return;
      }

      spinner.stop();

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `确定要删除 Provider '${alias}' 吗？`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('操作已取消。'));
        return;
      }

      const removeSpinner = ora('正在删除 Provider...').start();

      await providerManager.removeProvider(alias);
      // Configuration updated - no aliases needed

      removeSpinner.succeed(chalk.green(`Provider '${alias}' 删除成功！`));
      

    } catch (error) {
      console.error(chalk.red('\n❌ Error removing provider:'), error.message);
      process.exit(1);
    }
  });

// Configuration management commands






program
  .command('use [alias]')
  .description('切换到指定的 API 配置')
  .action(async (alias) => {
    try {
      await configManager.init();
      
      if (!alias) {
        // 显示当前默认provider
        const config = await configManager.getConfig();
        const defaultProvider = config.defaultProvider;
        const providers = await providerManager.listProviders();
        
        if (defaultProvider) {
          const provider = await providerManager.getProvider(defaultProvider);
          if (provider) {
            console.log(chalk.blue('📡 当前默认 Provider：'));
            console.log(chalk.green(`   ${provider.alias} (${provider.baseURL})`));
            return;
          }
        }
        
        // 如果没有默认provider但只有一个provider，自动设置为默认
        if (!defaultProvider && providers.length === 1) {
          const provider = providers[0];
          await fs.writeJson(path.join(configManager.getConfigDir(), 'config.json'), {
            ...config,
            defaultProvider: provider.alias,
            lastUpdated: new Date().toISOString()
          }, { spaces: 2 });
          
          console.log(chalk.green(`📡 Auto-selected default provider: ${provider.alias}`));
          console.log(chalk.dim(`   ${provider.baseURL}`));
          return;
        }
        
        if (providers.length === 0) {
          console.log(chalk.yellow('还没有配置任何 Provider'));
          console.log('使用方法: ccvm add');
        } else {
          console.log(chalk.yellow('尚未设置默认 Provider'));
          console.log('使用方法: ccvm use <别名>');
          console.log(chalk.dim(`可用的 Provider: ${providers.map(p => p.alias).join(', ')}`));
        }
        return;
      }
      
      const spinner = ora(`正在设置默认 Provider 为 '${alias}'...`).start();
      
      const provider = await providerManager.getProvider(alias);
      if (!provider) {
        spinner.fail(chalk.red(`找不到 Provider '${alias}'`));
        return;
      }
      
      // 保存默认provider到配置
      const currentConfig = await configManager.getConfig();
      await fs.writeJson(path.join(configManager.getConfigDir(), 'config.json'), {
        ...currentConfig,
        defaultProvider: alias,
        lastUpdated: new Date().toISOString()
      }, { spaces: 2 });
      
      // Default provider updated - claude command will use new default automatically
      
      spinner.succeed(chalk.green(`✅ 默认 Provider 已设置为 '${alias}'`));
      
      console.log(chalk.yellow('\n💡 使用方法:'));
      console.log(`   claude "你好，请问有什么可以帮助你的？"`);

    } catch (error) {
      console.error(chalk.red('\n❌ 设置默认 Provider 时出错:'), error.message);
      process.exit(1);
    }
  });


// Enhanced status command
program
  .command('status')
  .description('显示系统状态和配置信息')
  .option('--detailed', 'Show detailed status information')
  .action(async (options) => {
    try {
      const spinner = ora('正在检查系统状态...').start();
      
      await configManager.init();
      
      const [providers, systemInfo, config] = await Promise.all([
        providerManager.listProviders(),
        configManager.getSystemInfo(),
        configManager.getConfig()
      ]);
      
      spinner.stop();

      // Display banner for status command
      displayBanner();
      console.log();

      // Installation mode detection
      const devPathFile = path.join(CONFIG_DIR, 'dev_path');
      const isDevelopmentMode = await fs.pathExists(devPathFile);
      let installMode = 'Production';
      let installPath = CONFIG_DIR;
      
      if (isDevelopmentMode) {
        try {
          const devPath = await fs.readFile(devPathFile, 'utf8');
          installMode = 'Development';
          installPath = devPath.trim();
        } catch (error) {
          // Fall back to production mode if dev_path file is corrupted
        }
      }

      // System info
      console.log(chalk.cyan('系统信息:'));
      console.log(`  版本: ${systemInfo.version}`);
      console.log(`  Node.js: ${systemInfo.nodeVersion}`);
      console.log(`  平台: ${systemInfo.platform}`);
      console.log(`  安装模式: ${installMode === 'Development' ? '开发模式 🔧' : '生产模式 📦'}`);
      console.log(`  安装路径: ${installPath}`);
      console.log(`  已初始化: ${systemInfo.initialized ? '✓' : '✗'}`);
      console.log(`  配置目录: ${systemInfo.configDir}`);
      console.log(`  Claude 目录: ${systemInfo.claudeDir}`);

      // Configuration info
      console.log(chalk.cyan('\n配置信息:'));
      console.log(`  Provider 数量: ${providers.length} 个`);
      console.log(`  默认 Provider: ${config.defaultProvider || '未设置'}`);

      // Directory status
      console.log(chalk.cyan('\n目录状态:'));
      console.log(`  ~/.claude/ccvm: ${await fs.pathExists(CONFIG_DIR) ? '✓' : '✗'}`);
      console.log(`  ~/.claude: ${await fs.pathExists(CLAUDE_DIR) ? '✓' : '✗'}`);
      console.log(`  aliases.sh: ${await fs.pathExists(path.join(CONFIG_DIR, 'aliases.sh')) ? '✓' : '✗'}`);

      if (options.detailed) {
        // Detailed provider information
        if (providers.length > 0) {
          console.log(chalk.cyan('\nProvider Details:'));
          for (const provider of providers) {
            console.log(`  ${provider.alias}:`);
            console.log(`    URL: ${provider.baseURL}`);
            console.log(`    Created: ${provider.created || 'Unknown'}`);
            console.log(`    Last Used: ${provider.lastUsed || 'Never'}`);
          }
        }

        // Backup functionality removed as per user requirements
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error checking status:'), error.message);
      process.exit(1);
    }
  });

// Doctor command for comprehensive diagnostics (includes validation)
program
  .command('doctor')
  .description('运行全面的系统诊断和验证')
  .option('--fix', 'Attempt to fix found issues automatically')
  .action(async (options) => {
    try {
      // Display banner for doctor command
      displayBanner();
      console.log(chalk.blue('\n🩺 Claude Code Kit System Diagnostics\n'));

      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1));
      console.log(chalk.cyan('Node.js Environment:'));
      console.log(`  Version: ${nodeVersion} ${majorVersion >= 18 ? '✅' : '❌ (requires Node.js 18+)'}`);
      console.log(`  Platform: ${process.platform}`);
      console.log(`  Architecture: ${process.arch}`);

      // Check dependencies
      console.log(chalk.cyan('\nDependencies:'));
      const dependencies = ['jq', 'claude', 'ccline', 'ccusage'];
      for (const dep of dependencies) {
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          await execAsync(`which ${dep}`);
          
          // Get version info for certain tools
          if (dep === 'ccusage' || dep === 'ccline' || dep === 'claude') {
            try {
              const { stdout: versionOutput } = await execAsync(`${dep} --version`);
              const version = versionOutput.trim().match(/[\d.]+/)?.[0] || 'unknown';
              console.log(`  ${dep}: ✅ Available (v${version})`);
            } catch {
              console.log(`  ${dep}: ✅ Available`);
            }
          } else {
            console.log(`  ${dep}: ✅ Available`);
          }
        } catch {
          let status = '❌ Not found';
          if (dep === 'jq') {
            status += ' (recommended)';
          } else if (dep === 'ccline') {
            status += ' (optional enhancement)';  
          } else if (dep === 'ccusage') {
            status += ' (usage analytics tool)';
          }
          console.log(`  ${dep}: ${status}`);
        }
      }

      // Check system permissions
      console.log(chalk.cyan('\nFile System Permissions:'));
      const testDirs = [CONFIG_DIR, CLAUDE_DIR, os.homedir()];
      for (const dir of testDirs) {
        try {
          await fs.access(dir, fs.constants.W_OK);
          console.log(`  ${dir}: ✅ Writable`);
        } catch {
          console.log(`  ${dir}: ❌ Not writable`);
        }
      }

      // Check configuration
      console.log(chalk.cyan('\nConfiguration Status:'));
      try {
        await configManager.init();
        console.log('  Initialization: ✅ Success');
        
        const validation = await configManager.validateConfiguration();
        console.log(`  Validation: ${validation.valid ? '✅ Valid' : '❌ Issues found'}`);
        
        const providers = await providerManager.listProviders();
        console.log(`  Providers: ${providers.length} configured`);
        
        // Backup functionality removed as per user requirements
        
      } catch (error) {
        console.log(`  Configuration: ❌ ${error.message}`);
      }

      // Configuration Validation
      console.log(chalk.cyan('\nConfiguration Validation:'));
      const issues = [];
      const fixes = [];

      try {
        // Validate providers
        const providers = await providerManager.listProviders();
        for (const provider of providers) {
          try {
            const testResult = await providerManager.testProvider(provider.alias);
            if (!testResult.reachable) {
              issues.push(`Provider '${provider.alias}': ${testResult.message}`);
            } else {
              console.log(`  Provider '${provider.alias}': ✅ Reachable`);
            }
          } catch (testError) {
            issues.push(`Provider '${provider.alias}': ${testError.message}`);
          }
        }

        // Note: Aliases validation removed - using direct claude command integration
        console.log('  Integration: ✅ Direct claude command (no aliases needed)');

        // Backup validation removed as per user requirements

      } catch (error) {
        issues.push(`Validation failed: ${error.message}`);
      }

      // Report validation results
      if (issues.length === 0) {
        console.log(chalk.green('\n✅ All validation checks passed!'));
      } else {
        console.log(chalk.yellow(`\n⚠️ Found ${issues.length} issue(s):`));
        issues.forEach((issue, index) => {
          console.log(chalk.red(`  ${index + 1}. ${issue}`));
        });

        if (fixes.length > 0) {
          console.log(chalk.green(`\n🔧 Applied ${fixes.length} fix(es):`));
          fixes.forEach((fix, index) => {
            console.log(chalk.green(`  ${index + 1}. ${fix}`));
          });
        }

        if (options.fix && fixes.length === 0) {
          console.log(chalk.yellow('\n💡 No automatic fixes available. Manual intervention required.'));
        } else if (!options.fix) {
          console.log(chalk.blue('\n💡 Run with --fix to attempt automatic repairs.'));
        }
      }

      // Recommendations
      console.log(chalk.cyan('\nRecommendations:'));
      console.log('  • Run "ccvm doctor --fix" to automatically fix issues');
      console.log('  • Run "ccvm status --detailed" for detailed information');
      console.log('  • Run "ccvm add" to add a new provider configuration');

    } catch (error) {
      console.error(chalk.red('\n❌ Error during diagnostics:'), error.message);
      process.exit(1);
    }
  });

// Env command - output environment variables for current default provider
program
  .command('env')
  .description('输出指定或默认 Provider 的环境变量')
  .option('--shell <shell>', 'Shell format (bash, zsh, fish)', 'bash')
  .option('--provider <alias>', '指定 Provider 别名')
  .action(async (options) => {
    try {
      await configManager.init();
      
      let targetProvider = options.provider;
      
      // If no provider specified, use default
      if (!targetProvider) {
        const config = await configManager.getConfig();
        targetProvider = config.defaultProvider;
        
        if (!targetProvider) {
          console.error('# 没有配置默认 Provider');
          console.error('# 运行: ccvm add');
          console.error('# 然后: ccvm use <别名>');
          process.exit(1);
        }
      }
      
      // Load provider configuration
      const provider = await providerManager.getProvider(targetProvider);
      if (!provider) {
        console.error(`# Provider '${targetProvider}' 未找到`);
        console.error('# 运行: ccvm list');
        if (options.provider) {
          console.error(`# 或者: ccvm add`);
        }
        process.exit(1);
      }
      
      // Output environment variables in shell format
      const shell = options.shell.toLowerCase();
      if (shell === 'fish') {
        console.log(`set -x ANTHROPIC_AUTH_TOKEN "${provider.apiKey}";`);
        console.log(`set -x ANTHROPIC_BASE_URL "${provider.baseURL}";`);
        console.log(`set -x API_TIMEOUT_MS "${provider.timeout || '3000000'}";`);
      } else {
        // bash/zsh format
        console.log(`export ANTHROPIC_AUTH_TOKEN="${provider.apiKey}";`);
        console.log(`export ANTHROPIC_BASE_URL="${provider.baseURL}";`);
        console.log(`export API_TIMEOUT_MS="${provider.timeout || '3000000'}";`);
      }
      
    } catch (error) {
      console.error(`# 错误: ${error.message}`);
      process.exit(1);
    }
  });

// MCP (Model Context Protocol) management commands
program
  .command('mcp')
  .description('管理 Claude Code 的 MCP (模型上下文协议) 服务')
  .action(async () => {
    try {
      await mcpManager.showMainMenu();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Handle unknown commands
program
  .command('*', { hidden: true })
  .action((cmd) => {
    console.log(chalk.red(`\n❌ 未知命令: ${cmd}`));
    console.log(chalk.blue('运行 "ccvm --help" 查看可用命令。'));
    process.exit(1);
  });

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n💥 意外错误:'), error.message);
  if (process.env.DEBUG) {
    console.error(chalk.gray(error.stack));
  }
  console.error(chalk.yellow('需要帮助请访问: https://github.com/kedoupi/ccvm/issues'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n💥 未处理的 Promise 拒绝:'), reason);
  if (process.env.DEBUG) {
    console.error(chalk.gray(reason.stack || reason));
  }
  console.error(chalk.yellow('需要帮助请访问: https://github.com/kedoupi/ccvm/issues'));
  process.exit(1);
});

// Handle SIGINT gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Goodbye!'));
  process.exit(0);
});

// Handle SIGTERM gracefully
process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 Terminating gracefully...'));
  process.exit(0);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  displayBannerWithInfo();
  program.outputHelp();
} else {
  // Run the CLI
  program.parse(process.argv);
}