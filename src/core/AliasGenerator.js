/**
 * Alias Generator
 * 
 * Generates shell aliases for Claude Code providers.
 * Enhanced with security validation, error handling, and shell compatibility.
 * 
 * @class
 * @example
 * const AliasGenerator = require('./AliasGenerator');
 * const aliasGenerator = new AliasGenerator('/path/to/config');
 * 
 * // Generate aliases for all providers
 * await aliasGenerator.generateAliases();
 * 
 * // Preview aliases without writing
 * const preview = await aliasGenerator.previewAliases();
 * console.log(preview);
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * @typedef {Object} ProviderConfig
 * @property {string} alias - Provider alias
 * @property {string} baseURL - Provider base URL
 * @property {string} apiKey - Provider API key
 * @property {number} [timeout] - Request timeout
 */

/**
 * @typedef {Object} AliasStats
 * @property {number} totalProviders - Total number of providers
 * @property {string[]} aliases - Array of provider aliases
 * @property {string[]} baseURLs - Array of unique base URLs
 * @property {Date|null} lastGenerated - Last generation timestamp
 */

/**
 * @typedef {Object} EnhancedStats
 * @property {number} totalProviders - Total number of providers
 * @property {string[]} aliases - Array of provider aliases
 * @property {string[]} baseURLs - Array of unique base URLs
 * @property {Date|null} lastGenerated - Last generation timestamp
 * @property {string} shellType - Detected shell type
 * @property {boolean} shellCompatible - Whether shell is compatible
 * @property {string} version - AliasGenerator version
 * @property {Object} security - Security settings
 * @property {number} security.maxAliasLength - Maximum alias length
 * @property {boolean} security.validationEnabled - Whether validation is enabled
 * @property {Object} file - File information
 * @property {string} file.path - Aliases file path
 * @property {boolean} file.exists - Whether aliases file exists
 * @property {boolean} file.upToDate - Whether aliases file is up to date
 * @property {number} file.size - Aliases file size in bytes
 */

/**
 * @typedef {Object} ReloadResult
 * @property {boolean} success - Whether reload was successful
 * @property {string} [method] - Reload method used
 * @property {string} [reason] - Reason for failure
 */

class AliasGenerator {
  /**
   * Create a new AliasGenerator instance
   * 
   * @param {string} configDir - Configuration directory path
   * @throws {Error} If configDir is not provided
   * 
   * @example
   * const aliasGenerator = new AliasGenerator('/home/user/.claude/ccvm');
   */
  constructor(configDir) {
    this.configDir = configDir;
    this.providersDir = path.join(configDir, 'providers');
    this.aliasesFile = path.join(configDir, 'aliases.sh');
    this.lockFile = path.join(configDir, '.alias-lock');
    
    // Security and validation settings
    this.maxAliasLength = 32;
    this.version = '2.0.0';
    
    // Shell compatibility detection
    this.shellType = this._detectShell();
  }

  /**
   * Generate aliases for all configured providers with enhanced security
   * 
   * @param {Object} [options] - Generation options
   * @param {boolean} [options.autoReload=true] - Whether to automatically trigger shell reload
   * @returns {Promise<void>}
   * @throws {Error} If alias generation fails
   * 
   * @example
   * await aliasGenerator.generateAliases({ autoReload: true });
   */
  async generateAliases(options = {}) {
    try {
      await this._acquireLock('generate');
      
      // Load and validate providers
      const providers = await this.loadProviders();
      await this._validateProviders(providers);
      
      // Generate alias content
      const aliasContent = await this.buildAliasContent(providers);
      
      // Create backup of existing aliases file
      await this._backupExistingAliases();
      
      // Write new aliases file with secure permissions
      await fs.writeFile(this.aliasesFile, aliasContent, { mode: 0o644 });
      
      // Verify the generated file
      await this._verifyAliasesFile();
      
      await this._releaseLock();

      // Automatically trigger shell reload if requested
      if (options.autoReload !== false) {
        await this.triggerShellReload();
      }
      
    } catch (error) {
      await this._releaseLock();
      throw new Error(`Failed to generate aliases: ${error.message}`);
    }
  }

