/**
 * Configuration Manager
 * 
 * Manages the overall configuration system for Claude Code Kit.
 * Enhanced with comprehensive error handling, validation, and recovery mechanisms.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Logger = require('../utils/Logger');
const FileUtils = require('../utils/FileUtils');

class ConfigManager {
  constructor(configDir = path.join(os.homedir(), '.claude', 'ccvm')) {
    this.configDir = configDir;
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.providersDir = path.join(configDir, 'providers');
    this.backupsDir = path.join(configDir, 'backups');
    this.aliasesFile = path.join(configDir, 'aliases.sh');
    this.lockFile = path.join(configDir, '.lock');
    this.configFile = path.join(configDir, 'config.json');
    
    // Default configuration (simplified - only actual used fields)
    this.defaultConfig = {
      version: '1.0.0',
      initialized: false,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      defaultProvider: null
    };
  }

  /**
   * Initialize the configuration system with comprehensive error handling
   */
  async init() {
    try {
      await this._acquireInitLock();
      await this._performInitialization();
    } catch (error) {
      throw new Error(`Configuration initialization failed: ${error.message}`);
    } finally {
      await this._releaseLock();
    }
  }

  /**
   * Perform the actual initialization steps
   */
  async _performInitialization() {
    await this._setupEnvironment();
    await this._validateAndRepair();
    await this._updateInitStatus();
  }

  /**
   * Setup the environment (directories and files)
   */
  async _setupEnvironment() {
    await this.ensureDirectories();
    await this.ensureFiles();
  }

  /**
   * Validate configuration and attempt repairs if needed
   */
  async _validateAndRepair() {
    const validation = await this.validateConfiguration();
    if (!validation.valid) {
      Logger.warn('Configuration validation issues found', { issues: validation.issues });
      await this._attemptAutoRepair(validation.issues);
    }
  }

  /**
   * Update initialization status
   */
  async _updateInitStatus() {
    await this._updateConfig({ 
      initialized: true, 
      lastUpdated: new Date().toISOString() 
    });
  }

  /**
   * Acquire initialization lock
   */
  async _acquireInitLock() {
    await this._checkLock();
    await this._createLock();
  }
  
  /**
   * Check for existing lock to prevent concurrent operations
   */
  async _checkLock() {
    // Ensure config directory exists before checking lock
    await fs.ensureDir(this.configDir);
    
    if (await fs.pathExists(this.lockFile)) {
      const lockContent = await fs.readFile(this.lockFile, 'utf8').catch(() => '{}');
      try {
        const lock = JSON.parse(lockContent);
        const lockAge = Date.now() - new Date(lock.created).getTime();
        
        // If lock is older than 5 minutes, consider it stale
        if (lockAge > 5 * 60 * 1000) {
          Logger.warn('Removing stale lock file', { lockFile: this.lockFile });
          await FileUtils.safeRemove(this.lockFile);
        } else {
          throw new Error(`Configuration is locked by process ${lock.pid} since ${lock.created}`);
        }
      } catch (parseError) {
        // Invalid lock file, remove it
        await FileUtils.safeRemove(this.lockFile);
      }
    }
  }
  
  /**
   * Create lock file
   */
  async _createLock() {
    const lockData = {
      pid: process.pid,
      created: new Date().toISOString(),
      operation: 'init'
    };
    await fs.writeJson(this.lockFile, lockData);
  }
  
  /**
   * Release lock file
   */
  async _releaseLock() {
    await FileUtils.safeRemove(this.lockFile);
  }

  /**
   * Ensure all required directories exist with proper permissions
   */
  async ensureDirectories() {
    const directories = [
      { path: this.configDir, description: 'Main config directory' },
      { path: this.providersDir, description: 'Providers directory' },
      { path: this.backupsDir, description: 'Backups directory' },
      { path: this.claudeDir, description: 'Claude config directory' },
      { path: path.join(this.claudeDir, 'commands'), description: 'Commands directory' },
      { path: path.join(this.claudeDir, 'agents'), description: 'Agents directory' },
      { path: path.join(this.claudeDir, 'output-styles'), description: 'Output styles directory' }
    ];

    await Promise.all(directories.map(async ({ path: dirPath, description }) => {
      try {
        await FileUtils.ensureDir(dirPath);
        await this._verifyWritable(dirPath);
      } catch (error) {
        throw new Error(`Failed to create or write to ${description} (${dirPath}): ${error.message}`);
      }
    }));
  }

  /**
   * Verify directory is writable
   */
  async _verifyWritable(dirPath) {
    const testFile = path.join(dirPath, '.write-test');
    await fs.writeFile(testFile, 'test');
    await FileUtils.safeRemove(testFile);
  }

  /**
   * Ensure all required files exist with proper content and validation
   */
  async ensureFiles() {
    const files = [
      {
        path: this.configFile,
        content: this.defaultConfig,
        description: 'Main configuration file'
      }
    ];

    // Create JSON files
    for (const { path: filePath, content, description } of files) {
      try {
        if (!await fs.pathExists(filePath)) {
          await fs.writeJson(filePath, content, { spaces: 2 });
        } else {
          // Validate existing file
          try {
            const existing = await fs.readJson(filePath);
            if (!existing.version) {
              // Migrate old format
              await fs.writeJson(filePath, { ...content, ...existing }, { spaces: 2 });
            }
          } catch (parseError) {
            Logger.warn('Recreating corrupted file', { file: filePath, description });
            await fs.writeJson(filePath, content, { spaces: 2 });
          }
        }
      } catch (error) {
        throw new Error(`Failed to create ${description}: ${error.message}`);
      }
    }

    // Create aliases file
    if (!await fs.pathExists(this.aliasesFile)) {
      const aliasContent = `# Claude Code Kit aliases
# This file is automatically generated. Do not edit manually.
# Generated on: ${new Date().toISOString()}

# Load function for dynamic configuration
_cc_load_config() {
    local config_file="$1"
    if [ -f "$config_file" ]; then
        export ANTHROPIC_AUTH_TOKEN=$(jq -r ".apiKey" "$config_file" 2>/dev/null || echo "")
        export ANTHROPIC_BASE_URL=$(jq -r ".baseURL" "$config_file" 2>/dev/null || echo "")
        export API_TIMEOUT_MS=$(jq -r ".timeout // \\"3000000\\"" "$config_file" 2>/dev/null || echo "3000000")
    fi
}

`;
      await fs.writeFile(this.aliasesFile, aliasContent);
    }

    // Create basic Claude settings if they don't exist
    const claudeSettingsFile = path.join(this.claudeDir, 'settings.json');
    if (!await fs.pathExists(claudeSettingsFile)) {
      const claudeSettings = {
        name: 'Claude Code Kit Configuration',
        description: 'Enhanced configuration for Claude Code',
        version: '2.0.0',
        created: new Date().toISOString(),
        apiSettings: {
          timeout: 3000000,
          retries: 3,
          backoff: 'exponential'
        },
        features: {
          autoSave: true,
          syntaxHighlighting: true,
          multiProvider: true
        }
      };
      await fs.writeJson(claudeSettingsFile, claudeSettings, { spaces: 2 });
    }

    // Create basic CLAUDE.md if it doesn't exist
    const claudeMdFile = path.join(this.claudeDir, 'CLAUDE.md');
    if (!await fs.pathExists(claudeMdFile)) {
      const claudeMdContent = `# Claude Code Configuration

This configuration has been set up by Claude Code Kit v2.0.0.

## Features
- Multi-provider support with automatic switching
- Enhanced error handling and retry logic
- Automatic backup and restore capabilities
- Shell integration with dynamic aliases

## Environment Variables
The following environment variables are automatically managed:
- \`ANTHROPIC_API_KEY\`: Your API key (set by provider aliases)
- \`ANTHROPIC_BASE_URL\`: API base URL (set by provider aliases)
- \`API_TIMEOUT_MS\`: Request timeout in milliseconds

## Provider Management
Use the \`cc-config\` command to manage providers:
- \`cc-config provider add\`: Add a new provider
- \`cc-config provider list\`: List all providers
- \`cc-config provider edit <alias>\`: Edit a provider
- \`cc-config provider remove <alias>\`: Remove a provider

## Backup and Restore
- \`cc-config history\`: View and restore backups
- \`cc-config status\`: Check system status

## Configuration Files
- Main config: \`~/.claude/ccvm/config.json\`
- Providers: \`~/.claude/ccvm/providers/*.json\`
- Aliases: \`~/.claude/ccvm/aliases.sh\`
- Backups: \`~/.claude/ccvm/backups/\`

For more information, visit: https://github.com/kedoupi/claude-code-kit
`;
      await fs.writeFile(claudeMdFile, claudeMdContent);
    }
  }

  /**
   * Get configuration directory path
   */
  getConfigDir() {
    return this.configDir;
  }

  /**
   * Get Claude directory path
   */
  getClaudeDir() {
    return this.claudeDir;
  }

  /**
   * Get providers directory path
   */
  getProvidersDir() {
    return this.providersDir;
  }

  /**
   * Get backups directory path
   */
  getBackupsDir() {
    return this.backupsDir;
  }

  /**
   * Get aliases file path
   */
  getAliasesFile() {
    return this.aliasesFile;
  }

  /**
   * Get config file path
   */
  getConfigFile() {
    return this.configFile;
  }


  /**
   * Check if the configuration system is properly initialized
   */
  async isInitialized() {
    const requiredPaths = [
      this.configDir,
      this.providersDir,
      this.backupsDir,
      this.claudeDir
    ];

    const results = await FileUtils.batchPathExists(requiredPaths);
    return results.every(r => r.exists);
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    return {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      configDir: this.configDir,
      claudeDir: this.claudeDir,
      initialized: await this.isInitialized()
    };
  }

  /**
   * Validate configuration integrity
   */
  async validateConfiguration() {
    const issues = [];

    // Check if required directories exist
    const requiredDirs = [
      { path: this.configDir, name: 'Config directory' },
      { path: this.providersDir, name: 'Providers directory' },
      { path: this.backupsDir, name: 'Backups directory' },
      { path: this.claudeDir, name: 'Claude directory' }
    ];

    const dirResults = await FileUtils.batchPathExists(requiredDirs.map(d => d.path));
    dirResults.forEach((result, index) => {
      if (!result.exists) {
        issues.push(`${requiredDirs[index].name} missing: ${result.path}`);
      }
    });

    // Check if required files exist
    const requiredFiles = [
      { path: this.aliasesFile, name: 'Aliases file' }
    ];

    const fileResults = await FileUtils.batchPathExists(requiredFiles.map(f => f.path));
    fileResults.forEach((result, index) => {
      if (!result.exists) {
        issues.push(`${requiredFiles[index].name} missing: ${result.path}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Update configuration file
   */
  async _updateConfig(updates) {
    try {
      const config = await FileUtils.readJsonSafe(this.configFile, this.defaultConfig);
      const updatedConfig = { ...config, ...updates, lastUpdated: new Date().toISOString() };
      await FileUtils.writeJsonAtomic(this.configFile, updatedConfig);
    } catch (error) {
      throw new Error(`Failed to update configuration: ${error.message}`);
    }
  }

  /**
   * Attempt automatic repair of configuration issues
   */
  async _attemptAutoRepair(issues) {
    for (const issue of issues) {
      try {
        if (issue.includes('missing')) {
          if (issue.includes('directory')) {
            await this.ensureDirectories();
          } else if (issue.includes('file')) {
            await this.ensureFiles();
          }
        }
      } catch (repairError) {
        Logger.warn('Failed to auto-repair issue', { issue, error: repairError.message });
      }
    }
  }

  /**
   * Get current configuration
   */
  async getConfig() {
    return await FileUtils.readJsonSafe(this.configFile, this.defaultConfig);
  }

  /**
   * Reset configuration to defaults
   */
  async reset() {
    try {
      await this._checkLock();
      await this._createLock();

      // Create backup before reset
      const BackupManager = require('./BackupManager');
      const backupManager = new BackupManager(this.configDir, this.claudeDir);
      await backupManager.createBackup('Pre-reset backup');

      // Remove and recreate directories
      await FileUtils.safeRemove(this.configDir);
      await FileUtils.safeRemove(this.claudeDir);

      // Reinitialize
      await this.init();

    } catch (error) {
      await this._releaseLock();
      throw new Error(`Reset failed: ${error.message}`);
    }
  }

  /**
   * Export configuration for backup or migration
   */
  async exportConfig() {
    const config = await this.getConfig();
    const systemInfo = await this.getSystemInfo();
    
    return {
      metadata: {
        exported: new Date().toISOString(),
        version: '2.0.0',
        platform: systemInfo.platform
      },
      config,
      // Note: Providers are handled separately for security
      directories: {
        configDir: this.configDir,
        claudeDir: this.claudeDir,
        providersDir: this.providersDir,
        backupsDir: this.backupsDir
      }
    };
  }
}

module.exports = ConfigManager;