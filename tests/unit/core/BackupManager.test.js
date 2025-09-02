const BackupManager = require('../../../src/core/BackupManager');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { PassThrough } = require('stream');

jest.mock('fs-extra');
jest.mock('crypto');

describe('BackupManager', () => {
  let backupManager;
  const testConfigDir = '/test/.claude/ccvm';
  const testBackupDir = path.join(testConfigDir, 'backups');

  beforeEach(() => {
    jest.clearAllMocks();
    backupManager = new BackupManager(testConfigDir);
    
    // Default mocks
    fs.existsSync.mockReturnValue(false);
    fs.ensureDirSync.mockReturnValue(undefined);
    fs.readdirSync.mockReturnValue([]);
    fs.readJsonSync.mockReturnValue({});
    fs.writeJsonSync.mockReturnValue(undefined);
    fs.copySync.mockReturnValue(undefined);
    fs.removeSync.mockReturnValue(undefined);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(backupManager.configDir).toBe(testConfigDir);
      expect(backupManager.backupDir).toBe(testBackupDir);
      expect(backupManager.maxBackups).toBe(10);
    });
  });

  describe('init', () => {
    it('should create backup directory if not exists', () => {
      fs.existsSync.mockReturnValue(false);
      
      backupManager.init();
      
      expect(fs.ensureDirSync).toHaveBeenCalledWith(testBackupDir);
    });

    it('should not create directory if already exists', () => {
      fs.existsSync.mockReturnValue(true);
      
      backupManager.init();
      
      expect(fs.ensureDirSync).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const mockFiles = ['config.json', 'providers/test.json'];
    const mockTimestamp = '2025-01-01_10-00-00';
    
    beforeEach(() => {
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-01-01T10:00:00.000Z');
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(mockFiles);
      fs.statSync.mockReturnValue({ 
        isDirectory: () => false,
        isFile: () => true,
        size: 1024
      });
      
      // Mock crypto for hash
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mockhash123')
      };
      crypto.createHash.mockReturnValue(mockHash);
    });

    it('should create backup with description', () => {
      const result = backupManager.create('Test backup');
      
      expect(result.success).toBe(true);
      expect(result.backupId).toContain('2025-01-01');
      expect(fs.copySync).toHaveBeenCalledTimes(mockFiles.length);
    });

    it('should create metadata file', () => {
      backupManager.create('Test backup');
      
      expect(fs.writeJsonSync).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        expect.objectContaining({
          timestamp: expect.any(String),
          description: 'Test backup',
          files: expect.any(Array)
        }),
        { spaces: 2 }
      );
    });

    it('should handle backup failure', () => {
      fs.copySync.mockImplementation(() => {
        throw new Error('Copy failed');
      });
      
      const result = backupManager.create('Failed backup');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Copy failed');
    });

    it('should skip directories when backing up', () => {
      fs.statSync.mockReturnValue({ 
        isDirectory: () => true,
        isFile: () => false
      });
      fs.readdirSync.mockReturnValue(['somedir']);
      
      const result = backupManager.create('Test');
      
      expect(fs.copySync).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('restore', () => {
    const backupId = '2025-01-01_10-00-00';
    const backupPath = path.join(testBackupDir, backupId);

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        timestamp: '2025-01-01T10:00:00.000Z',
        files: [
          { path: 'config.json', hash: 'hash1' },
          { path: 'providers/test.json', hash: 'hash2' }
        ]
      });
      fs.readdirSync.mockReturnValue(['config.json', 'providers']);
    });

    it('should restore backup successfully', () => {
      const result = backupManager.restore(backupId);
      
      expect(result.success).toBe(true);
      expect(fs.copySync).toHaveBeenCalled();
    });

    it('should create restore backup before restoring', () => {
      jest.spyOn(backupManager, 'create').mockReturnValue({ 
        success: true, 
        backupId: 'restore-backup' 
      });
      
      backupManager.restore(backupId);
      
      expect(backupManager.create).toHaveBeenCalledWith(
        expect.stringContaining('Before restore')
      );
    });

    it('should handle non-existent backup', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = backupManager.restore('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should verify backup integrity', () => {
      fs.readJsonSync.mockReturnValueOnce({
        files: [{ path: 'config.json' }]
      });
      fs.readdirSync.mockReturnValue(['different.json']);
      
      const result = backupManager.restore(backupId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('integrity check failed');
    });
  });

  describe('list', () => {
    it('should return empty array when no backups', () => {
      fs.existsSync.mockReturnValue(false);
      
      const list = backupManager.list();
      
      expect(list).toEqual([]);
    });

    it('should list all backups with metadata', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['backup1', 'backup2']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readJsonSync.mockReturnValueOnce({
        timestamp: '2025-01-01T10:00:00.000Z',
        description: 'Backup 1',
        files: [{ path: 'config.json' }]
      }).mockReturnValueOnce({
        timestamp: '2025-01-02T10:00:00.000Z',
        description: 'Backup 2',
        files: [{ path: 'config.json' }, { path: 'test.json' }]
      });
      
      const list = backupManager.list();
      
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        id: 'backup2',
        timestamp: '2025-01-02T10:00:00.000Z',
        description: 'Backup 2',
        fileCount: 2
      });
      expect(list[1]).toEqual({
        id: 'backup1',
        timestamp: '2025-01-01T10:00:00.000Z',
        description: 'Backup 1',
        fileCount: 1
      });
    });

    it('should handle corrupted backup metadata', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['corrupted']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      fs.readJsonSync.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });
      
      const list = backupManager.list();
      
      expect(list).toHaveLength(1);
      expect(list[0].description).toContain('Corrupted');
    });
  });

  describe('delete', () => {
    it('should delete existing backup', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = backupManager.delete('backup-id');
      
      expect(result.success).toBe(true);
      expect(fs.removeSync).toHaveBeenCalledWith(
        path.join(testBackupDir, 'backup-id')
      );
    });

    it('should handle non-existent backup', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = backupManager.delete('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle deletion error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.removeSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = backupManager.delete('backup-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('cleanup', () => {
    it('should remove old backups when exceeding limit', () => {
      fs.existsSync.mockReturnValue(true);
      const backups = Array.from({ length: 15 }, (_, i) => `backup-${i}`);
      fs.readdirSync.mockReturnValue(backups);
      fs.statSync.mockReturnValue({ 
        isDirectory: () => true,
        mtime: new Date()
      });
      
      backupManager.cleanup();
      
      // Should remove 5 oldest backups (15 - 10 = 5)
      expect(fs.removeSync).toHaveBeenCalledTimes(5);
    });

    it('should not remove backups when under limit', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['backup1', 'backup2']);
      
      backupManager.cleanup();
      
      expect(fs.removeSync).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(Array(15).fill('backup'));
      fs.statSync.mockReturnValue({ 
        isDirectory: () => true,
        mtime: new Date()
      });
      fs.removeSync.mockImplementation(() => {
        throw new Error('Cannot remove');
      });
      
      // Should not throw
      expect(() => backupManager.cleanup()).not.toThrow();
    });
  });

  describe('getBackupDetails', () => {
    it('should return detailed backup information', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        timestamp: '2025-01-01T10:00:00.000Z',
        description: 'Test backup',
        files: [
          { path: 'config.json', hash: 'abc123', size: 1024 },
          { path: 'test.json', hash: 'def456', size: 2048 }
        ]
      });
      
      const details = backupManager.getBackupDetails('backup-id');
      
      expect(details).toEqual({
        id: 'backup-id',
        timestamp: '2025-01-01T10:00:00.000Z',
        description: 'Test backup',
        files: expect.any(Array),
        totalSize: 3072
      });
    });

    it('should handle non-existent backup', () => {
      fs.existsSync.mockReturnValue(false);
      
      const details = backupManager.getBackupDetails('non-existent');
      
      expect(details).toBeNull();
    });
  });

  describe('verifyBackup', () => {
    it('should verify valid backup', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        timestamp: '2025-01-01T10:00:00.000Z',
        files: [{ path: 'config.json' }]
      });
      fs.readdirSync.mockReturnValue(['config.json', 'metadata.json']);
      
      const result = backupManager.verifyBackup('backup-id');
      
      expect(result.valid).toBe(true);
    });

    it('should detect missing files', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        files: [
          { path: 'config.json' },
          { path: 'missing.json' }
        ]
      });
      fs.readdirSync.mockReturnValue(['config.json', 'metadata.json']);
      
      const result = backupManager.verifyBackup('backup-id');
      
      expect(result.valid).toBe(false);
      expect(result.missingFiles).toContain('missing.json');
    });

    it('should detect extra files', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        files: [{ path: 'config.json' }]
      });
      fs.readdirSync.mockReturnValue(['config.json', 'extra.json', 'metadata.json']);
      
      const result = backupManager.verifyBackup('backup-id');
      
      expect(result.valid).toBe(false);
      expect(result.extraFiles).toContain('extra.json');
    });
  });

  describe('exportBackup', () => {
    it('should export backup to specified location', () => {
      fs.existsSync.mockReturnValue(true);
      const mockStream = new PassThrough();
      fs.createWriteStream.mockReturnValue(mockStream);
      fs.createReadStream.mockReturnValue(new PassThrough());
      
      const result = backupManager.exportBackup('backup-id', '/export/path.tar');
      
      expect(result.success).toBe(true);
      expect(result.exportPath).toBe('/export/path.tar');
    });
  });

  describe('importBackup', () => {
    it('should import backup from archive', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = backupManager.importBackup('/import/backup.tar');
      
      expect(result.success).toBe(true);
    });
  });
});