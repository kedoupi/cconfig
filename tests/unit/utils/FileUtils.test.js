const FileUtils = require('../../../src/utils/FileUtils');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    mkdir: jest.fn(),
    lstat: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
    copyFile: jest.fn()
  },
  createReadStream: jest.fn()
}));

describe('FileUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchPathExists', () => {
    it('should check multiple paths and return results', async () => {
      fs.access.mockImplementation((path) => {
        if (path === '/exists/file1' || path === '/exists/file2') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const paths = ['/exists/file1', '/not/exists', '/exists/file2'];
      const results = await FileUtils.batchPathExists(paths);

      expect(results).toEqual([
        { path: '/exists/file1', exists: true },
        { path: '/not/exists', exists: false },
        { path: '/exists/file2', exists: true }
      ]);
    });

    it('should handle empty array', async () => {
      const results = await FileUtils.batchPathExists([]);
      expect(results).toEqual([]);
    });

    it('should handle all non-existent paths', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      const paths = ['/not/exists1', '/not/exists2'];
      const results = await FileUtils.batchPathExists(paths);

      expect(results).toEqual([
        { path: '/not/exists1', exists: false },
        { path: '/not/exists2', exists: false }
      ]);
    });
  });

  describe('readJsonSafe', () => {
    it('should read and parse JSON file', async () => {
      const data = { key: 'value', number: 123 };
      fs.readFile.mockResolvedValue(JSON.stringify(data));

      const result = await FileUtils.readJsonSafe('/path/to/file.json');
      expect(result).toEqual(data);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.json', 'utf8');
    });

    it('should return default value for non-existent file', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const defaultValue = { default: true };
      const result = await FileUtils.readJsonSafe('/not/exists.json', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should throw error for other file errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readFile.mockRejectedValue(error);

      await expect(FileUtils.readJsonSafe('/file.json')).rejects.toThrow('Permission denied');
    });

    it('should handle invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      await expect(FileUtils.readJsonSafe('/file.json')).rejects.toThrow();
    });
  });

  describe('writeJsonAtomic', () => {
    it('should write JSON atomically', async () => {
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();

      const data = { key: 'value' };
      await FileUtils.writeJsonAtomic('/path/file.json', data);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/^\/path\/file\.json\.tmp\.\d+$/),
        JSON.stringify(data, null, 2),
        { mode: 0o644 }
      );
      expect(fs.rename).toHaveBeenCalled();
    });

    it('should use custom options', async () => {
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();

      const data = { key: 'value' };
      await FileUtils.writeJsonAtomic('/path/file.json', data, { mode: 0o600, spaces: 4 });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(data, null, 4),
        { mode: 0o600 }
      );
    });

    it('should clean up temp file on error', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      fs.unlink.mockResolvedValue();

      await expect(FileUtils.writeJsonAtomic('/path/file.json', {}))
        .rejects.toThrow('Write failed');

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should handle cleanup errors silently', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      fs.unlink.mockRejectedValue(new Error('Unlink failed'));

      await expect(FileUtils.writeJsonAtomic('/path/file.json', {}))
        .rejects.toThrow('Write failed');
    });
  });

  describe('ensureDir', () => {
    it('should create directory with default permissions', async () => {
      fs.mkdir.mockResolvedValue();

      await FileUtils.ensureDir('/path/to/dir');

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/dir', {
        recursive: true,
        mode: 0o755
      });
    });

    it('should create directory with custom permissions', async () => {
      fs.mkdir.mockResolvedValue();

      await FileUtils.ensureDir('/path/to/dir', 0o700);

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/dir', {
        recursive: true,
        mode: 0o700
      });
    });

    it('should ignore EEXIST errors', async () => {
      const error = new Error('Directory exists');
      error.code = 'EEXIST';
      fs.mkdir.mockRejectedValue(error);

      await expect(FileUtils.ensureDir('/path/to/dir')).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.mkdir.mockRejectedValue(error);

      await expect(FileUtils.ensureDir('/path/to/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('hashFile', () => {
    it('should calculate file hash', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('chunk1');
          yield Buffer.from('chunk2');
        }
      };

      require('fs').createReadStream.mockReturnValue(mockStream);

      const result = await FileUtils.hashFile('/path/to/file');
      
      // The actual hash value will depend on the crypto implementation
      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // SHA256 hex string length
    });

    it('should use custom algorithm', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('data');
        }
      };

      require('fs').createReadStream.mockReturnValue(mockStream);

      const result = await FileUtils.hashFile('/path/to/file', 'md5');
      
      expect(typeof result).toBe('string');
      expect(result.length).toBe(32); // MD5 hex string length
    });
  });

  describe('safeRemove', () => {
    it('should remove file', async () => {
      fs.lstat.mockResolvedValue({ isDirectory: () => false });
      fs.unlink.mockResolvedValue();

      await FileUtils.safeRemove('/path/to/file');

      expect(fs.unlink).toHaveBeenCalledWith('/path/to/file');
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('should remove directory recursively', async () => {
      fs.lstat.mockResolvedValue({ isDirectory: () => true });
      fs.rm.mockResolvedValue();

      await FileUtils.safeRemove('/path/to/dir');

      expect(fs.rm).toHaveBeenCalledWith('/path/to/dir', {
        recursive: true,
        force: true
      });
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should ignore ENOENT errors', async () => {
      const error = new Error('Not found');
      error.code = 'ENOENT';
      fs.lstat.mockRejectedValue(error);

      await expect(FileUtils.safeRemove('/not/exists')).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.lstat.mockRejectedValue(error);

      await expect(FileUtils.safeRemove('/protected')).rejects.toThrow('Permission denied');
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      fs.lstat.mockResolvedValue({ isDirectory: () => false });
      fs.copyFile.mockResolvedValue();

      await FileUtils.copy('/source/file', '/dest/file');

      expect(fs.copyFile).toHaveBeenCalledWith('/source/file', '/dest/file');
    });

    it('should copy directory recursively', async () => {
      // First call for source directory
      fs.lstat.mockResolvedValueOnce({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1', 'file2']);
      
      // Subsequent calls for files in directory
      fs.lstat.mockResolvedValue({ isDirectory: () => false });
      fs.copyFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();

      await FileUtils.copy('/source/dir', '/dest/dir');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.readdir).toHaveBeenCalledWith('/source/dir');
      expect(fs.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should handle nested directories', async () => {
      // Setup mock for nested directory structure
      fs.lstat.mockImplementation((path) => {
        if (path.includes('subdir')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.resolve({ isDirectory: () => false });
      });

      fs.readdir.mockImplementation((dirPath) => {
        if (dirPath === '/source') {
          return Promise.resolve(['subdir']);
        }
        if (dirPath === '/source/subdir') {
          return Promise.resolve(['file.txt']);
        }
        return Promise.resolve([]);
      });

      fs.mkdir.mockResolvedValue();
      fs.copyFile.mockResolvedValue();

      await FileUtils.copy('/source', '/dest');

      expect(fs.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.copyFile).toHaveBeenCalled();
    });
  });

  describe('getDirectorySize', () => {
    it('should calculate total directory size', async () => {
      fs.lstat.mockImplementation((path) => {
        if (path === '/dir') {
          return Promise.resolve({ 
            isDirectory: () => true, 
            size: 0 
          });
        }
        if (path === '/dir/file1') {
          return Promise.resolve({ 
            isDirectory: () => false, 
            size: 1000 
          });
        }
        if (path === '/dir/file2') {
          return Promise.resolve({ 
            isDirectory: () => false, 
            size: 2000 
          });
        }
        if (path === '/dir/subdir') {
          return Promise.resolve({ 
            isDirectory: () => true, 
            size: 0 
          });
        }
        if (path === '/dir/subdir/file3') {
          return Promise.resolve({ 
            isDirectory: () => false, 
            size: 500 
          });
        }
      });

      fs.readdir.mockImplementation((dirPath) => {
        if (dirPath === '/dir') {
          return Promise.resolve(['file1', 'file2', 'subdir']);
        }
        if (dirPath === '/dir/subdir') {
          return Promise.resolve(['file3']);
        }
        return Promise.resolve([]);
      });

      const size = await FileUtils.getDirectorySize('/dir');
      expect(size).toBe(3500);
    });

    it('should handle empty directory', async () => {
      fs.lstat.mockResolvedValue({ 
        isDirectory: () => true, 
        size: 0 
      });
      fs.readdir.mockResolvedValue([]);

      const size = await FileUtils.getDirectorySize('/empty');
      expect(size).toBe(0);
    });

    it('should handle single file', async () => {
      fs.lstat.mockResolvedValue({ 
        isDirectory: () => false, 
        size: 12345 
      });

      const size = await FileUtils.getDirectorySize('/file');
      expect(size).toBe(12345);
    });
  });
});