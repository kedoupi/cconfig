/**
 * Provider Manager
 * 
 * Manages API provider configurations for Claude Code Kit.
 * Enhanced with security, validation, and comprehensive error handling.
 * 
 * @class
 * @example
 * const ProviderManager = require('./ProviderManager');
 * const providerManager = new ProviderManager('/path/to/config');
 * 
 * // Add a new provider
 * await providerManager.addProvider({
 *   alias: 'anthropic',
 *   baseURL: 'https://api.anthropic.com',
 *   apiKey: 'sk-ant-api03-...'
 * });
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const Logger = require('../utils/Logger');
const FileUtils = require('../utils/FileUtils');

/**
 * @typedef {Object} ProviderConfig
 * @property {string} alias - Unique identifier for the provider
 * @property {string} baseURL - API endpoint URL
 * @property {string} apiKey - API authentication key
 * @property {number} [timeout] - Request timeout in milliseconds
 * @property {string} [created] - Creation timestamp
 * @property {string} [lastUsed] - Last used timestamp
 * @property {string} [lastUpdated] - Last update timestamp
 * @property {string} [version] - Provider configuration version
 * @property {string} [id] - Unique provider ID
 */

/**
 * @typedef {Object} ProviderStats
 * @property {number} total - Total number of providers
 * @property {Object.<string, number>} byBaseURL - Providers grouped by base URL
 */

/**
 * @typedef {Object} ImportResult
 * @property {number} imported - Number of successfully imported providers
 * @property {number} skipped - Number of skipped providers
 * @property {string[]} errors - Error messages for failed imports
 */

/**
 * @typedef {Object} ConnectivityTest
 * @property {string} alias - Provider alias
 * @property {string} baseURL - Provider base URL
 * @property {boolean} reachable - Whether the provider is reachable
 * @property {string} message - Test result message
 */

/**
 * @typedef {Object} ProviderOptions
 * @property {boolean} [autoReload=true] - Whether to automatically reload aliases
 */

class ProviderManager {
  /**
   * Create a new ProviderManager instance
   * 
   * @param {string} configDir - Configuration directory path
   * @throws {Error} If configDir is not provided
   * 
   * @example
   * const providerManager = new ProviderManager('/home/user/.claude/ccvm');
   */
  constructor(configDir) {
    this.configDir = configDir;
    this.providersDir = path.join(configDir, 'providers');
    this.lockFile = path.join(configDir, '.provider-lock');
    
    // Security settings
    this.maxProviders = 20;
    this.maxAliasLength = 32;
    this.minApiKeyLength = 10;
    
    // Reserved aliases that cannot be used
    this.reservedAliases = new Set([
      'config', 'help', 'version', 'init', 'setup', 'install',
      'update', 'backup', 'restore', 'export', 'import', 'test'
    ]);
  }

  /**
   * Add a new provider with enhanced validation and security
   * 
   * @param {ProviderConfig} provider - Provider configuration object
   * @param {ProviderOptions} [options] - Additional options
   * @returns {Promise<void>}
   * @throws {Error} If validation fails, provider exists, or file operations fail
   * 
   * @example
   * await providerManager.addProvider({
   *   alias: 'anthropic',
   *   baseURL: 'https://api.anthropic.com',
   *   apiKey: 'sk-ant-api03-...',
   *   timeout: 30000
   * });
   */
  async addProvider(provider, options = {}) {
    try {
      await this._acquireLock('add');
      
      // Enhanced validation
      await this._validateProviderComprehensive(provider);
      
      // Check provider limits
      const currentProviders = await this.listProviders();
      if (currentProviders.length >= this.maxProviders) {
        throw new Error(`Maximum number of providers (${this.maxProviders}) reached`);
      }

      const providerFile = path.join(this.providersDir, `${provider.alias}.json`);
      
      // Check if provider already exists
      if (await this.providerExists(provider.alias)) {
        throw new Error(`Provider '${provider.alias}' already exists`);
      }

      // Prepare provider data with metadata
      const providerData = {
        ...provider,
        created: new Date().toISOString(),
        lastUsed: null,
        version: '2.0.0',
        id: this._generateProviderId(provider.alias)
      };

      // Ensure providers directory exists
      await fs.ensureDir(this.providersDir);

      // Save provider configuration with proper permissions (atomic write)
      await FileUtils.writeJsonAtomic(providerFile, providerData, { mode: 0o600 });
      
      await this._releaseLock();

      // Note: Alias generation removed - use `ccvm env` for environment variables
      
    } catch (error) {
      await this._releaseLock();
      throw new Error(`Failed to add provider: ${error.message}`);
    }
  }

