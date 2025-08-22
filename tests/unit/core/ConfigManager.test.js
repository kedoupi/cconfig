/**
 * ConfigManager Unit Tests
 */

const ConfigManager = require('../../../src/core/ConfigManager');
const testUtils = require('../../helpers/testUtils');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ConfigManager', () => {
  let configManager;
  let testConfigDir;

  beforeEach(async () => {
    testConfigDir = await testUtils.createTempDir('config-manager-test');
    configManager = new ConfigManager(testConfigDir);
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(configManager.getConfigDir()).toBe(testConfigDir);
      expect(configManager.getClaudeDir()).toBe(path.join(os.homedir(), '.claude'));
      expect(configManager.getProvidersDir()).toBe(path.join(testConfigDir, 'providers'));
      expect(configManager.getBackupsDir()).toBe(path.join(testConfigDir, 'backups'));
    });

    it('should use default paths when no configDir provided', () => {
      const defaultManager = new ConfigManager();
      expect(defaultManager.getConfigDir()).toContain('.cc-config');
    });
  });

  describe('init', () => {
    it('should create all required directories', async () => {
      await configManager.init();

      const expectedDirs = [
        configManager.getConfigDir(),
        configManager.getProvidersDir(),
        configManager.getBackupsDir(),
        configManager.getClaudeDir(),
        path.join(configManager.getClaudeDir(), 'commands'),
        path.join(configManager.getClaudeDir(), 'agents'),
        path.join(configManager.getClaudeDir(), 'output-styles')
      ];

      for (const dir of expectedDirs) {
        expect(await fs.pathExists(dir)).toBe(true);
      }
    });

    it('should create required files', async () => {
      await configManager.init();

      const historyFile = configManager.getHistoryFile();
      const aliasesFile = configManager.getAliasesFile();
      const claudeSettingsFile = path.join(configManager.getClaudeDir(), 'settings.json');

      expect(await fs.pathExists(historyFile)).toBe(true);
      expect(await fs.pathExists(aliasesFile)).toBe(true);
      expect(await fs.pathExists(claudeSettingsFile)).toBe(true);

      // Verify file contents
      const history = await fs.readJson(historyFile);
      expect(history.version).toBe('1.0');
      expect(history.backups).toEqual([]);
      expect(history.created).toBeDefined();

      const aliases = await fs.readFile(aliasesFile, 'utf8');
      expect(aliases).toContain('# Claude Code Kit aliases');

      const settings = await fs.readJson(claudeSettingsFile);
      expect(settings).toHaveProperty('name');
      expect(settings).toHaveProperty('version');
    });

    it('should not overwrite existing files', async () => {
      const historyFile = configManager.getHistoryFile();
      const customHistory = { version: '1.0', backups: [{ test: 'data' }] };
      
      await fs.ensureDir(path.dirname(historyFile));
      await fs.writeJson(historyFile, customHistory);

      await configManager.init();

      const history = await fs.readJson(historyFile);
      expect(history).toEqual(customHistory);
    });
  });

  describe('isInitialized', () => {
    it('should return false for uninitialized configuration', async () => {
      const initialized = await configManager.isInitialized();
      expect(initialized).toBe(false);
    });

    it('should return true for initialized configuration', async () => {
      await configManager.init();
      const initialized = await configManager.isInitialized();
      expect(initialized).toBe(true);
    });

    it('should return false if any required path is missing', async () => {
      await configManager.init();
      
      // Remove one required directory
      await fs.remove(configManager.getProvidersDir());
      
      const initialized = await configManager.isInitialized();
      expect(initialized).toBe(false);
    });
  });

  describe('getSystemInfo', () => {
    it('should return system information', async () => {
      const systemInfo = await configManager.getSystemInfo();

      expect(systemInfo).toHaveProperty('version');
      expect(systemInfo).toHaveProperty('nodeVersion');
      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('configDir');
      expect(systemInfo).toHaveProperty('claudeDir');
      expect(systemInfo).toHaveProperty('initialized');

      expect(systemInfo.version).toBe('1.0.0');
      expect(systemInfo.nodeVersion).toBe(process.version);
      expect(systemInfo.configDir).toBe(testConfigDir);
    });

    it('should include initialization status', async () => {
      let systemInfo = await configManager.getSystemInfo();
      expect(systemInfo.initialized).toBe(false);

      await configManager.init();
      systemInfo = await configManager.getSystemInfo();
      expect(systemInfo.initialized).toBe(true);
    });
  });

  describe('validateConfiguration', () => {
    it('should return valid for properly initialized configuration', async () => {
      await configManager.init();
      
      const validation = await configManager.validateConfiguration();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing directories', async () => {
      const validation = await configManager.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(issue => issue.includes('directory missing'))).toBe(true);
    });

    it('should detect missing files', async () => {
      // Create directories but not files
      await fs.ensureDir(configManager.getConfigDir());
      await fs.ensureDir(configManager.getProvidersDir());
      await fs.ensureDir(configManager.getBackupsDir());
      await fs.ensureDir(configManager.getClaudeDir());

      const validation = await configManager.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('file missing'))).toBe(true);
    });

    it('should detect corrupted JSON files', async () => {
      await configManager.init();
      
      // Corrupt the history file
      await fs.writeFile(configManager.getHistoryFile(), 'invalid json content');
      
      const validation = await configManager.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('corrupted'))).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset configuration to defaults', async () => {
      // Initialize and add some content
      await configManager.init();
      await fs.writeFile(path.join(configManager.getConfigDir(), 'test-file.txt'), 'test content');
      
      const testFile = path.join(configManager.getConfigDir(), 'test-file.txt');
      expect(await fs.pathExists(testFile)).toBe(true);

      // Reset configuration
      await configManager.reset();

      // Check that configuration is reinitialized
      expect(await configManager.isInitialized()).toBe(true);
      expect(await fs.pathExists(testFile)).toBe(false);
    });

    it('should create backup before reset', async () => {
      await configManager.init();
      
      // Mock BackupManager to verify backup creation
      const BackupManager = require('../../../src/core/BackupManager');
      const createBackupSpy = jest.spyOn(BackupManager.prototype, 'createBackup')
        .mockResolvedValue('test-backup-timestamp');

      await configManager.reset();

      expect(createBackupSpy).toHaveBeenCalledWith('Pre-reset backup');
      
      createBackupSpy.mockRestore();
    });
  });

  describe('path getters', () => {
    it('should return correct paths', () => {
      expect(configManager.getConfigDir()).toBe(testConfigDir);
      expect(configManager.getProvidersDir()).toBe(path.join(testConfigDir, 'providers'));
      expect(configManager.getBackupsDir()).toBe(path.join(testConfigDir, 'backups'));
      expect(configManager.getAliasesFile()).toBe(path.join(testConfigDir, 'aliases.sh'));
      expect(configManager.getHistoryFile()).toBe(path.join(testConfigDir, 'history.json'));
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Mock fs.ensureDir to throw permission error
      const originalEnsureDir = fs.ensureDir;
      fs.ensureDir = jest.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(configManager.init()).rejects.toThrow('Permission denied');

      fs.ensureDir = originalEnsureDir;
    });

    it('should handle corrupted files during validation', async () => {
      await configManager.init();
      
      // Create a file with invalid JSON
      await fs.writeFile(configManager.getHistoryFile(), '{invalid json}');
      
      const validation = await configManager.validateConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('corrupted'))).toBe(true);
    });
  });

  describe('integration with other managers', () => {
    it('should work with BackupManager during reset', async () => {
      await configManager.init();
      
      // This tests the integration without mocking
      await expect(configManager.reset()).resolves.not.toThrow();
      
      // Verify reinitialization
      expect(await configManager.isInitialized()).toBe(true);
    });
  });
});