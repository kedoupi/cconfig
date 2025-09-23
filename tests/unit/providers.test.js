const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const providers = require('../../lib/providers');
const config = require('../../lib/config');

describe('Providers Module', () => {
  let tempDir;
  let originalClaudeDir;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cconfig-test-'));

    // Mock config module properties
    originalClaudeDir = config.CONFIG_DIR;

    // Assign new paths directly to the module object
    Object.defineProperty(config, 'CONFIG_DIR', { value: tempDir, writable: true });
    Object.defineProperty(config, 'PROVIDERS_DIR', { value: path.join(tempDir, 'providers'), writable: true });
    Object.defineProperty(config, 'CONFIG_FILE', { value: path.join(tempDir, 'config.json'), writable: true });

    // Ensure test directories exist
    await config.ensureDirectories();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);

    // Restore original paths
    Object.defineProperty(config, 'CONFIG_DIR', { value: originalClaudeDir, writable: true });
    Object.defineProperty(config, 'PROVIDERS_DIR', { value: path.join(originalClaudeDir, 'providers'), writable: true });
    Object.defineProperty(config, 'CONFIG_FILE', { value: path.join(originalClaudeDir, 'config.json'), writable: true });
  });

  describe('createProvider', () => {
    test('should create a new provider successfully', async () => {
      const provider = await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      expect(provider.alias).toBe('test');
      expect(provider.apiUrl).toBe('https://api.anthropic.com');
      expect(provider.apiKey).toBe('sk-test123');
      expect(provider.createdAt).toBeDefined();

      // Verify file was created
      const providerFile = config.getProviderFile('test');
      expect(await fs.pathExists(providerFile)).toBe(true);
    });

    test('should throw error for invalid alias', async () => {
      await expect(providers.createProvider('invalid.alias', 'https://api.anthropic.com', 'sk-test123'))
        .rejects.toThrow();
    });
  });

  describe('getProvider', () => {
    test('should retrieve existing provider', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      const provider = await providers.getProvider('test');
      expect(provider.alias).toBe('test');
      expect(provider.apiUrl).toBe('https://api.anthropic.com');
    });

    test('should throw error for non-existent provider', async () => {
      await expect(providers.getProvider('nonexistent'))
        .rejects.toThrow("Provider 'nonexistent' not found");
    });
  });

  describe('updateProvider', () => {
    test('should update existing provider', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      const updated = await providers.updateProvider('test', 'https://api.new-url.com', 'sk-new456');

      expect(updated.apiUrl).toBe('https://api.new-url.com');
      expect(updated.apiKey).toBe('sk-new456');
      expect(updated.updatedAt).toBeDefined();
    });

    test('should update URL only when no new API key provided', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      const updated = await providers.updateProvider('test', 'https://api.new-url.com', '');

      expect(updated.apiUrl).toBe('https://api.new-url.com');
      expect(updated.apiKey).toBe('sk-test123'); // Should keep original key
    });

    test('should throw error for non-existent provider', async () => {
      await expect(providers.updateProvider('nonexistent', 'https://api.new-url.com', 'sk-new456'))
        .rejects.toThrow("Provider 'nonexistent' not found");
    });
  });

  describe('deleteProvider', () => {
    test('should delete existing provider', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      const result = await providers.deleteProvider('test');
      expect(result.clearedDefault).toBe(false);

      // Verify file was deleted
      const providerFile = config.getProviderFile('test');
      expect(await fs.pathExists(providerFile)).toBe(false);
    });

    test('should clear default when deleting default provider', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');
      await providers.setDefaultProvider('test');

      const result = await providers.deleteProvider('test');
      expect(result.clearedDefault).toBe(true);

      const defaultProvider = await providers.getDefaultProvider();
      expect(defaultProvider).toBeNull();
    });

    test('should throw error for non-existent provider', async () => {
      await expect(providers.deleteProvider('nonexistent'))
        .rejects.toThrow("Provider 'nonexistent' not found");
    });
  });

  describe('listProviders', () => {
    test('should return empty array when no providers exist', async () => {
      const result = await providers.listProviders();
      expect(result).toEqual([]);
    });

    test('should list all providers with correct metadata', async () => {
      await providers.createProvider('test1', 'https://api1.com', 'sk-test1');
      await providers.createProvider('test2', 'https://api2.com', 'sk-test2');
      await providers.setDefaultProvider('test1');

      const result = await providers.listProviders();

      expect(result).toHaveLength(2);

      const test1 = result.find(p => p.alias === 'test1');
      const test2 = result.find(p => p.alias === 'test2');

      expect(test1.isDefault).toBe(true);
      expect(test2.isDefault).toBe(false);
      expect(test1.lastUsedFormatted).toBeDefined();
      expect(test2.lastUsedFormatted).toBe('-');
    });
  });

  describe('setDefaultProvider', () => {
    test('should set default provider and update lastUsed', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');

      const config = await providers.setDefaultProvider('test');
      expect(config.defaultProvider).toBe('test');

      const provider = await providers.getProvider('test');
      expect(provider.lastUsed).toBeDefined();
    });

    test('should throw error for non-existent provider', async () => {
      await expect(providers.setDefaultProvider('nonexistent'))
        .rejects.toThrow("Provider 'nonexistent' not found");
    });
  });

  describe('getDefaultProvider', () => {
    test('should return null when no default set', async () => {
      const result = await providers.getDefaultProvider();
      expect(result).toBeNull();
    });

    test('should return default provider alias', async () => {
      await providers.createProvider('test', 'https://api.anthropic.com', 'sk-test123');
      await providers.setDefaultProvider('test');

      const result = await providers.getDefaultProvider();
      expect(result).toBe('test');
    });
  });
});