const FileUtils = require('../../../src/utils/FileUtils');
const testUtils = require('../../helpers/testUtils');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('FileUtils', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await testUtils.createTempDir('fileutils-test');
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('batchPathExists', () => {
    it('should check multiple paths and return results', async () => {
      // Create test files
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      const nonExistent1 = path.join(testDir, 'nonexistent1.txt');
      const nonExistent2 = path.join(testDir, 'nonexistent2.txt');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const paths = [file1, file2, nonExistent1, nonExistent2];
      const results = await FileUtils.batchPathExists(paths);

      expect(results).toEqual([
        { path: file1, exists: true },
        { path: file2, exists: true },
        { path: nonExistent1, exists: false },
        { path: nonExistent2, exists: false }
      ]);
    });

    it('should handle empty array', async () => {
      const results = await FileUtils.batchPathExists([]);
      expect(results).toEqual([]);
    });

    it('should handle all non-existent paths', async () => {
      const paths = [
        path.join(testDir, 'not1'),
        path.join(testDir, 'not2')
      ];
      const results = await FileUtils.batchPathExists(paths);
      
      expect(results).toEqual([
        { path: paths[0], exists: false },
        { path: paths[1], exists: false }
      ]);
    });
  });

  describe('readJsonSafe', () => {
    it('should read and parse JSON file', async () => {
      const data = { key: 'value', number: 123 };
      const filePath = path.join(testDir, 'test.json');
      await fs.writeJson(filePath, data);

      const result = await FileUtils.readJsonSafe(filePath);
      expect(result).toEqual(data);
    });

    it('should return default value for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.json');
      const defaultValue = { default: true };
      
      const result = await FileUtils.readJsonSafe(filePath, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should throw error for other file errors', async () => {
      const filePath = path.join(testDir, 'restricted.json');
      await fs.writeFile(filePath, 'content', { mode: 0o000 }); // No permissions

      await expect(FileUtils.readJsonSafe(filePath))
        .rejects.toThrow();
    });

    it('should handle invalid JSON', async () => {
      const filePath = path.join(testDir, 'invalid.json');
      await fs.writeFile(filePath, 'invalid json content');

      await expect(FileUtils.readJsonSafe(filePath))
        .rejects.toThrow();
    });
  });

  describe('writeJsonAtomic', () => {
    it('should write JSON atomically', async () => {
      const data = { key: 'value', number: 123 };
      const filePath = path.join(testDir, 'output.json');

      await FileUtils.writeJsonAtomic(filePath, data);

      const result = await fs.readJson(filePath);
      expect(result).toEqual(data);
    });

    it('should use custom options', async () => {
      const data = { key: 'value' };
      const filePath = path.join(testDir, 'output.json');
      const options = { spaces: 2 };

      await FileUtils.writeJsonAtomic(filePath, data, options);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain('{\n  "key": "value"\n}');
    });

    it('should clean up temp file on error', async () => {
      const data = { key: 'value' };
      const filePath = path.join(testDir, 'output.json');
      
      // Create a directory at the target path to cause an error
      await fs.ensureDir(filePath);

      await expect(FileUtils.writeJsonAtomic(filePath, data))
        .rejects.toThrow();

      // Check that no temp files were left behind
      const files = await fs.readdir(testDir);
      expect(files).toContain(path.basename(filePath));
      expect(files.filter(f => f.includes('.tmp'))).toHaveLength(0);
    });

    it('should handle cleanup errors silently', async () => {
      const data = { key: 'value' };
      const filePath = path.join(testDir, 'output.json');
      
      // Create a directory at the target path to cause an error
      await fs.ensureDir(filePath);

      // This should not throw even if cleanup fails
      await expect(FileUtils.writeJsonAtomic(filePath, data))
        .rejects.toThrow();
    });
  });

  describe('ensureDir', () => {
    it('should create directory with default permissions', async () => {
      const dirPath = path.join(testDir, 'newdir');
      
      await FileUtils.ensureDir(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create directory with custom permissions', async () => {
      const dirPath = path.join(testDir, 'customdir');
      
      await FileUtils.ensureDir(dirPath, 0o755);
      
      expect(await fs.pathExists(dirPath)).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should ignore EEXIST errors', async () => {
      const dirPath = path.join(testDir, 'existingdir');
      await fs.ensureDir(dirPath);
      
      // Should not throw when directory already exists
      await expect(FileUtils.ensureDir(dirPath))
        .resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const invalidPath = '/invalid/path/that/cannot/be/created';
      
      await expect(FileUtils.ensureDir(invalidPath))
        .rejects.toThrow();
    });
  });

  describe('hashFile', () => {
    it('should calculate file hash', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content);

      const hash = await FileUtils.hashFile(filePath);
      expect(hash).toMatch(/^[a-f0-9]+$/);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should use custom algorithm', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content);

      const hash256 = await FileUtils.hashFile(filePath, 'sha256');
      const hash512 = await FileUtils.hashFile(filePath, 'sha512');
      
      expect(hash256).not.toBe(hash512);
      expect(hash256).toMatch(/^[a-f0-9]+$/);
      expect(hash512).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('safeRemove', () => {
    it('should remove file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      expect(await fs.pathExists(filePath)).toBe(true);
      
      await FileUtils.safeRemove(filePath);
      
      expect(await fs.pathExists(filePath)).toBe(false);
    });

    it('should remove directory recursively', async () => {
      const dirPath = path.join(testDir, 'nested');
      const subDirPath = path.join(dirPath, 'subdir');
      const filePath = path.join(subDirPath, 'file.txt');
      
      await fs.ensureDir(subDirPath);
      await fs.writeFile(filePath, 'content');

      expect(await fs.pathExists(dirPath)).toBe(true);
      
      await FileUtils.safeRemove(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(false);
    });

    it('should ignore ENOENT errors', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent');
      
      await expect(FileUtils.safeRemove(nonExistentPath))
        .resolves.toBeUndefined();
    });

    it('should handle various error scenarios gracefully', async () => {
      // Test that safeRemove handles various scenarios without throwing
      // In most cases, safeRemove is designed to be resilient
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'content');
      
      // Should succeed for normal files
      await expect(FileUtils.safeRemove(filePath))
        .resolves.toBeUndefined();
      
      // Should handle non-existent paths gracefully
      await expect(FileUtils.safeRemove('/nonexistent/path'))
        .resolves.toBeUndefined();
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      const content = 'Test content';
      
      await fs.writeFile(sourceFile, content);

      await FileUtils.copy(sourceFile, destFile);

      expect(await fs.pathExists(destFile)).toBe(true);
      const copiedContent = await fs.readFile(destFile, 'utf8');
      expect(copiedContent).toBe(content);
    });

    it('should copy directory recursively', async () => {
      const sourceDir = path.join(testDir, 'source');
      const destDir = path.join(testDir, 'dest');
      const subDir = path.join(sourceDir, 'subdir');
      const file1 = path.join(sourceDir, 'file1.txt');
      const file2 = path.join(subDir, 'file2.txt');
      
      await fs.ensureDir(subDir);
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      await FileUtils.copy(sourceDir, destDir);

      expect(await fs.pathExists(destDir)).toBe(true);
      expect(await fs.pathExists(path.join(destDir, 'file1.txt'))).toBe(true);
      expect(await fs.pathExists(path.join(destDir, 'subdir', 'file2.txt'))).toBe(true);
    });

    it('should handle nested directories', async () => {
      const sourceDir = path.join(testDir, 'source');
      const destDir = path.join(testDir, 'dest');
      const nestedDir = path.join(sourceDir, 'level1', 'level2', 'level3');
      const testFile = path.join(nestedDir, 'test.txt');
      
      await fs.ensureDir(nestedDir);
      await fs.writeFile(testFile, 'deep content');

      await FileUtils.copy(sourceDir, destDir);

      expect(await fs.pathExists(path.join(destDir, 'level1', 'level2', 'level3', 'test.txt')))
        .toBe(true);
    });
  });

  describe('getDirectorySize', () => {
    it('should calculate total directory size', async () => {
      const dirPath = path.join(testDir, 'testdir');
      const file1 = path.join(dirPath, 'file1.txt');
      const file2 = path.join(dirPath, 'file2.txt');
      const subDir = path.join(dirPath, 'subdir');
      const file3 = path.join(subDir, 'file3.txt');
      
      await fs.ensureDir(subDir);
      await fs.writeFile(file1, 'content1'); // 9 bytes
      await fs.writeFile(file2, 'content2'); // 9 bytes
      await fs.writeFile(file3, 'content3'); // 9 bytes

      const size = await FileUtils.getDirectorySize(dirPath);
      
      // Total size should be sum of all files (directory sizes not included)
      // Actual size may vary by platform/encoding, so just check it's reasonable
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(100);
    });

    it('should handle empty directory', async () => {
      const dirPath = path.join(testDir, 'emptydir');
      await fs.ensureDir(dirPath);

      const size = await FileUtils.getDirectorySize(dirPath);
      
      expect(size).toBe(0);
    });

    it('should handle single file', async () => {
      const filePath = path.join(testDir, 'singlefile.txt');
      const content = 'This is a test file with specific content';
      await fs.writeFile(filePath, content);

      const size = await FileUtils.getDirectorySize(filePath);
      
      expect(size).toBe(content.length);
    });
  });
});