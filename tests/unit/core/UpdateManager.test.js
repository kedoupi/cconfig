/**
 * UpdateManager Test Suite
 */

const fs = require('fs-extra');
const path = require('path');
const UpdateManager = require('../../../src/core/UpdateManager');
const { createTestEnvironment, cleanupTestEnvironment } = require('../../helpers/testUtils');

describe('UpdateManager', () => {
  let updateManager;
  let testConfigDir;
  let testClaudeDir;

  beforeEach(async () => {
    const testEnv = await createTestEnvironment('update-manager');
    testConfigDir = testEnv.configDir;
    testClaudeDir = testEnv.claudeDir;
    
    updateManager = new UpdateManager(testConfigDir, testClaudeDir);
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testConfigDir);
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(updateManager.configDir).toBe(testConfigDir);
      expect(updateManager.claudeDir).toBe(testClaudeDir);
      expect(updateManager.backupsDir).toBe(path.join(testConfigDir, 'backups'));
      expect(updateManager.tempDir).toBe(path.join(testConfigDir, '.update-temp'));
    });

    it('should set up correct repository configuration', () => {
      expect(updateManager.repoConfig.owner).toBe('kedoupi');
      expect(updateManager.repoConfig.repo).toBe('claude-code-kit');
      expect(updateManager.repoConfig.branch).toBe('main');
      expect(updateManager.repoConfig.baseUrl).toBe('https://api.github.com');
      expect(updateManager.repoConfig.rawUrl).toBe('https://raw.githubusercontent.com');
    });
  });

  describe('getLocalVersion', () => {
    it('should return default version when no local version file exists', async () => {
      const version = await updateManager.getLocalVersion();
      expect(version).toBe('0.0.0');
    });

    it('should read version from package.json when available', async () => {
      const packageJson = { version: '1.2.3', name: 'test' };
      await fs.writeJson(path.join(testConfigDir, 'package.json'), packageJson);
      
      const version = await updateManager.getLocalVersion();
      expect(version).toBe('1.2.3');
    });

    it('should handle corrupted package.json gracefully', async () => {
      await fs.writeFile(path.join(testConfigDir, 'package.json'), 'invalid json');
      
      const version = await updateManager.getLocalVersion();
      expect(version).toBe('0.0.0');
    });
  });

  describe('compareVersions', () => {
    it('should compare semantic versions correctly', () => {
      expect(updateManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(updateManager.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(updateManager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should handle complex version comparisons', () => {
      expect(updateManager.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(updateManager.compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(updateManager.compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
    });

    it('should handle non-semantic versions', () => {
      expect(updateManager.compareVersions('abc', 'def')).toBe(-1);
      expect(updateManager.compareVersions('1.0', '1.0.0')).toBe(-1);
    });
  });

  describe('validateDownloadedContent', () => {
    it('should validate basic file structure', async () => {
      const tempDir = path.join(testConfigDir, 'temp-validate');
      await fs.ensureDir(tempDir);
      
      // Create minimal valid structure
      await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'test' });
      await fs.ensureDir(path.join(tempDir, '.claude'));
      
      const result = await updateManager.validateDownloadedContent(tempDir);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      
      await fs.remove(tempDir);
    });

    it('should detect missing package.json', async () => {
      const tempDir = path.join(testConfigDir, 'temp-validate-missing');
      await fs.ensureDir(tempDir);
      
      const result = await updateManager.validateDownloadedContent(tempDir);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing package.json');
      
      await fs.remove(tempDir);
    });

    it('should detect missing .claude directory', async () => {
      const tempDir = path.join(testConfigDir, 'temp-validate-claude');
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'test' });
      
      const result = await updateManager.validateDownloadedContent(tempDir);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing .claude configuration directory');
      
      await fs.remove(tempDir);
    });
  });

  describe('cleanupTempDir', () => {
    it('should remove temporary directory if it exists', async () => {
      await fs.ensureDir(updateManager.tempDir);
      await fs.writeFile(path.join(updateManager.tempDir, 'test.txt'), 'test content');
      
      expect(await fs.pathExists(updateManager.tempDir)).toBe(true);
      
      await updateManager.cleanupTempDir();
      
      expect(await fs.pathExists(updateManager.tempDir)).toBe(false);
    });

    it('should not throw error if temp directory does not exist', async () => {
      expect(await fs.pathExists(updateManager.tempDir)).toBe(false);
      
      await expect(updateManager.cleanupTempDir()).resolves.not.toThrow();
    });
  });

  describe('getUpdateStats', () => {
    it('should return basic update statistics', async () => {
      const stats = await updateManager.getUpdateStats();
      
      expect(stats).toHaveProperty('tempDirExists');
      expect(stats).toHaveProperty('tempDirSize');
      expect(stats).toHaveProperty('lastUpdateCheck');
      expect(typeof stats.tempDirExists).toBe('boolean');
      expect(typeof stats.tempDirSize).toBe('number');
    });

    it('should detect existing temp directory', async () => {
      await fs.ensureDir(updateManager.tempDir);
      await fs.writeFile(path.join(updateManager.tempDir, 'test.txt'), 'test content');
      
      const stats = await updateManager.getUpdateStats();
      
      expect(stats.tempDirExists).toBe(true);
      expect(stats.tempDirSize).toBeGreaterThan(0);
      
      await fs.remove(updateManager.tempDir);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Mock fs.readJson to throw an error
      const originalReadJson = fs.readJson;
      fs.readJson = jest.fn().mockRejectedValue(new Error('File system error'));
      
      try {
        const version = await updateManager.getLocalVersion();
        expect(version).toBe('0.0.0');
      } finally {
        fs.readJson = originalReadJson;
      }
    });

    it('should handle validation errors', async () => {
      const tempDir = path.join(testConfigDir, 'temp-error');
      
      // Try to validate non-existent directory
      const result = await updateManager.validateDownloadedContent(tempDir);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('integration tests', () => {
    it('should maintain consistent directory structure', async () => {
      expect(updateManager.configDir).toBe(testConfigDir);
      expect(updateManager.backupsDir).toBe(path.join(testConfigDir, 'backups'));
      expect(updateManager.tempDir).toBe(path.join(testConfigDir, '.update-temp'));
      
      // Verify paths are absolute
      expect(path.isAbsolute(updateManager.configDir)).toBe(true);
      expect(path.isAbsolute(updateManager.backupsDir)).toBe(true);
      expect(path.isAbsolute(updateManager.tempDir)).toBe(true);
    });

    it('should handle cleanup operations safely', async () => {
      // Create temp directory with nested structure
      const nestedDir = path.join(updateManager.tempDir, 'nested', 'deep');
      await fs.ensureDir(nestedDir);
      await fs.writeFile(path.join(nestedDir, 'file.txt'), 'content');
      
      expect(await fs.pathExists(updateManager.tempDir)).toBe(true);
      
      await updateManager.cleanupTempDir();
      
      expect(await fs.pathExists(updateManager.tempDir)).toBe(false);
    });
  });
});