  /**
   * Load all provider configurations
   * 
   * @returns {Promise<ProviderConfig[]>} Array of provider configurations sorted by alias
   * 
   * @example
   * const providers = await aliasGenerator.loadProviders();
   * providers.forEach(provider => {
   *   console.log(`${provider.alias}: ${provider.baseURL}`);
   * });
   */
  async loadProviders() {
    try {
      if (!await fs.pathExists(this.providersDir)) {
        return [];
      }

      const files = await fs.readdir(this.providersDir);
      const providers = [];

      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const provider = await fs.readJson(path.join(this.providersDir, file));
            if (provider && provider.alias) {
              providers.push(provider);
            }
          } catch (error) {
            console.warn(`Warning: Failed to read provider file ${file}: ${error.message}`);
          }
        }
      }

      return providers.sort((a, b) => a.alias.localeCompare(b.alias));
    } catch (error) {
      console.warn(`Warning: Failed to load providers: ${error.message}`);
      return [];
    }
  }

  /**
   * Build the complete alias file content
   * 
   * @param {ProviderConfig[]} providers - Array of provider configurations
   * @returns {Promise<string>} Complete alias file content
   * 
   * @example
   * const content = await aliasGenerator.buildAliasContent(providers);
   * console.log(content);
   */
  async buildAliasContent(providers) {
    const header = this.generateHeader();
    const helperFunctions = this.generateHelperFunctions();
    const aliases = this.generateProviderAliases(providers);
    const defaultClaude = await this.generateDefaultClaudeAlias();
    const footer = this.generateFooter(providers);

    return [header, helperFunctions, aliases, defaultClaude, footer].join('\n\n');
  }

  /**
   * Generate file header
   * 
   * @returns {string} File header content
   * 
   * @example
   * const header = aliasGenerator.generateHeader();
   * console.log(header);
   */
  generateHeader() {
    return `# Claude Code Kit - Auto-generated aliases
# This file is automatically generated. Do not edit manually.
# Generated on: ${new Date().toISOString()}
#
# Usage:
#   Source this file in your shell configuration (.zshrc, .bashrc)
#   Each provider creates an alias that loads the appropriate configuration
#
# Example:
#   claude "Hello, how are you?"    # Uses default provider
#   cc "Explain React hooks"        # Uses custom provider if configured`;
  }

  /**
   * Generate enhanced helper functions with better error handling
   * 
   * @returns {string} Shell helper functions content
   * 
   * @example
   * const helpers = aliasGenerator.generateHelperFunctions();
   * console.log(helpers);
   */
  generateHelperFunctions() {
    return `# Claude Code Kit Helper Functions v${this.version}
# Shell: ${this.shellType}
# Generated: ${new Date().toISOString()}

# Check if claude CLI is available
_cc_check_claude_cli() {
    if ! command -v claude >/dev/null 2>&1; then
        echo "Error: Claude CLI is not installed or not in PATH" >&2
        echo "Install with: npm install -g @anthropic-ai/claude-cli" >&2
        return 1
    fi
    return 0
}

# Enhanced helper function to load Claude configuration
_cc_load_config() {
    local config_file="$1"
    local provider_alias="$2"
    
    # Validate input parameters
    if [ -z "$config_file" ]; then
        echo "Error: No configuration file specified" >&2
        return 1
    fi
    
    if [ ! -f "$config_file" ]; then
        echo "Error: Provider configuration not found: $config_file" >&2
        echo "Run 'ccvm list' to see available providers" >&2
        return 1
    fi
    
    # Check file permissions for security
    local file_perms=$(stat -c "%a" "$config_file" 2>/dev/null || stat -f "%A" "$config_file" 2>/dev/null)
    if [ "$file_perms" != "600" ] && [ "$file_perms" != "644" ]; then
        echo "Warning: Provider configuration file has unusual permissions: $file_perms" >&2
    fi
    
    # Check if jq is available
    if ! command -v jq >/dev/null 2>&1; then
        echo "Error: jq is required for Claude Code Kit but not installed" >&2
        echo "Installation instructions:" >&2
        echo "  macOS:   brew install jq" >&2
        echo "  Ubuntu:  sudo apt-get install jq" >&2
        echo "  CentOS:  sudo yum install jq" >&2
        return 1
    fi
    
    # Load and validate configuration
    local json_content
    if ! json_content=$(cat "$config_file" 2>/dev/null); then
        echo "Error: Unable to read configuration file: $config_file" >&2
        return 1
    fi
    
    if ! echo "$json_content" | jq . >/dev/null 2>&1; then
        echo "Error: Invalid JSON in configuration file: $config_file" >&2
        echo "Run 'ccvm edit $provider_alias' to fix the configuration" >&2
        return 1
    fi
    
    # Extract configuration values
    local api_key=$(echo "$json_content" | jq -r ".apiKey // empty")
    local base_url=$(echo "$json_content" | jq -r ".baseURL // empty")
    local timeout=$(echo "$json_content" | jq -r ".timeout // \\"3000000\\"")
    
    # Validate required fields
    if [ -z "$api_key" ] || [ "$api_key" = "null" ]; then
        echo "Error: Invalid or missing API key in $config_file" >&2
        echo "Run 'ccvm edit $provider_alias' to set the API key" >&2
        return 1
    fi
    
    if [ -z "$base_url" ] || [ "$base_url" = "null" ]; then
        echo "Error: Invalid or missing base URL in $config_file" >&2
        echo "Run 'ccvm edit $provider_alias' to set the base URL" >&2
        return 1
    fi
    
    # Validate API key format (basic check)
    if [ \${#api_key} -lt 10 ]; then
        echo "Warning: API key appears to be too short" >&2
    fi
    
    # Validate URL format
    if ! echo "$base_url" | grep -qE '^https?://'; then
        echo "Warning: Base URL does not appear to be a valid HTTP(S) URL" >&2
    fi
    
    # Set environment variables
    export ANTHROPIC_AUTH_TOKEN="$api_key"
    export ANTHROPIC_BASE_URL="$base_url"
    export API_TIMEOUT_MS="$timeout"
    
    # Update last used timestamp (optional, silent fail)
    if command -v ccvm >/dev/null 2>&1; then
        # Last used tracking removed in simplified version
    fi
    
    return 0
}

# Enhanced helper function to check if Claude CLI is available
_cc_check_claude_cli() {
    if ! command -v claude >/dev/null 2>&1; then
        echo "Error: Claude CLI not found in PATH" >&2
        echo "" >&2
        echo "Installation instructions:" >&2
        echo "  npm install -g @anthropic-ai/claude-code" >&2
        echo "" >&2
        echo "If already installed, check your PATH or restart your terminal" >&2
        return 1
    fi
    
    # Verify Claude CLI is working
    if ! claude --version >/dev/null 2>&1; then
        echo "Error: Claude CLI is installed but not working properly" >&2
        echo "Try reinstalling: npm uninstall -g @anthropic-ai/claude-code && npm install -g @anthropic-ai/claude-code" >&2
        return 1
    fi
    
    return 0
}


# Function to check if aliases need auto-reload
_cc_check_auto_reload() {
    local aliases_file="$HOME/.claude/ccvm/aliases.sh"
    local providers_dir="$HOME/.claude/ccvm/providers"
    
    # Skip check if no aliases file exists
    if [ ! -f "$aliases_file" ]; then
        return 1
    fi
    
    # Skip check if no providers directory exists
    if [ ! -d "$providers_dir" ]; then
        return 1
    fi
    
    # Get aliases file timestamp
    local aliases_time=$(stat -c %Y "$aliases_file" 2>/dev/null || stat -f %m "$aliases_file" 2>/dev/null)
    
    # Check if any provider file is newer than aliases file
    for provider_file in "$providers_dir"/*.json; do
        if [ -f "$provider_file" ]; then
            local provider_time=$(stat -c %Y "$provider_file" 2>/dev/null || stat -f %m "$provider_file" 2>/dev/null)
            if [ "$provider_time" -gt "$aliases_time" ]; then
                return 0  # Need reload
            fi
        fi
    done
    
    return 1  # No reload needed
}

# Function to perform auto-reload of aliases
_cc_auto_reload() {
    # Check if ccvm command is available
    if ! command -v ccvm >/dev/null 2>&1; then
        return 1
    fi
    
    # Silently regenerate aliases
    if ccvm doctor --fix >/dev/null 2>&1; then
        # Re-source the updated aliases file
        if [ -f "$HOME/.claude/ccvm/aliases.sh" ]; then
            source "$HOME/.claude/ccvm/aliases.sh"
            echo "✅ Configuration automatically updated" >&2
            return 0
        fi
    fi
    
    return 1
}

# Function to safely execute claude with error handling
_cc_claude_exec() {
    local provider_alias="$1"
    shift
    
    # Auto-reload check: if configuration is outdated, reload it
    if _cc_check_auto_reload; then
        _cc_auto_reload
    fi
    
    # Check prerequisites
    if ! _cc_check_claude_cli; then
        return 1
    fi
    
    # Ensure environment is clean before loading new config
    unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL API_TIMEOUT_MS
    
    # Load provider configuration
    local config_file="\${CC_PROVIDERS_DIR:-$HOME/.claude/ccvm/providers}/$provider_alias.json"
    if ! _cc_load_config "$config_file" "$provider_alias"; then
        return 1
    fi
    
    # Execute claude with error handling
    if ! claude "$@"; then
        local exit_code=$?
        echo "Error: Claude command failed (exit code: $exit_code)" >&2
        echo "Provider: $provider_alias" >&2
        echo "Arguments: $*" >&2
        return $exit_code
    fi
    
    return 0
}

# Dynamic claude function - reads current default provider from config
_cc_claude_exec_dynamic() {
    # Check prerequisites
    if ! _cc_check_claude_cli; then
        return 1
    fi
    
    # Read current default provider from config
    local config_file="\${CC_CONFIG_DIR:-$HOME/.claude/ccvm}/config.json"
    local default_provider=""
    
    if [ ! -f "$config_file" ]; then
        echo "Error: CCVM not configured" >&2
        echo "Run 'ccvm add' to add your first provider" >&2
        return 1
    fi
    
    # Extract default provider using jq
    if command -v jq >/dev/null 2>&1; then
        default_provider=$(jq -r '.defaultProvider // empty' "$config_file" 2>/dev/null)
    else
        echo "Error: jq is required but not installed" >&2
        echo "Install with: brew install jq" >&2
        return 1
    fi
    
    # Check if default provider is set
    if [ -z "$default_provider" ] || [ "$default_provider" = "null" ]; then
        echo "Error: No default provider configured" >&2
        echo "Run 'ccvm use <alias>' to set a default provider" >&2
        echo "Available providers:" >&2
        ccvm list 2>/dev/null || echo "  (run 'ccvm add' to add one)" >&2
        return 1
    fi
    
    # Use the existing _cc_claude_exec function with the default provider
    _cc_claude_exec "$default_provider" "$@"
}

# Function to list all providers
claude-providers() {
    if ! command -v ccvm >/dev/null 2>&1; then
        echo "Error: ccvm command not found" >&2
        return 1
    fi
    ccvm list
}

# Function to reload aliases
claude-reload() {
    if ! command -v ccvm >/dev/null 2>&1; then
        echo "Error: ccvm command not found" >&2
        return 1
    fi
    echo "Reloading Claude Code Kit aliases..."
    if ccvm doctor --fix >/dev/null 2>&1; then
        echo "✅ Aliases reloaded successfully"
        # Re-source this file to apply changes
        if [ -f "$HOME/.claude/ccvm/aliases.sh" ]; then
            source "$HOME/.claude/ccvm/aliases.sh"
        fi
    else
        echo "❌ Failed to reload aliases" >&2
        return 1
    fi
}`;
  }

  /**
   * Generate aliases for providers (simplified - no individual aliases)
   * 
   * @param {ProviderConfig[]} providers - Array of provider configurations
   * @returns {string} Provider aliases section content
   * 
   * @example
   * const aliases = aliasGenerator.generateProviderAliases(providers);
   * console.log(aliases);
   */
  generateProviderAliases(providers) {
    if (providers.length === 0) {
      return `# No providers configured yet
# Run 'ccvm add' to add your first provider`;
    }

    // Generate shell aliases for each provider
    const providerAliases = providers.map(provider => 
      `alias ${provider.alias}='_cc_load_config && _cc_claude_exec_dynamic'`
    ).join('\n');

    return `# Provider aliases:
${providerAliases}`;
  }

  /**
   * Generate file footer
   * 
   * @param {ProviderConfig[]} providers - Array of provider configurations
   * @returns {string} File footer content
   * 
   * @example
   * const footer = aliasGenerator.generateFooter(providers);
   * console.log(footer);
   */
  generateFooter(providers) {
    const providerCount = providers.length;

    return `# Claude Code Kit - Simplified Configuration
# Total providers configured: ${providerCount}
#
# Usage:
#   claude "your message"              # Uses current default provider
#
# Management commands:
#   ccvm list                          # List all providers
#   ccvm use <alias>                   # Switch default provider  
#   ccvm add                           # Add a new provider
#   ccvm status                        # Show system status
#
# ✨ No manual reload needed - changes take effect immediately!
# For more information: https://github.com/kedoupi/claude-code-kit`;
  }

  /**
   * Generate default claude alias based on configuration
   * 
   * @returns {Promise<string>} Default claude alias definition
   * 
   * @example
   * const defaultAlias = await aliasGenerator.generateDefaultClaudeAlias();
   * console.log(defaultAlias);
   */
  async generateDefaultClaudeAlias() {
    try {
      return `# Dynamic claude command (automatically uses current default provider)
alias claude='_cc_claude_exec_dynamic'`;
    } catch (error) {
      return '# Error generating default claude alias';
    }
  }

  /**
   * Generate footer with provider statistics and available commands
   * 
   * @param {ProviderConfig[]} providers - Array of provider configurations
   * @returns {string} Footer content with statistics and commands
   * 
   * @example
   * const footer = aliasGenerator.generateFooter(providers);
   * console.log(footer);
   */
  generateFooter(providers) {
    const providerCount = providers.length;

    let footer = `# Claude Code Kit Statistics
# Total providers configured: ${providerCount}
# Available commands:
#   claude-providers()          - List all providers
#   claude-reload()              - Reload aliases`;

    if (providerCount > 0) {
      footer += '\n#\n# Configured providers:';
      providers.forEach(provider => {
        footer += `\n#   ${provider.alias}: ${provider.baseURL}`;
      });
    } else {
      footer += '\n#\n# (none configured)';
    }

    return footer;
  }

  /**
   * Validate alias name
   * 
   * @param {string} alias - Alias to validate
   * @returns {void}
   * @throws {Error} If alias is invalid
   * 
   * @example
   * try {
   *   aliasGenerator.validateAlias('my-provider');
   *   console.log('Alias is valid');
   * } catch (error) {
   *   console.error('Invalid alias:', error.message);
   * }
   */
  validateAlias(alias) {
    // Check for valid alias format
    if (!/^[a-zA-Z0-9-_]+$/.test(alias)) {
      throw new Error('Alias can only contain letters, numbers, hyphens, and underscores');
    }

    // Check for shell reserved words
    const reservedWords = [
      'alias', 'bg', 'bind', 'break', 'builtin', 'caller', 'cd', 'command',
      'compgen', 'complete', 'compopt', 'continue', 'declare', 'dirs', 'disown',
      'echo', 'enable', 'eval', 'exec', 'exit', 'export', 'false', 'fc',
      'fg', 'getopts', 'hash', 'help', 'history', 'if', 'jobs', 'kill',
      'let', 'local', 'logout', 'mapfile', 'popd', 'printf', 'pushd',
      'pwd', 'read', 'readonly', 'return', 'set', 'shift', 'shopt',
      'source', 'suspend', 'test', 'times', 'trap', 'true', 'type',
      'typeset', 'ulimit', 'umask', 'unalias', 'unset', 'wait'
    ];

    if (reservedWords.includes(alias)) {
      throw new Error(`'${alias}' is a shell reserved word and cannot be used as an alias`);
    }

    // Check for common command conflicts
    const commonCommands = [
      'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'find',
      'grep', 'sed', 'awk', 'cat', 'less', 'more', 'head', 'tail',
      'sort', 'uniq', 'wc', 'diff', 'tar', 'gzip', 'curl', 'wget',
      'ssh', 'scp', 'rsync', 'git', 'npm', 'node', 'python', 'java'
    ];

    if (commonCommands.includes(alias)) {
      console.warn(`Warning: '${alias}' conflicts with a common command. Consider using a different alias.`);
    }
  }

  /**
   * Get alias statistics
   * 
   * @returns {Promise<AliasStats>} Alias statistics
   * 
   * @example
   * const stats = await aliasGenerator.getStats();
   * console.log(`Total providers: ${stats.totalProviders}`);
   * console.log(`Aliases: ${stats.aliases.join(', ')}`);
   */
  async getStats() {
    const providers = await this.loadProviders();
    
    return {
      totalProviders: providers.length,
      aliases: providers.map(p => p.alias),
      baseURLs: [...new Set(providers.map(p => p.baseURL))],
      lastGenerated: await this.getLastGeneratedTime()
    };
  }

  /**
   * Get last generated timestamp
   * 
   * @returns {Promise<Date|null>} Last generation timestamp or null if never generated
   * 
   * @example
   * const lastTime = await aliasGenerator.getLastGeneratedTime();
   * if (lastTime) {
   *   console.log('Last generated:', lastTime);
   * }
   */
  async getLastGeneratedTime() {
    try {
      if (!await fs.pathExists(this.aliasesFile)) {
        return null;
      }

      const stats = await fs.stat(this.aliasesFile);
      return stats.mtime;
    } catch {
      return null;
    }
  }

  /**
   * Check if aliases file is up to date
   * 
   * @returns {Promise<boolean>} True if aliases file is up to date
   * 
   * @example
   * const isCurrent = await aliasGenerator.isUpToDate();
   * if (!isCurrent) {
   *   console.log('Aliases need to be regenerated');
   * }
   */
  async isUpToDate() {
    try {
      const aliasesTime = await this.getLastGeneratedTime();
      if (!aliasesTime) {
        return false;
      }

      // Check if any provider file is newer than aliases file
      const files = await fs.readdir(this.providersDir);
      
      for (const file of files) {
        if (path.extname(file) === '.json') {
          const providerFile = path.join(this.providersDir, file);
          const providerStats = await fs.stat(providerFile);
          
          if (providerStats.mtime > aliasesTime) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Preview aliases without writing to file
   * 
   * @returns {Promise<string>} Complete alias file content
   * 
   * @example
   * const preview = await aliasGenerator.previewAliases();
   * console.log('Preview:');
   * console.log(preview);
   */
  async previewAliases() {
    const providers = await this.loadProviders();
    return await this.buildAliasContent(providers);
  }

  /**
   * Detect shell type for compatibility
   * 
   * @private
   * @returns {string} Detected shell type (zsh, bash, fish, dash, or unknown)
   */
  _detectShell() {
    const shell = process.env.SHELL || 'unknown';
    
    if (shell.includes('zsh')) {
      return 'zsh';
    }
    if (shell.includes('bash')) {
      return 'bash';
    }
    if (shell.includes('fish')) {
      return 'fish';
    }
    if (shell.includes('dash')) {
      return 'dash';
    }
    
    return 'unknown';
  }

  /**
   * Acquire lock for alias operations
   */
  async _acquireLock(operation) {
    // Ensure config directory exists before checking lock
    await fs.ensureDir(this.configDir);
    
    if (await fs.pathExists(this.lockFile)) {
      const lockContent = await fs.readFile(this.lockFile, 'utf8').catch(() => '{}');
      try {
        const lock = JSON.parse(lockContent);
        const lockAge = Date.now() - new Date(lock.created).getTime();
        
        // If lock is older than 2 minutes, consider it stale
        if (lockAge > 2 * 60 * 1000) {
          await fs.remove(this.lockFile);
        } else {
          throw new Error(`Alias operation locked by ${lock.operation} since ${lock.created}`);
        }
      } catch (parseError) {
        await fs.remove(this.lockFile);
      }
    }

    const lockData = {
      operation,
      pid: process.pid,
      created: new Date().toISOString()
    };
    
    await fs.writeJson(this.lockFile, lockData);
  }

  /**
   * Release lock for alias operations
   */
  async _releaseLock() {
    if (await fs.pathExists(this.lockFile)) {
      await fs.remove(this.lockFile);
    }
  }

  /**
   * Validate providers for security issues
   */
  async _validateProviders(providers) {
    for (const provider of providers) {
      // Validate alias
      if (!provider.alias || typeof provider.alias !== 'string') {
        throw new Error(`Invalid provider alias: ${provider.alias}`);
      }
      
      if (provider.alias.length > this.maxAliasLength) {
        throw new Error(`Provider alias too long: ${provider.alias} (max ${this.maxAliasLength} chars)`);
      }
      
      // Check for shell injection attempts
      if (provider.alias.includes(';') || provider.alias.includes('|') || 
          provider.alias.includes('&') || provider.alias.includes('`') ||
          provider.alias.includes('$') || provider.alias.includes('(') ||
          provider.alias.includes(')')) {
        throw new Error(`Provider alias contains potentially dangerous characters: ${provider.alias}`);
      }
      
      // Validate using existing method
      this.validateAlias(provider.alias);
    }
  }

  /**
   * Backup existing aliases file
   */
  async _backupExistingAliases() {
    if (await fs.pathExists(this.aliasesFile)) {
      const backupFile = `${this.aliasesFile}.backup-${Date.now()}`;
      await fs.copy(this.aliasesFile, backupFile);
      
      // Keep only the 3 most recent backups
      const backupPattern = `${this.aliasesFile}.backup-`;
      const dir = path.dirname(this.aliasesFile);
      const files = await fs.readdir(dir);
      
      const backupFiles = files
        .filter(file => file.startsWith(path.basename(backupPattern)))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          time: parseInt(file.split('-').pop()) || 0
        }))
        .sort((a, b) => b.time - a.time);
      
      // Remove old backups
      for (const backup of backupFiles.slice(3)) {
        await fs.remove(backup.path).catch(() => {});
      }
    }
  }

  /**
   * Verify the generated aliases file
   */
  async _verifyAliasesFile() {
    if (!await fs.pathExists(this.aliasesFile)) {
      throw new Error('Aliases file was not created');
    }
    
    const content = await fs.readFile(this.aliasesFile, 'utf8');
    
    // Basic validation
    if (content.length === 0) {
      throw new Error('Generated aliases file is empty');
    }
    
    if (!content.includes('Claude Code Kit')) {
      throw new Error('Generated aliases file does not contain expected header');
    }
    
    // Check for potential shell injection
    const dangerousPatterns = [
      /;\s*rm\s+/g,
      /;\s*sudo\s+/g,
      /\|\s*sh\s*$/g,
      /`[^`]*rm[^`]*`/g,  // More specific - only flag backticks with rm
      /\$\([^)]*rm[^)]*\)/g  // More specific - only flag command substitution with rm
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Generated aliases file contains potentially dangerous content`);
      }
    }
  }

  /**
   * Get enhanced statistics including shell compatibility
   * 
   * @returns {Promise<EnhancedStats>} Enhanced alias statistics
   * 
   * @example
   * const stats = await aliasGenerator.getEnhancedStats();
   * console.log(`Shell type: ${stats.shellType}`);
   * console.log(`File size: ${stats.file.size} bytes`);
   */
  async getEnhancedStats() {
    const basicStats = await this.getStats();
    
    return {
      ...basicStats,
      shellType: this.shellType,
      shellCompatible: this.shellType !== 'unknown',
      version: this.version,
      security: {
        maxAliasLength: this.maxAliasLength,
        validationEnabled: true
      },
      file: {
        path: this.aliasesFile,
        exists: await fs.pathExists(this.aliasesFile),
        upToDate: await this.isUpToDate(),
        size: await this._getFileSize()
      }
    };
  }

  /**
   * Get aliases file size
   */
  async _getFileSize() {
    try {
      if (!await fs.pathExists(this.aliasesFile)) {
        return 0;
      }
      const stats = await fs.stat(this.aliasesFile);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Automatically trigger shell reload of aliases
   * 
   * @returns {Promise<ReloadResult>} Reload result
   * 
   * @example
   * const result = await aliasGenerator.triggerShellReload();
   * if (result.success) {
   *   console.log('Reload successful');
   * } else {
   *   console.log('Reload failed:', result.reason);
   * }
   */
  async triggerShellReload() {
    try {
      // Create a signal file that the shell wrapper can detect
      const reloadSignalFile = path.join(this.configDir, '.reload-aliases');
      await fs.writeFile(reloadSignalFile, Date.now().toString());
      
      console.log('✅ Aliases updated - reload signal created');
      return { success: true, method: 'signal-file' };
    } catch (error) {
      console.warn(`Warning: Could not create reload signal: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }


  /**
   * Create a shell integration hint file for better reload support
   * 
   * @returns {Promise<string>} Path to created hint file
   * 
   * @example
   * const hintFile = await aliasGenerator.createShellIntegrationHint();
   * console.log('Integration hint created:', hintFile);
   */
  async createShellIntegrationHint() {
    const hintFile = path.join(this.configDir, '.shell-integration');
    const hintContent = {
      instructions: {
        zsh: 'Add to ~/.zshrc: source ~/.claude/ccvm/aliases.sh',
        bash: 'Add to ~/.bashrc: source ~/.claude/ccvm/aliases.sh', 
        fish: 'Add to ~/.config/fish/config.fish: source ~/.claude/ccvm/aliases.sh'
      },
      autoReload: {
        command: 'claude-reload',
        description: 'Reload aliases in current session'
      },
      created: new Date().toISOString(),
      version: this.version
    };

    await fs.writeJson(hintFile, hintContent, { spaces: 2 });
    return hintFile;
  }
}

module.exports = AliasGenerator;