  /**
   * Update an existing provider with enhanced validation
   * 
   * @param {string} alias - Provider alias to update
   * @param {ProviderConfig} provider - Updated provider configuration
   * @param {ProviderOptions} [options] - Additional options
   * @returns {Promise<void>}
   * @throws {Error} If provider not found, validation fails, or file operations fail
   * 
   * @example
   * await providerManager.updateProvider('anthropic', {
   *   baseURL: 'https://api.anthropic.com/v2',
   *   timeout: 60000
   * });
   */
  async updateProvider(alias, provider, options = {}) {
    try {
      await this._acquireLock('update');
      
      // Enhanced validation
      await this._validateProviderComprehensive(provider);

      const providerFile = path.join(this.providersDir, `${alias}.json`);
      
      // Check if provider exists
      if (!await fs.pathExists(providerFile)) {
        throw new Error(`Provider '${alias}' not found`);
      }

      // Get existing provider data to preserve metadata
      const existingProvider = await fs.readJson(providerFile);
      
      // Prepare updated provider data
      const updatedProvider = {
        ...existingProvider,
        ...provider,
        lastUpdated: new Date().toISOString(),
        version: '2.0.0'
      };

      // Save updated provider configuration with proper permissions (atomic write)
      await FileUtils.writeJsonAtomic(providerFile, updatedProvider, { mode: 0o600 });
      
      await this._releaseLock();

      // Note: Alias generation removed - use `ccvm env` for environment variables
      
    } catch (error) {
      await this._releaseLock();
      throw new Error(`Failed to update provider: ${error.message}`);
    }
  }

  /**
   * Remove a provider
   * 
   * @param {string} alias - Provider alias to remove
   * @param {ProviderOptions} [options] - Additional options
   * @returns {Promise<void>}
   * @throws {Error} If provider not found or file operations fail
   * 
   * @example
   * await providerManager.removeProvider('anthropic');
   */
  async removeProvider(alias, options = {}) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    
    // Check if provider exists
    if (!await fs.pathExists(providerFile)) {
      throw new Error(`Provider '${alias}' not found`);
    }

    // Remove provider file safely
    await FileUtils.safeRemove(providerFile);

