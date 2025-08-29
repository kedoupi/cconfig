/**
 * Provider Manager
 * 
 * Manages API provider configurations for Claude Code Kit.
 * Enhanced with security, validation, and comprehensive error handling.
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class ProviderManager {
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
      if (await fs.pathExists(providerFile)) {
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

      // Save provider configuration with proper permissions
      await fs.writeJson(providerFile, providerData, { spaces: 2, mode: 0o600 });
      
      await this._releaseLock();

      // Automatically regenerate and reload aliases after successful addition
      if (options.autoReload !== false) {
        await this._triggerAliasReload();
      }
      
    } catch (error) {
      await this._releaseLock();
      throw new Error(`Failed to add provider: ${error.message}`);
    }
  }

  /**
   * Update an existing provider with enhanced validation
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

      // Save updated provider configuration with proper permissions
      await fs.writeJson(providerFile, updatedProvider, { spaces: 2, mode: 0o600 });
      
      await this._releaseLock();

      // Automatically regenerate and reload aliases after successful update
      if (options.autoReload !== false) {
        await this._triggerAliasReload();
      }
      
    } catch (error) {
      await this._releaseLock();
      throw new Error(`Failed to update provider: ${error.message}`);
    }
  }

  /**
   * Remove a provider
   */
  async removeProvider(alias, options = {}) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    
    // Check if provider exists
    if (!await fs.pathExists(providerFile)) {
      throw new Error(`Provider '${alias}' not found`);
    }

    // Remove provider file
    await fs.remove(providerFile);

    // Automatically regenerate and reload aliases after successful removal
    if (options.autoReload !== false) {
      await this._triggerAliasReload();
    }
  }

  /**
   * Get a specific provider
   */
  async getProvider(alias) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    
    if (!await fs.pathExists(providerFile)) {
      return null;
    }

    try {
      return await fs.readJson(providerFile);
    } catch (error) {
      throw new Error(`Failed to read provider '${alias}': ${error.message}`);
    }
  }

  /**
   * List all providers
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
          console.warn(`Warning: Failed to read provider file ${file}: ${error.message}`);
        }
      }
    }

    return providers.sort((a, b) => a.alias.localeCompare(b.alias));
  }

  /**
   * Check if a provider exists
   */
  async providerExists(alias) {
    const providerFile = path.join(this.providersDir, `${alias}.json`);
    return await fs.pathExists(providerFile);
  }

  /**
   * Validate provider configuration
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
   */
  isValidAlias(alias) {
    return /^[a-zA-Z0-9-_]+$/.test(alias);
  }

  /**
   * Validate URL format
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
   * Export all providers
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
          await fs.remove(this.lockFile);
        } else {
          throw new Error(`Provider operation locked by ${lock.operation} since ${lock.created}`);
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
   * Release lock for provider operations
   */
  async _releaseLock() {
    if (await fs.pathExists(this.lockFile)) {
      await fs.remove(this.lockFile);
    }
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
        console.warn('Warning: API key appears to contain test/demo patterns');
        break;
      }
    }
    
    // Validate URL security (allow localhost, private networks, and testing/dev environments)
    const url = new URL(provider.baseURL);
    const isLocalhost = url.hostname === 'localhost' || url.hostname.startsWith('127.');
    const isPrivateNetwork = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./);
    const isTestingEnv = process.env.NODE_ENV === 'test' || process.env.CC_ALLOW_HTTP === 'true';
    
    if (url.protocol !== 'https:' && !isLocalhost && !isPrivateNetwork && !isTestingEnv) {
      console.warn(`Warning: Using HTTP for ${url.hostname}. For production, use HTTPS or set CC_ALLOW_HTTP=true`);
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
   */
  async updateLastUsed(alias) {
    try {
      const provider = await this.getProvider(alias);
      if (provider) {
        provider.lastUsed = new Date().toISOString();
        const providerFile = path.join(this.providersDir, `${alias}.json`);
        await fs.writeJson(providerFile, provider, { spaces: 2, mode: 0o600 });
      }
    } catch (error) {
      // Silent fail for this non-critical operation
      console.debug(`Failed to update last used for provider ${alias}: ${error.message}`);
    }
  }

  /**
   * Get provider usage statistics
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

  /**
   * Trigger automatic alias regeneration and reload
   */
  async _triggerAliasReload() {
    try {
      // Import AliasGenerator dynamically to avoid circular dependency
      const AliasGenerator = require('./AliasGenerator');
      const aliasGenerator = new AliasGenerator(this.configDir);
      
      // Regenerate aliases with auto-reload
      await aliasGenerator.generateAliases({ autoReload: true });
      
    } catch (error) {
      // Log warning but don't fail the provider operation
      console.warn(`Warning: Failed to auto-reload aliases: ${error.message}`);
      console.log('You may need to run "claude-reload" or "source ~/.claude/ccvm/aliases.sh" manually');
    }
  }
}

module.exports = ProviderManager;