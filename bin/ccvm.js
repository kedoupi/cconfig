#!/usr/bin/env node

/**
 * Claude Code Kit Configuration CLI
 * 
 * This tool manages Claude Code Kit configurations, providers, and backups.
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
const BackupManager = require('../src/core/BackupManager');
const AliasGenerator = require('../src/core/AliasGenerator');

// Configuration
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CONFIG_DIR = path.join(CLAUDE_DIR, 'ccvm');

// Initialize managers
const configManager = new ConfigManager(CONFIG_DIR);
const providerManager = new ProviderManager(CONFIG_DIR);
const backupManager = new BackupManager(CONFIG_DIR, CLAUDE_DIR);
// Note: AliasGenerator removed - using direct claude command integration

// Main CLI program
const program = new Command();

program
  .name('ccvm')
  .description('Claude Code Version Manager')
  .version(packageJson.version);


// Direct commands (simplified)
program
  .command('add')
  .description('Add a new API configuration')
  .action(async () => {
    try {
      const spinner = ora('Initializing provider setup...').start();
      await configManager.init();
      spinner.stop();

      console.log(chalk.blue('\n📡 Add New API Provider\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'aliasInput',
          message: 'Provider name (alias):',
          validate: (input) => {
            if (!input) {return 'Provider name is required';}
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return 'Provider name can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'baseURL',
          message: 'API Base URL:',
          default: 'https://api.anthropic.com',
          validate: (input) => {
            if (!input) {return 'Base URL is required';}
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          mask: '*',
          validate: (input) => {
            if (!input) {return 'API Key is required';}
            if (input.length < 10) {return 'API Key seems too short';}
            return true;
          }
        },
        {
          type: 'input',
          name: 'timeout',
          message: 'Request timeout (ms):',
          default: '3000000',
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1000) {return 'Timeout must be at least 1000ms';}
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

      const addSpinner = ora('Adding provider...').start();
      
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
        
        addSpinner.succeed(chalk.green(`Provider '${providerData.alias}' added successfully and set as default!`));
      } else {
        // Provider configuration saved - no aliases needed
        addSpinner.succeed(chalk.green(`Provider '${providerData.alias}' added successfully!`));
      }
      
      console.log(chalk.green('\n✅ Provider ready to use!'));
      console.log(chalk.yellow('\n💡 Usage: claude "your message"'));
      
      
      console.log(chalk.yellow('\n🚀 Usage examples:'));
      console.log('   claude "Hello, how are you?"');
      console.log('   claude "Explain React hooks"');
      
      console.log(chalk.blue('\n📝 Set as default provider:'));
      console.log(`   ccvm use ${providerData.alias}`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error adding provider:'), error.message);
      process.exit(1);
    }
  });

program
  .command('show <alias>')
  .description('Show configuration details')
  .action(async (alias) => {
    try {
      const spinner = ora(`Loading provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' not found`));
        console.log(chalk.blue('\nRun: ccvm list'));
        return;
      }

      spinner.stop();

      console.log(chalk.blue(`\n📡 Provider Information: ${alias}\n`));
      
      console.log(chalk.cyan('Configuration:'));
      console.log(`  Alias: ${provider.alias}`);
      console.log(`  Base URL: ${provider.baseURL}`);
      console.log(`  Timeout: ${provider.timeout || '3000000'}ms`);
      console.log(`  Created: ${provider.created || 'Unknown'}`);
      console.log(`  Last Used: ${provider.lastUsed || 'Never'}`);
      
      console.log(chalk.cyan('\nUsage:'));
      console.log(`  ${provider.alias} "your message"     # Use this provider`);
      console.log(`  ccvm edit ${provider.alias}    # Edit this provider`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error showing provider:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all configured API endpoints')
  .action(async () => {
    try {
      const spinner = ora('Loading providers...').start();
      
      await configManager.init();
      const providers = await providerManager.listProviders();
      
      spinner.stop();

      if (providers.length === 0) {
        console.log(chalk.yellow('\n📝 No providers configured yet.'));
        console.log(chalk.blue('   Run: ccvm add'));
        return;
      }

      console.log(chalk.blue('\n📡 Configured API Providers\n'));
      
      // 创建表格
      const table = new Table({
        head: [
          chalk.bold('Alias'),
          chalk.bold('Base URL'), 
          chalk.bold('Status')
        ],
        colWidths: [15, 40, 12],
        style: {
          border: ['gray'],
          head: []
        }
      });

      // 添加数据行
      providers.forEach(provider => {
        table.push([
          chalk.cyan(provider.alias),
          provider.baseURL,
          chalk.green('✓ Active')
        ]);
      });

      console.log(table.toString());

      console.log(chalk.yellow(`\n💡 Total: ${providers.length} provider(s) configured`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error listing providers:'), error.message);
      process.exit(1);
    }
  });

program
  .command('edit <alias>')
  .description('Edit an existing configuration')
  .action(async (alias) => {
    try {
      const spinner = ora(`Loading provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' not found`));
        return;
      }

      spinner.stop();

      console.log(chalk.blue(`\n📝 Edit Provider: ${alias}\n`));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'API Base URL:',
          default: provider.baseURL
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key (leave empty to keep current):',
          mask: '*'
        },
        {
          type: 'input',
          name: 'timeout',
          message: 'Request timeout (ms):',
          default: provider.timeout || '3000000'
        }
      ]);

      const updateSpinner = ora('Updating provider...').start();

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

      updateSpinner.succeed(chalk.green(`Provider '${alias}' updated successfully!`));
      
      
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
  .description('Remove a configuration')
  .action(async (alias) => {
    try {
      const spinner = ora(`Loading provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' not found`));
        return;
      }

      spinner.stop();

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove provider '${alias}'?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }

      const removeSpinner = ora('Removing provider...').start();

      await providerManager.removeProvider(alias);
      // Configuration updated - no aliases needed

      removeSpinner.succeed(chalk.green(`Provider '${alias}' removed successfully!`));
      

    } catch (error) {
      console.error(chalk.red('\n❌ Error removing provider:'), error.message);
      process.exit(1);
    }
  });

// Configuration management commands






program
  .command('use [alias]')
  .description('Switch to API configuration')
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
            console.log(chalk.blue('📡 Current default provider:'));
            console.log(`   ${provider.alias} (${provider.baseURL})`);
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
          console.log(chalk.yellow('No providers configured yet'));
          console.log('Usage: ccvm add');
        } else {
          console.log(chalk.yellow('No default provider set'));
          console.log('Usage: ccvm use <alias>');
          console.log(chalk.dim(`Available providers: ${providers.map(p => p.alias).join(', ')}`));
        }
        return;
      }
      
      const spinner = ora(`Setting default provider to '${alias}'...`).start();
      
      const provider = await providerManager.getProvider(alias);
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' not found`));
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
      
      spinner.succeed(chalk.green(`Default provider set to '${alias}'`));
      
      console.log(chalk.yellow('\n💡 Usage:'));
      console.log(`   ${alias} "Hello, how are you?"`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error setting default provider:'), error.message);
      process.exit(1);
    }
  });


// Enhanced status command
program
  .command('status')
  .description('Show system status and configuration info')
  .option('--detailed', 'Show detailed status information')
  .action(async (options) => {
    try {
      const spinner = ora('Checking system status...').start();
      
      await configManager.init();
      
      const [providers, backups, systemInfo, config] = await Promise.all([
        providerManager.listProviders(),
        backupManager.listBackups(), 
        configManager.getSystemInfo(),
        configManager.getConfig()
      ]);
      
      spinner.stop();

      console.log(chalk.blue('\n📊 CCVM (Claude Code Version Manager) Status\n'));

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
      console.log(chalk.cyan('System Information:'));
      console.log(`  Version: ${systemInfo.version}`);
      console.log(`  Node.js: ${systemInfo.nodeVersion}`);
      console.log(`  Platform: ${systemInfo.platform}`);
      console.log(`  Install Mode: ${installMode}${installMode === 'Development' ? ' 🔧' : ' 📦'}`);
      console.log(`  Install Path: ${installPath}`);
      console.log(`  Initialized: ${systemInfo.initialized ? '✓' : '✗'}`);
      console.log(`  Config Directory: ${systemInfo.configDir}`);
      console.log(`  Claude Directory: ${systemInfo.claudeDir}`);

      // Configuration info
      console.log(chalk.cyan('\nConfiguration:'));
      console.log(`  Providers: ${providers.length} configured`);
      console.log(`  Backups: ${backups.length} available`);
      console.log(`  Default Provider: ${config.defaultProvider || 'None'}`);
      console.log(`  Last Update: ${backups.length > 0 ? backups[0].timestamp : 'Never'}`);

      // Directory status
      console.log(chalk.cyan('\nDirectory Status:'));
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

        // Backup statistics
        if (backups.length > 0) {
          const backupStats = await backupManager.getBackupStats();
          console.log(chalk.cyan('\nBackup Statistics:'));
          console.log(`  Total Size: ${backupStats.totalSize}`);
          console.log(`  Oldest: ${backupStats.oldestBackup?.timestamp || 'None'}`);
          console.log(`  Newest: ${backupStats.newestBackup?.timestamp || 'None'}`);
        }
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error checking status:'), error.message);
      process.exit(1);
    }
  });

// Doctor command for comprehensive diagnostics (includes validation)
program
  .command('doctor')
  .description('Run comprehensive system diagnostics and validation')
  .option('--fix', 'Attempt to fix found issues automatically')
  .action(async (options) => {
    try {
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
      const dependencies = ['jq', 'claude'];
      for (const dep of dependencies) {
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          await execAsync(`which ${dep}`);
          console.log(`  ${dep}: ✅ Available`);
        } catch {
          console.log(`  ${dep}: ❌ Not found`);
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
        
        const backups = await backupManager.listBackups();
        console.log(`  Backups: ${backups.length} available`);
        
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

        // Validate backups
        const backups = await backupManager.listBackups();
        const recentBackups = backups.slice(0, 3);
        let validBackups = 0;
        for (const backup of recentBackups) {
          try {
            const verification = await backupManager.verifyBackup(backup.timestamp);
            if (verification.valid) {
              validBackups++;
            } else {
              issues.push(`Backup '${backup.timestamp}': ${verification.issues.join(', ')}`);
            }
          } catch (error) {
            issues.push(`Backup '${backup.timestamp}': ${error.message}`);
          }
        }
        console.log(`  Backups: ${validBackups}/${recentBackups.length} recent backups valid`);

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
      console.log('  • Run "ccvm update" to update configuration templates');

    } catch (error) {
      console.error(chalk.red('\n❌ Error during diagnostics:'), error.message);
      process.exit(1);
    }
  });

// Env command - output environment variables for current default provider
program
  .command('env')
  .description('Output environment variables for current default provider')
  .option('--shell <shell>', 'Shell format (bash, zsh, fish)', 'bash')
  .action(async (options) => {
    try {
      await configManager.init();
      
      // Get current configuration
      const config = await configManager.getConfig();
      const defaultProvider = config.defaultProvider;
      
      if (!defaultProvider) {
        console.error('# No default provider configured');
        console.error('# Run: ccvm add');
        console.error('# Then: ccvm use <alias>');
        process.exit(1);
      }
      
      // Load provider configuration
      const provider = await providerManager.getProvider(defaultProvider);
      if (!provider) {
        console.error(`# Provider '${defaultProvider}' not found`);
        console.error('# Run: ccvm list');
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
      console.error(`# Error: ${error.message}`);
      process.exit(1);
    }
  });

// Exec command - execute claude with current default configuration
program
  .command('exec')
  .description('Execute claude with current default configuration')
  .allowUnknownOption()
  .action(async (...args) => {
    try {
      // Remove the command object from args
      const claudeArgs = args.slice(0, -1);
      
      const spinner = ora('Loading configuration...').start();
      
      // Initialize config manager
      await configManager.init();
      
      // Get current configuration
      const config = await configManager.getConfig();
      const defaultProvider = config.defaultProvider;
      
      if (!defaultProvider) {
        spinner.fail(chalk.red('No default provider configured'));
        console.log(chalk.blue('\\nRun: ccvm add'));
        console.log(chalk.blue('Then: ccvm use <alias>'));
        process.exit(1);
      }
      
      // Load provider configuration
      const provider = await providerManager.getProvider(defaultProvider);
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${defaultProvider}' not found`));
        console.log(chalk.blue('\\nRun: ccvm list'));
        process.exit(1);
      }
      
      spinner.stop();
      
      // Set environment variables
      process.env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
      process.env.ANTHROPIC_BASE_URL = provider.baseURL;
      process.env.API_TIMEOUT_MS = provider.timeout || '3000000';
      
      // Execute claude command
      const { spawn } = require('child_process');
      const claude = spawn('claude', claudeArgs, {
        stdio: 'inherit',
        env: process.env
      });
      
      claude.on('exit', (code) => {
        process.exit(code || 0);
      });
      
      claude.on('error', (error) => {
        if (error.code === 'ENOENT') {
          console.error(chalk.red('\\n❌ Claude CLI not found'));
          console.error(chalk.blue('Install with: npm install -g @anthropic-ai/claude-code'));
        } else {
          console.error(chalk.red('\\n❌ Error executing claude:'), error.message);
        }
        process.exit(1);
      });
      
    } catch (error) {
      console.error(chalk.red('\\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Handle unknown commands
program
  .command('*', { hidden: true })
  .action((cmd) => {
    console.log(chalk.red(`\n❌ Unknown command: ${cmd}`));
    console.log(chalk.blue('Run "ccvm --help" for available commands.'));
    process.exit(1);
  });

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n💥 Unexpected error:'), error.message);
  if (process.env.DEBUG) {
    console.error(chalk.gray(error.stack));
  }
  console.error(chalk.yellow('For support, please visit: https://github.com/kedoupi/claude-code-kit/issues'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n💥 Unhandled promise rejection:'), reason);
  if (process.env.DEBUG) {
    console.error(chalk.gray(reason.stack || reason));
  }
  console.error(chalk.yellow('For support, please visit: https://github.com/kedoupi/claude-code-kit/issues'));
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

// Run the CLI
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}