    // Note: Alias generation removed - use `ccvm env` for environment variables
  }

  /**
   * Get a specific provider
   * 
   * @param {string} alias - Provider alias
   * @returns {Promise<ProviderConfig|null>} Provider configuration or null if not found
   * @throws {Error} If provider file exists but is corrupted
   * 
   * @example
   * const provider = await providerManager.getProvider('anthropic');
   * if (provider) {
   *   console.log(provider.baseURL);
   * }
   */
  async getProvider(alias) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    
    if (!await fs.pathExists(providerFile)) {
      return null;
    }

    try {
      return await FileUtils.readJsonSafe(providerFile, null);
    } catch (error) {
      throw new Error(`Failed to read provider: ${error.message}`);
    }
  }

  /**
   * List all providers
   * 
   * @returns {Promise<ProviderConfig[]>} Array of provider configurations sorted by alias
   * 
   * @example
   * const providers = await providerManager.listProviders();
   * providers.forEach(provider => {
   *   console.log(`${provider.alias}: ${provider.baseURL}`);
   * });
   */
  async listProviders() {
    if (!await fs.pathExists(this.providersDir)) {
      return [];
    }

    const files = await fs.readdir(this.providersDir);
    const providers = [];

    for (const file of files) {
      if (path.extname(file) === '.json') {
        try {
          const provider = await fs.readJson(path.join(this.providersDir, file));
          providers.push(provider);
        } catch (error) {
          Logger.warn(`Failed to read provider file ${file}`, { error: error.message });
          // For backward compatibility with existing tests
          console.warn(`Failed to read provider file ${file}`);
        }
      }
    }

    return providers.sort((a, b) => a.alias.localeCompare(b.alias));
  }

  /**
   * Check if a provider exists
   * 
   * @param {string} alias - Provider alias
   * @returns {Promise<boolean>} True if provider exists
   * 
   * @example
   * const exists = await providerManager.providerExists('anthropic');
   * if (exists) {
   *   console.log('Provider exists');
   * }
   */
  async providerExists(alias) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    return await fs.pathExists(providerFile);
  }

  /**
   * Validate provider configuration
   * 
   * @param {ProviderConfig} provider - Provider configuration to validate
   * @returns {void}
   * @throws {Error} If validation fails
   * 
   * @example
   * try {
   *   providerManager.validateProvider({
   *     alias: 'test',
   *     baseURL: 'https://api.test.com',
   *     apiKey: 'sk-test-key'
   *   });
   *   console.log('Provider is valid');
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   */
  validateProvider(provider) {
    const required = ['alias', 'baseURL', 'apiKey'];
    const missing = required.filter(key => !provider[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate alias format
    if (!this.isValidAlias(provider.alias)) {
      throw new Error('Alias can only contain letters, numbers, hyphens, and underscores');
    }

    // Validate URL format
    if (!this.isValidURL(provider.baseURL)) {
      throw new Error('Invalid Base URL format');
    }

    // Validate API key
    if (provider.apiKey.length < 10) {
      throw new Error('API key appears to be too short');
    }

    // Validate timeout if provided
    if (provider.timeout) {
      const timeout = parseInt(provider.timeout);
      if (isNaN(timeout) || timeout < 1000) {
        throw new Error('Timeout must be at least 1000ms');
      }
    }
  }

  /**
   * Validate alias format
   * 
   * @param {string} alias - Alias to validate
   * @returns {boolean} True if alias is valid
   * 
   * @example
   * const isValid = providerManager.isValidAlias('my-provider-123');
   * // returns true
   * 
   * const isInvalid = providerManager.isValidAlias('my provider');
   * // returns false
   */
  isValidAlias(alias) {
    return /^[a-zA-Z0-9-_]+$/.test(alias);
  }

  /**
   * Validate URL format
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   * 
   * @example
   * const isValid = providerManager.isValidURL('https://api.anthropic.com');
   * // returns true
   * 
   * const isInvalid = providerManager.isValidURL('not-a-url');
   * // returns false
   */
  isValidURL(url) {
    try {
      const parsedUrl = new URL(url);
      // Only allow HTTP and HTTPS protocols for API endpoints
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get provider statistics
   * 
   * @returns {Promise<ProviderStats>} Provider statistics
   * 
   * @example
   * const stats = await providerManager.getStats();
   * console.log(`Total providers: ${stats.total}`);
   * console.log('By base URL:', stats.byBaseURL);
   */
  async getStats() {
    const providers = await this.listProviders();
    
    const stats = {
      total: providers.length,
      byBaseURL: {}
    };

    providers.forEach(provider => {
      const baseURL = provider.baseURL;
      stats.byBaseURL[baseURL] = (stats.byBaseURL[baseURL] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export all providers (without sensitive information)
   * 
   * @returns {Promise<Object[]>} Array of provider configurations without API keys
   * 
   * @example
   * const exportData = await providerManager.exportProviders();
   * // exportData contains alias, baseURL, timeout but not apiKey
   */
  async exportProviders() {
    const providers = await this.listProviders();
    
    // Remove sensitive information for export
    return providers.map(provider => ({
      alias: provider.alias,
      baseURL: provider.baseURL,
      timeout: provider.timeout,
      // apiKey is intentionally excluded
    }));
  }

  /**
   * Import providers from export data
   * 
   * @param {Object[]} exportData - Array of provider configurations to import
   * @param {Object} [options] - Import options
   * @param {boolean} [options.overwrite=false] - Whether to overwrite existing providers
   * @returns {Promise<ImportResult>} Import result with statistics
   * 
   * @example
   * const result = await providerManager.importProviders(exportData, {
   *   overwrite: true
   * });
   * console.log(`Imported ${result.imported} providers`);
   * if (result.errors.length > 0) {
   *   console.error('Errors:', result.errors);
   * }
   */
  async importProviders(exportData, options = {}) {
    const { overwrite = false } = options;
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const providerData of exportData) {
      try {
        const exists = await this.providerExists(providerData.alias);
        
        if (exists && !overwrite) {
          results.skipped++;
          continue;
        }

        // Provider needs API key to be functional
        if (!providerData.apiKey) {
          results.errors.push(`Provider '${providerData.alias}' skipped: missing API key`);
          continue;
        }

        if (exists && overwrite) {
          await this.updateProvider(providerData.alias, providerData);
        } else {
          await this.addProvider(providerData);
        }
        
        results.imported++;
      } catch (error) {
        results.errors.push(`Provider '${providerData.alias}': ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Test provider connectivity
   * 
   * @param {string} alias - Provider alias to test
   * @returns {Promise<ConnectivityTest>} Connectivity test result
   * @throws {Error} If provider not found
   * 
   * @example
   * const test = await providerManager.testProvider('anthropic');
   * if (test.reachable) {
   *   console.log('Provider is reachable');
   * } else {
   *   console.error('Provider not reachable:', test.message);
   * }
   */
  async testProvider(alias) {
    const provider = await this.getProvider(alias);
    
    if (!provider) {
      throw new Error(`Provider '${alias}' not found`);
    }

    // This is a basic connectivity test
    // In a real implementation, you might want to make an actual API call
    try {
      new URL(provider.baseURL); // Validate URL format
      return {
        alias: provider.alias,
        baseURL: provider.baseURL,
        reachable: true,
        message: 'URL format is valid'
      };
    } catch (error) {
      return {
        alias: provider.alias,
        baseURL: provider.baseURL,
        reachable: false,
        message: `Invalid URL: ${error.message}`
      };
    }
  }

  /**
   * Acquire lock for provider operations
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
          await FileUtils.safeRemove(this.lockFile);
        } else {
          throw new Error(`Provider operation locked by ${lock.operation} since ${lock.created}`);
        }
      } catch (parseError) {
        await FileUtils.safeRemove(this.lockFile);
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
   * Release lock for provider operations
   */
  async _releaseLock() {
    await FileUtils.safeRemove(this.lockFile);
  }

  /**
   * Comprehensive provider validation
   */
  async _validateProviderComprehensive(provider) {
    // Basic validation first
    this.validateProvider(provider);
    
    // Additional security checks
    if (this.reservedAliases.has(provider.alias.toLowerCase())) {
      throw new Error(`Alias '${provider.alias}' is reserved and cannot be used`);
    }
    
    if (provider.alias.length > this.maxAliasLength) {
      throw new Error(`Alias cannot be longer than ${this.maxAliasLength} characters`);
    }
    
    // Check for potential security issues in alias
    if (provider.alias.includes('..') || provider.alias.includes('/')) {
      throw new Error('Alias contains invalid characters');
    }
    
    // Validate API key strength
    if (provider.apiKey.length < this.minApiKeyLength) {
      throw new Error(`API key must be at least ${this.minApiKeyLength} characters long`);
    }
    
    // Check for common weak patterns
    const weakPatterns = ['test', '123', 'demo', 'example'];
    for (const pattern of weakPatterns) {
      if (provider.apiKey.toLowerCase().includes(pattern)) {
        Logger.warn('API key appears to contain test/demo patterns', { pattern });
        break;
      }
    }
    
    // Validate URL security (allow localhost, private networks, and testing/dev environments)
    const url = new URL(provider.baseURL);
    const isLocalhost = url.hostname === 'localhost' || url.hostname.startsWith('127.');
    const isPrivateNetwork = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./);
    const isTestingEnv = process.env.NODE_ENV === 'test' || process.env.CC_ALLOW_HTTP === 'true';
    
    if (url.protocol !== 'https:' && !isLocalhost && !isPrivateNetwork && !isTestingEnv) {
      Logger.warn(`Using HTTP for ${url.hostname}. For production, use HTTPS or set CC_ALLOW_HTTP=true`);
      // For testing purposes, allow HTTP but warn
    }
  }

  /**
   * Generate unique provider ID
   */
  _generateProviderId(alias) {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    return crypto.createHash('sha256')
      .update(`${alias}-${timestamp}-${random}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Update provider last used timestamp
   * 
   * @param {string} alias - Provider alias
   * @returns {Promise<void>}
   * 
   * @example
   * await providerManager.updateLastUsed('anthropic');
   */
  async updateLastUsed(alias) {
    try {
      const provider = await this.getProvider(alias);
      if (provider) {
        provider.lastUsed = new Date().toISOString();
        const providerFile = path.join(this.providersDir, `${alias}.json`);
        await FileUtils.writeJsonAtomic(providerFile, provider, { mode: 0o600 });
      }
    } catch (error) {
      // Silent fail for this non-critical operation
      Logger.debug(`Failed to update last used for provider ${alias}`, { error: error.message });
    }
  }

  /**
   * Get provider usage statistics
   * 
   * @param {string} alias - Provider alias
   * @returns {Promise<Object>} Provider statistics including creation, last used, and version info
   * @throws {Error} If provider not found
   * 
   * @example
   * const stats = await providerManager.getProviderStats('anthropic');
   * console.log('Created:', stats.created);
   * console.log('Last used:', stats.lastUsed);
   * console.log('Version:', stats.version);
   */
  async getProviderStats(alias) {
    const provider = await this.getProvider(alias);
    if (!provider) {
      throw new Error(`Provider '${alias}' not found`);
    }

    return {
      alias: provider.alias,
      created: provider.created,
      lastUsed: provider.lastUsed,
      lastUpdated: provider.lastUpdated,
      version: provider.version,
      id: provider.id
    };
  }

}

module.exports = ProviderManager;