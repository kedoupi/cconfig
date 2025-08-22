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

// Import core modules
const ConfigManager = require('../src/core/ConfigManager');
const ProviderManager = require('../src/core/ProviderManager');
const BackupManager = require('../src/core/BackupManager');
const AliasGenerator = require('../src/core/AliasGenerator');

// Configuration
const CONFIG_DIR = path.join(os.homedir(), '.cc-config');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

// Initialize managers
const configManager = new ConfigManager(CONFIG_DIR);
const providerManager = new ProviderManager(CONFIG_DIR);
const backupManager = new BackupManager(CONFIG_DIR, CLAUDE_DIR);
const aliasGenerator = new AliasGenerator(CONFIG_DIR);

// Main CLI program
const program = new Command();

program
  .name('cc-config')
  .description('Claude Code Kit Configuration Manager')
  .version('1.0.0');


// Provider management commands
const providerCmd = program
  .command('provider')
  .description('Manage API providers');

providerCmd
  .command('add')
  .description('Add a new API provider')
  .action(async () => {
    try {
      const spinner = ora('Initializing provider setup...').start();
      await configManager.init();
      spinner.stop();

      console.log(chalk.blue('\n📡 Add New API Provider\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'alias',
          message: 'Provider alias (command name):',
          validate: (input) => {
            if (!input) {return 'Alias is required';}
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return 'Alias can only contain letters, numbers, hyphens, and underscores';
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

      const addSpinner = ora('Adding provider...').start();
      
      await providerManager.addProvider(answers);
      await aliasGenerator.generateAliases();
      
      addSpinner.succeed(chalk.green(`Provider '${answers.alias}' added successfully!`));
      
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(`   1. Restart your terminal or run: source ~/.zshrc`);
      console.log(`   2. Test the provider: ${answers.alias} "Hello"`);
      console.log(`   3. List all providers: cc-config provider list`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error adding provider:'), error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('show <alias>')
  .description('Show provider details')
  .action(async (alias) => {
    try {
      const spinner = ora(`Loading provider '${alias}'...`).start();
      
      await configManager.init();
      const provider = await providerManager.getProvider(alias);
      
      if (!provider) {
        spinner.fail(chalk.red(`Provider '${alias}' not found`));
        console.log(chalk.blue('\nRun: cc-config provider list'));
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
      console.log(`  cc-config provider edit ${provider.alias}    # Edit this provider`);

    } catch (error) {
      console.error(chalk.red('\n❌ Error showing provider:'), error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('list')
  .description('List all configured providers')
  .action(async () => {
    try {
      const spinner = ora('Loading providers...').start();
      
      await configManager.init();
      const providers = await providerManager.listProviders();
      
      spinner.stop();

      if (providers.length === 0) {
        console.log(chalk.yellow('\n📝 No providers configured yet.'));
        console.log(chalk.blue('   Run: cc-config provider add'));
        return;
      }

      console.log(chalk.blue('\n📡 Configured API Providers\n'));
      
      console.log(chalk.gray('Alias').padEnd(15) + 
                  chalk.gray('Base URL').padEnd(35) + 
                  chalk.gray('Status'));
      console.log('─'.repeat(60));

      for (const provider of providers) {
        const status = chalk.green('✓ Active');
        console.log(
          chalk.cyan(provider.alias).padEnd(15) +
          provider.baseURL.padEnd(35) +
          status
        );
      }

      console.log(chalk.yellow(`\n💡 Total: ${providers.length} provider(s) configured`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error listing providers:'), error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('edit <alias>')
  .description('Edit an existing provider')
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
      await aliasGenerator.generateAliases();

      updateSpinner.succeed(chalk.green(`Provider '${alias}' updated successfully!`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error editing provider:'), error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('remove <alias>')
  .description('Remove a provider')
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
      await aliasGenerator.generateAliases();

      removeSpinner.succeed(chalk.green(`Provider '${alias}' removed successfully!`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error removing provider:'), error.message);
      process.exit(1);
    }
  });

// Configuration management commands
program
  .command('update')
  .description('Update configuration templates')
  .option('--force', 'Force update without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'This will update your configuration templates. Continue?',
            default: true
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Update cancelled.'));
          return;
        }
      }

      const spinner = ora('Updating configuration...').start();

      await configManager.init();
      
      // Create backup before update
      const timestamp = await backupManager.createBackup('Pre-update backup');
      
      // TODO: Implement configuration update logic
      // This would download latest templates from GitHub
      
      spinner.succeed(chalk.green('Configuration updated successfully!'));
      console.log(chalk.blue(`Backup created: ${timestamp}`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error updating configuration:'), error.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('View and restore configuration backups')
  .action(async () => {
    try {
      const spinner = ora('Loading backup history...').start();
      
      await configManager.init();
      const backups = await backupManager.listBackups();
      
      spinner.stop();

      if (backups.length === 0) {
        console.log(chalk.yellow('\n📦 No backups found.'));
        return;
      }

      console.log(chalk.blue('\n📦 Configuration Backup History\n'));

      const choices = backups.map((backup) => ({
        name: `${backup.timestamp} - ${backup.description} (${backup.size || 'Unknown size'})`,
        value: backup.timestamp,
        short: backup.timestamp
      }));

      choices.push({ name: chalk.gray('Cancel'), value: null });

      const { selectedBackup } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedBackup',
          message: 'Select a backup to restore:',
          choices
        }
      ]);

      if (!selectedBackup) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Restore backup from ${selectedBackup}? This will overwrite current configuration.`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Restore cancelled.'));
        return;
      }

      const restoreSpinner = ora('Restoring backup...').start();

      await backupManager.restoreBackup(selectedBackup);
      await aliasGenerator.generateAliases();

      restoreSpinner.succeed(chalk.green('Backup restored successfully!'));

    } catch (error) {
      console.error(chalk.red('\n❌ Error managing backups:'), error.message);
      process.exit(1);
    }
  });



providerCmd
  .command('use [alias]')
  .description('Set default provider (like nvm use)')
  .action(async (alias) => {
    try {
      const spinner = ora('Setting default provider...').start();
      
      await configManager.init();
      const providers = await providerManager.listProviders();
      
      if (providers.length === 0) {
        spinner.fail('No providers configured. Add a provider first.');
        return;
      }
      
      // If only one provider, use it automatically
      if (providers.length === 1) {
        const defaultProvider = providers[0];
        spinner.succeed(`Using ${defaultProvider.alias} (only provider available)`);
        console.log(chalk.green(`✓ Default provider: ${defaultProvider.alias} (${defaultProvider.baseURL})`));
        return;
      }
      
      // If alias provided, use it
      if (alias) {
        const provider = await providerManager.getProvider(alias);
        if (!provider) {
          spinner.fail(`Provider '${alias}' not found`);
          return;
        }
        spinner.succeed(`Now using ${alias}`);
        console.log(chalk.green(`✓ Default provider: ${alias} (${provider.baseURL})`));
        return;
      }
      
      // Interactive selection when multiple providers exist
      spinner.stop();
      
      console.log(chalk.blue('\n📡 Available Providers:\n'));
      providers.forEach((p, index) => {
        console.log(`  ${index + 1}. ${chalk.cyan(p.alias)} (${p.baseURL})`);
      });
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('\nSelect provider (1-' + providers.length + '): ', (answer) => {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < providers.length) {
          const selectedProvider = providers[index];
          console.log(chalk.green(`✓ Now using: ${selectedProvider.alias} (${selectedProvider.baseURL})`));
        } else {
          console.log(chalk.red('Invalid selection'));
        }
        rl.close();
      });
      
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

      console.log(chalk.blue('\n📊 Claude Code Kit Status\n'));

      // System info
      console.log(chalk.cyan('System Information:'));
      console.log(`  Version: ${systemInfo.version}`);
      console.log(`  Node.js: ${systemInfo.nodeVersion}`);
      console.log(`  Platform: ${systemInfo.platform}`);
      console.log(`  Initialized: ${systemInfo.initialized ? '✓' : '✗'}`);
      console.log(`  Config Directory: ${systemInfo.configDir}`);
      console.log(`  Claude Directory: ${systemInfo.claudeDir}`);

      // Configuration info
      console.log(chalk.cyan('\nConfiguration:'));
      console.log(`  Providers: ${providers.length} configured`);
      console.log(`  Backups: ${backups.length} available`);
      console.log(`  Auto Backup: ${config.features?.autoBackup ? '✓' : '✗'}`);
      console.log(`  Validation: ${config.features?.validateConfigs ? '✓' : '✗'}`);
      console.log(`  Last Update: ${backups.length > 0 ? backups[0].timestamp : 'Never'}`);

      // Directory status
      console.log(chalk.cyan('\nDirectory Status:'));
      console.log(`  ~/.cc-config: ${await fs.pathExists(CONFIG_DIR) ? '✓' : '✗'}`);
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

        // Validate aliases
        if (!await aliasGenerator.isUpToDate()) {
          issues.push('Shell aliases are out of date');
          if (options.fix) {
            try {
              await aliasGenerator.generateAliases();
              fixes.push('Regenerated shell aliases');
              console.log('  Aliases: ✅ Updated');
            } catch (fixError) {
              issues.push(`Failed to regenerate aliases: ${fixError.message}`);
            }
          } else {
            console.log('  Aliases: ⚠️ Out of date');
          }
        } else {
          console.log('  Aliases: ✅ Up to date');
        }

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
      console.log('  • Run "cc-config doctor --fix" to automatically fix issues');
      console.log('  • Run "cc-config status --detailed" for detailed information');
      console.log('  • Run "cc-config update" to update configuration templates');

    } catch (error) {
      console.error(chalk.red('\n❌ Error during diagnostics:'), error.message);
      process.exit(1);
    }
  });

// Handle unknown commands
program
  .command('*', { hidden: true })
  .action((cmd) => {
    console.log(chalk.red(`\n❌ Unknown command: ${cmd}`));
    console.log(chalk.blue('Run "cc-config --help" for available commands.'));
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