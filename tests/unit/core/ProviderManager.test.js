/**
 * ProviderManager Unit Tests
 */

const ProviderManager = require('../../../src/core/ProviderManager');
const testUtils = require('../../helpers/testUtils');
const fs = require('fs-extra');
const path = require('path');

describe('ProviderManager', () => {
  let providerManager;
  let testConfigDir;
  let providersDir;

  beforeEach(async () => {
    testConfigDir = await testUtils.createTempDir('provider-manager-test');
    providersDir = path.join(testConfigDir, 'providers');
    await fs.ensureDir(providersDir);
    providerManager = new ProviderManager(testConfigDir);
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('addProvider', () => {
    it('should add a valid provider', async () => {
      const provider = testUtils.createTestProvider();
      
      await providerManager.addProvider(provider);
      
      const providerFile = path.join(providersDir, `${provider.alias}.json`);
      expect(await fs.pathExists(providerFile)).toBe(true);
      
      const savedProvider = await fs.readJson(providerFile);
      expect(savedProvider.alias).toBe(provider.alias);
      expect(savedProvider.baseURL).toBe(provider.baseURL);
      expect(savedProvider.apiKey).toBe(provider.apiKey);
      expect(savedProvider.timeout).toBe(provider.timeout);
      expect(savedProvider.created).toBeDefined();
      expect(savedProvider.id).toBeDefined();
      expect(savedProvider.version).toBeDefined();
    });

    it('should validate provider configuration', async () => {
      const invalidProvider = { alias: 'test' }; // Missing required fields
      
      await expect(providerManager.addProvider(invalidProvider))
        .rejects.toThrow('Missing required fields');
    });

    it('should reject duplicate aliases', async () => {
      const provider = testUtils.createTestProvider();
      
      await providerManager.addProvider(provider);
      
      await expect(providerManager.addProvider(provider))
        .rejects.toThrow('already exists');
    });

    it('should validate alias format', async () => {
      const invalidProvider = testUtils.createTestProvider({
        alias: 'invalid alias!' // Contains invalid characters
      });
      
      await expect(providerManager.addProvider(invalidProvider))
        .rejects.toThrow('Alias can only contain');
    });

    it('should validate URL format', async () => {
      const invalidProvider = testUtils.createTestProvider({
        baseURL: 'not-a-valid-url'
      });
      
      await expect(providerManager.addProvider(invalidProvider))
        .rejects.toThrow('Invalid Base URL format');
    });

    it('should validate API key length', async () => {
      const invalidProvider = testUtils.createTestProvider({
        apiKey: 'short'
      });
      
      await expect(providerManager.addProvider(invalidProvider))
        .rejects.toThrow('API key appears to be too short');
    });
  });

  describe('updateProvider', () => {
    it('should update an existing provider', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const updatedProvider = {
        ...provider,
        baseURL: 'https://api.updated.com',
        timeout: '5000000'
      };
      
      await providerManager.updateProvider(provider.alias, updatedProvider);
      
      const savedProvider = await providerManager.getProvider(provider.alias);
      expect(savedProvider.baseURL).toBe('https://api.updated.com');
      expect(savedProvider.timeout).toBe('5000000');
    });

    it('should reject update of non-existent provider', async () => {
      const provider = testUtils.createTestProvider();
      
      await expect(providerManager.updateProvider('nonexistent', provider))
        .rejects.toThrow('not found');
    });

    it('should validate updated provider configuration', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const invalidUpdate = {
        ...provider,
        baseURL: 'invalid-url'
      };
      
      await expect(providerManager.updateProvider(provider.alias, invalidUpdate))
        .rejects.toThrow('Invalid Base URL format');
    });
  });

  describe('removeProvider', () => {
    it('should remove an existing provider', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const providerFile = path.join(providersDir, `${provider.alias}.json`);
      expect(await fs.pathExists(providerFile)).toBe(true);
      
      await providerManager.removeProvider(provider.alias);
      
      expect(await fs.pathExists(providerFile)).toBe(false);
    });

    it('should reject removal of non-existent provider', async () => {
      await expect(providerManager.removeProvider('nonexistent'))
        .rejects.toThrow('not found');
    });
  });

  describe('getProvider', () => {
    it('should return existing provider', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const retrievedProvider = await providerManager.getProvider(provider.alias);
      expect(retrievedProvider.alias).toBe(provider.alias);
      expect(retrievedProvider.baseURL).toBe(provider.baseURL);
      expect(retrievedProvider.apiKey).toBe(provider.apiKey);
      expect(retrievedProvider.timeout).toBe(provider.timeout);
      expect(retrievedProvider.created).toBeDefined();
      expect(retrievedProvider.id).toBeDefined();
      expect(retrievedProvider.version).toBeDefined();
    });

    it('should return null for non-existent provider', async () => {
      const retrievedProvider = await providerManager.getProvider('nonexistent');
      expect(retrievedProvider).toBeNull();
    });

    it('should handle corrupted provider files', async () => {
      const provider = testUtils.createTestProvider();
      const providerFile = path.join(providersDir, `${provider.alias}.json`);
      
      // Create corrupted file
      await fs.writeFile(providerFile, 'invalid json');
      
      await expect(providerManager.getProvider(provider.alias))
        .rejects.toThrow('Failed to read provider');
    });
  });

  describe('listProviders', () => {
    it('should return empty array when no providers exist', async () => {
      const providers = await providerManager.listProviders();
      expect(providers).toEqual([]);
    });

    it('should return all providers sorted by alias', async () => {
      const providers = [
        testUtils.createTestProvider({ alias: 'zulu' }),
        testUtils.createTestProvider({ alias: 'alpha' }),
        testUtils.createTestProvider({ alias: 'bravo' })
      ];
      
      for (const provider of providers) {
        await providerManager.addProvider(provider);
      }
      
      const retrievedProviders = await providerManager.listProviders();
      expect(retrievedProviders).toHaveLength(3);
      expect(retrievedProviders[0].alias).toBe('alpha');
      expect(retrievedProviders[1].alias).toBe('bravo');
      expect(retrievedProviders[2].alias).toBe('zulu');
    });

    it('should skip corrupted provider files with warning', async () => {
      const validProvider = testUtils.createTestProvider({ alias: 'valid' });
      await providerManager.addProvider(validProvider);
      
      // Create corrupted file
      await fs.writeFile(path.join(providersDir, 'corrupted.json'), 'invalid json');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const providers = await providerManager.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].alias).toBe('valid');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read provider file')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle non-existent providers directory', async () => {
      await fs.remove(providersDir);
      
      const providers = await providerManager.listProviders();
      expect(providers).toEqual([]);
    });
  });

  describe('providerExists', () => {
    it('should return true for existing provider', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const exists = await providerManager.providerExists(provider.alias);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent provider', async () => {
      const exists = await providerManager.providerExists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('validation methods', () => {
    describe('validateProvider', () => {
      it('should pass for valid provider', () => {
        const provider = testUtils.createTestProvider();
        expect(() => providerManager.validateProvider(provider)).not.toThrow();
      });

      it('should reject missing required fields', () => {
        const provider = { alias: 'test' };
        expect(() => providerManager.validateProvider(provider))
          .toThrow('Missing required fields: baseURL, apiKey');
      });

      it('should validate timeout if provided', () => {
        const provider = testUtils.createTestProvider({ timeout: 'invalid' });
        expect(() => providerManager.validateProvider(provider))
          .toThrow('Timeout must be at least 1000ms');
        
        const validProvider = testUtils.createTestProvider({ timeout: '2000' });
        expect(() => providerManager.validateProvider(validProvider)).not.toThrow();
      });
    });

    describe('isValidAlias', () => {
      it('should accept valid aliases', () => {
        const validAliases = ['test', 'test123', 'test-alias', 'test_alias', 'TEST'];
        validAliases.forEach(alias => {
          expect(providerManager.isValidAlias(alias)).toBe(true);
        });
      });

      it('should reject invalid aliases', () => {
        const invalidAliases = ['test alias', 'test!', 'test@domain', 'test.alias'];
        invalidAliases.forEach(alias => {
          expect(providerManager.isValidAlias(alias)).toBe(false);
        });
      });
    });

    describe('isValidURL', () => {
      it('should accept valid URLs', () => {
        const validUrls = [
          'https://api.example.com',
          'http://localhost:3000',
          'https://subdomain.domain.co.uk/path'
        ];
        validUrls.forEach(url => {
          expect(providerManager.isValidURL(url)).toBe(true);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = ['not-a-url', 'ftp://example.com', '//example.com'];
        invalidUrls.forEach(url => {
          expect(providerManager.isValidURL(url)).toBe(false);
        });
      });
    });
  });

  describe('getStats', () => {
    it('should return statistics for providers', async () => {
      const providers = [
        testUtils.createTestProvider({ alias: 'test1', baseURL: 'https://api.test.com' }),
        testUtils.createTestProvider({ alias: 'test2', baseURL: 'https://api.test.com' }),
        testUtils.createTestProvider({ alias: 'test3', baseURL: 'https://api.other.com' })
      ];
      
      for (const provider of providers) {
        await providerManager.addProvider(provider);
      }
      
      const stats = await providerManager.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byBaseURL).toEqual({
        'https://api.test.com': 2,
        'https://api.other.com': 1
      });
    });

    it('should return zero stats for no providers', async () => {
      const stats = await providerManager.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byBaseURL).toEqual({});
    });
  });

  describe('exportProviders', () => {
    it('should export providers without API keys', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const exported = await providerManager.exportProviders();
      expect(exported).toHaveLength(1);
      expect(exported[0]).toEqual({
        alias: provider.alias,
        baseURL: provider.baseURL,
        timeout: provider.timeout
      });
      expect(exported[0]).not.toHaveProperty('apiKey');
    });
  });

  describe('importProviders', () => {
    it('should import providers with API keys', async () => {
      const importData = [
        {
          alias: 'imported',
          baseURL: 'https://api.imported.com',
          apiKey: 'imported-api-key',
          timeout: '3000000'
        }
      ];
      
      const results = await providerManager.importProviders(importData);
      expect(results.imported).toBe(1);
      expect(results.skipped).toBe(0);
      expect(results.errors).toHaveLength(0);
      
      const provider = await providerManager.getProvider('imported');
      expect(provider.alias).toBe(importData[0].alias);
      expect(provider.baseURL).toBe(importData[0].baseURL);
      expect(provider.apiKey).toBe(importData[0].apiKey);
      expect(provider.timeout).toBe(importData[0].timeout);
      expect(provider.created).toBeDefined();
      expect(provider.id).toBeDefined();
      expect(provider.version).toBeDefined();
    });

    it('should skip providers without API keys', async () => {
      const importData = [
        {
          alias: 'incomplete',
          baseURL: 'https://api.incomplete.com'
          // Missing apiKey
        }
      ];
      
      const results = await providerManager.importProviders(importData);
      expect(results.imported).toBe(0);
      expect(results.skipped).toBe(0);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain('missing API key');
    });

    it('should handle overwrite option', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const importData = [
        {
          ...provider,
          baseURL: 'https://api.updated.com'
        }
      ];
      
      // Without overwrite
      let results = await providerManager.importProviders(importData);
      expect(results.skipped).toBe(1);
      
      // With overwrite
      results = await providerManager.importProviders(importData, { overwrite: true });
      expect(results.imported).toBe(1);
      
      const updatedProvider = await providerManager.getProvider(provider.alias);
      expect(updatedProvider.baseURL).toBe('https://api.updated.com');
    });
  });

  describe('testProvider', () => {
    it('should test provider connectivity', async () => {
      const provider = testUtils.createTestProvider();
      await providerManager.addProvider(provider);
      
      const result = await providerManager.testProvider(provider.alias);
      expect(result.alias).toBe(provider.alias);
      expect(result.baseURL).toBe(provider.baseURL);
      expect(result.reachable).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should detect invalid URLs', async () => {
      const provider = testUtils.createTestProvider({ baseURL: 'invalid-url' });
      
      // Should fail to add provider with invalid URL
      await expect(providerManager.addProvider(provider))
        .rejects.toThrow('Invalid Base URL format');
    });

    it('should handle non-existent provider', async () => {
      await expect(providerManager.testProvider('nonexistent'))
        .rejects.toThrow('not found');
    });
  });
});