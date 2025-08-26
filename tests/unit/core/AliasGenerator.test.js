/**
 * AliasGenerator Unit Tests
 */

const AliasGenerator = require('../../../src/core/AliasGenerator');
const testUtils = require('../../helpers/testUtils');
const fs = require('fs-extra');
const path = require('path');

describe('AliasGenerator', () => {
  let aliasGenerator;
  let testConfigDir;
  let providersDir;
  let aliasesFile;

  beforeEach(async () => {
    testConfigDir = await testUtils.createTempDir('alias-generator-test');
    providersDir = path.join(testConfigDir, 'providers');
    aliasesFile = path.join(testConfigDir, 'aliases.sh');
    await fs.ensureDir(providersDir);
    aliasGenerator = new AliasGenerator(testConfigDir);
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('loadProviders', () => {
    it('should return empty array when no providers exist', async () => {
      const providers = await aliasGenerator.loadProviders();
      expect(providers).toEqual([]);
    });

    it('should load all provider configurations', async () => {
      const testProviders = testUtils.createTestProviders(3);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      const providers = await aliasGenerator.loadProviders();
      expect(providers).toHaveLength(3);
      expect(providers).toEqual(expect.arrayContaining(testProviders));
    });

    it('should sort providers by alias', async () => {
      const testProviders = [
        testUtils.createTestProvider({ alias: 'zulu' }),
        testUtils.createTestProvider({ alias: 'alpha' }),
        testUtils.createTestProvider({ alias: 'bravo' })
      ];
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      const providers = await aliasGenerator.loadProviders();
      expect(providers[0].alias).toBe('alpha');
      expect(providers[1].alias).toBe('bravo');
      expect(providers[2].alias).toBe('zulu');
    });

    it('should skip non-JSON files', async () => {
      await fs.writeFile(path.join(providersDir, 'readme.txt'), 'Not a provider');
      const testProvider = testUtils.createTestProvider();
      await testUtils.createTestProviderFiles(providersDir, [testProvider]);
      
      const providers = await aliasGenerator.loadProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]).toEqual(testProvider);
    });

    it('should handle corrupted JSON files gracefully', async () => {
      await fs.writeFile(path.join(providersDir, 'corrupted.json'), 'invalid json');
      const testProvider = testUtils.createTestProvider();
      await testUtils.createTestProviderFiles(providersDir, [testProvider]);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const providers = await aliasGenerator.loadProviders();
      expect(providers).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle non-existent providers directory', async () => {
      await fs.remove(providersDir);
      
      const providers = await aliasGenerator.loadProviders();
      expect(providers).toEqual([]);
    });
  });

  describe('generateAliases', () => {
    it('should create aliases file', async () => {
      const testProviders = testUtils.createTestProviders(2);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      await aliasGenerator.generateAliases();
      
      expect(await fs.pathExists(aliasesFile)).toBe(true);
      
      const content = await fs.readFile(aliasesFile, 'utf8');
      expect(content).toContain('# Claude Code Kit - Auto-generated aliases');
      expect(content).toContain('_cc_load_config');
      expect(content).toContain(`alias ${testProviders[0].alias}=`);
      expect(content).toContain(`alias ${testProviders[1].alias}=`);
    });

    it('should generate aliases for all providers', async () => {
      const testProviders = testUtils.createTestProviders(3);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      await aliasGenerator.generateAliases();
      
      const content = await fs.readFile(aliasesFile, 'utf8');
      
      testProviders.forEach(provider => {
        expect(content).toContain(`alias ${provider.alias}=`);
      });
    });

    it('should handle empty providers directory', async () => {
      await aliasGenerator.generateAliases();
      
      const content = await fs.readFile(aliasesFile, 'utf8');
      expect(content).toContain('# No providers configured yet');
      expect(content).toContain('cc-config provider add');
    });
  });

  describe('buildAliasContent', () => {
    it('should build complete alias content', async () => {
      const testProviders = testUtils.createTestProviders(2);
      const content = await aliasGenerator.buildAliasContent(testProviders);
      
      expect(content).toContain('# Claude Code Kit - Auto-generated aliases');
      expect(content).toContain('_cc_load_config()');
      expect(content).toContain('_cc_check_claude_cli()');
      expect(content).toContain('claude-providers()');
      expect(content).toContain('claude-reload()');
      
      testProviders.forEach(provider => {
        expect(content).toContain(`alias ${provider.alias}=`);
      });
    });

    it('should include provider statistics in footer', async () => {
      const testProviders = testUtils.createTestProviders(3);
      const content = await aliasGenerator.buildAliasContent(testProviders);
      
      expect(content).toContain('Total providers configured: 3');
      testProviders.forEach(provider => {
        expect(content).toContain(`${provider.alias}: ${provider.baseURL}`);
      });
    });

    it('should include usage examples', async () => {
      const testProviders = testUtils.createTestProviders(1);
      const content = await aliasGenerator.buildAliasContent(testProviders);
      
      expect(content).toContain('Usage:');
      expect(content).toContain('Example:');
      expect(content).toContain(testProviders[0].alias);
    });
  });

  describe('generateHeader', () => {
    it('should generate file header with timestamp', () => {
      const header = aliasGenerator.generateHeader();
      
      expect(header).toContain('# Claude Code Kit - Auto-generated aliases');
      expect(header).toContain('# This file is automatically generated');
      expect(header).toContain('# Generated on:');
      expect(header).toContain('# Usage:');
      expect(header).toContain('# Example:');
    });
  });

  describe('generateHelperFunctions', () => {
    it('should generate helper functions', () => {
      const helpers = aliasGenerator.generateHelperFunctions();
      
      expect(helpers).toContain('_cc_load_config()');
      expect(helpers).toContain('_cc_check_claude_cli()');
      expect(helpers).toContain('jq -r ".apiKey // empty"');
      expect(helpers).toContain('ANTHROPIC_AUTH_TOKEN');
      expect(helpers).toContain('ANTHROPIC_BASE_URL');
    });

    it('should include error handling', () => {
      const helpers = aliasGenerator.generateHelperFunctions();
      
      expect(helpers).toContain('if [ ! -f "$config_file" ]');
      expect(helpers).toContain('if ! command -v jq');
      expect(helpers).toContain('if ! command -v claude');
      expect(helpers).toContain('Error:');
    });
  });

  describe('generateFooter', () => {
    it('should generate footer with statistics', () => {
      const testProviders = testUtils.createTestProviders(2);
      const footer = aliasGenerator.generateFooter(testProviders);
      
      expect(footer).toContain('# Claude Code Kit Statistics');
      expect(footer).toContain('# Total providers configured: 2');
      expect(footer).toContain('# Available commands:');
      expect(footer).toContain('claude-providers()');
      expect(footer).toContain('claude-reload()');
    });

    it('should list all providers', () => {
      const testProviders = testUtils.createTestProviders(3);
      const footer = aliasGenerator.generateFooter(testProviders);
      
      testProviders.forEach(provider => {
        expect(footer).toContain(`${provider.alias}: ${provider.baseURL}`);
      });
    });

    it('should handle empty providers list', () => {
      const footer = aliasGenerator.generateFooter([]);
      
      expect(footer).toContain('# Total providers configured: 0');
      expect(footer).toContain('(none configured)');
    });
  });

  describe('validateAlias', () => {
    it('should accept valid aliases', () => {
      const validAliases = ['myalias', 'test123', 'test-alias', 'test_alias'];
      
      validAliases.forEach(alias => {
        expect(() => aliasGenerator.validateAlias(alias)).not.toThrow();
      });
    });

    it('should reject invalid alias formats', () => {
      const invalidAliases = ['test alias', 'test!', 'test@domain', 'test.alias'];
      
      invalidAliases.forEach(alias => {
        expect(() => aliasGenerator.validateAlias(alias))
          .toThrow('Alias can only contain');
      });
    });

    it('should reject shell reserved words', () => {
      const reservedWords = ['alias', 'echo', 'cd', 'test', 'if', 'export'];
      
      reservedWords.forEach(word => {
        expect(() => aliasGenerator.validateAlias(word))
          .toThrow('shell reserved word');
      });
    });

    it('should warn about common command conflicts', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      aliasGenerator.validateAlias('git');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('conflicts with a common command')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const testProviders = testUtils.createTestProviders(3);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      await aliasGenerator.generateAliases();
      
      const stats = await aliasGenerator.getStats();
      
      expect(stats.totalProviders).toBe(3);
      expect(stats.aliases).toHaveLength(3);
      expect(stats.baseURLs).toEqual(expect.arrayContaining([
        testProviders[0].baseURL,
        testProviders[1].baseURL,
        testProviders[2].baseURL
      ]));
      expect(stats.lastGenerated).toBeTruthy();
      expect(new Date(stats.lastGenerated)).toBeInstanceOf(Date);
    });

    it('should handle no aliases file', async () => {
      const stats = await aliasGenerator.getStats();
      
      expect(stats.totalProviders).toBe(0);
      expect(stats.aliases).toEqual([]);
      expect(stats.lastGenerated).toBeNull();
    });
  });

  describe('isUpToDate', () => {
    it('should return false when aliases file does not exist', async () => {
      const upToDate = await aliasGenerator.isUpToDate();
      expect(upToDate).toBe(false);
    });

    it('should return true when aliases file is newer than providers', async () => {
      const testProviders = testUtils.createTestProviders(1);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      // Generate aliases after creating providers
      await testUtils.sleep(10); // Ensure different timestamps
      await aliasGenerator.generateAliases();
      
      const upToDate = await aliasGenerator.isUpToDate();
      expect(upToDate).toBe(true);
    });

    it('should return false when provider is newer than aliases', async () => {
      await aliasGenerator.generateAliases();
      
      // Create provider after generating aliases
      await testUtils.sleep(10); // Ensure different timestamps
      const testProvider = testUtils.createTestProvider();
      await testUtils.createTestProviderFiles(providersDir, [testProvider]);
      
      const upToDate = await aliasGenerator.isUpToDate();
      expect(upToDate).toBe(false);
    });
  });

  describe('previewAliases', () => {
    it('should return alias content without writing file', async () => {
      const testProviders = testUtils.createTestProviders(2);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      const preview = await aliasGenerator.previewAliases();
      
      expect(preview).toContain('# Claude Code Kit - Auto-generated aliases');
      expect(preview).toContain(`alias ${testProviders[0].alias}=`);
      expect(preview).toContain(`alias ${testProviders[1].alias}=`);
      
      // Verify file was not created
      expect(await fs.pathExists(aliasesFile)).toBe(false);
    });
  });

  describe('getLastGeneratedTime', () => {
    it('should return null for non-existent file', async () => {
      const time = await aliasGenerator.getLastGeneratedTime();
      expect(time).toBeNull();
    });

    it('should return file modification time', async () => {
      await aliasGenerator.generateAliases();
      
      const time = await aliasGenerator.getLastGeneratedTime();
      expect(time).toBeTruthy();
      expect(new Date(time)).toBeInstanceOf(Date);
      expect(new Date(time).getTime()).toBeLessThanOrEqual(Date.now() + 1000); // Allow 1 second tolerance
    });
  });

  describe('integration tests', () => {
    it('should generate working shell aliases', async () => {
      const testProviders = testUtils.createTestProviders(2);
      await testUtils.createTestProviderFiles(providersDir, testProviders);
      
      await aliasGenerator.generateAliases();
      
      const content = await fs.readFile(aliasesFile, 'utf8');
      
      // Verify alias syntax
      testProviders.forEach(provider => {
        const aliasPattern = new RegExp(`alias ${provider.alias}='[^']*'`);
        expect(content).toMatch(aliasPattern);
      });
    });

    it('should handle special characters in provider configurations', async () => {
      const specialProvider = testUtils.createTestProvider({
        alias: 'test-provider_123',
        baseURL: 'https://api.test.com/v1/special-endpoint'
      });
      
      await testUtils.createTestProviderFiles(providersDir, [specialProvider]);
      await aliasGenerator.generateAliases();
      
      const content = await fs.readFile(aliasesFile, 'utf8');
      expect(content).toContain(specialProvider.alias);
      expect(content).toContain(specialProvider.baseURL);
    });

    it('should regenerate aliases when providers change', async () => {
      // Initial generation
      const initialProviders = testUtils.createTestProviders(1);
      await testUtils.createTestProviderFiles(providersDir, initialProviders);
      await aliasGenerator.generateAliases();
      
      let content = await fs.readFile(aliasesFile, 'utf8');
      expect(content).toContain(initialProviders[0].alias);
      
      // Add new provider
      const newProvider = testUtils.createTestProvider({ alias: 'newprovider' });
      await testUtils.createTestProviderFiles(providersDir, [newProvider]);
      await aliasGenerator.generateAliases();
      
      content = await fs.readFile(aliasesFile, 'utf8');
      expect(content).toContain(initialProviders[0].alias);
      expect(content).toContain(newProvider.alias);
    });
  });
});