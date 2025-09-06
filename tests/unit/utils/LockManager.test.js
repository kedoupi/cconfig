/**
 * LockManager Unit Tests
 * 测试文件锁管理功能
 */

const fs = require('fs-extra');
const path = require('path');
const LockManager = require('../../../src/utils/LockManager');
const testUtils = require('../../helpers/testUtils');

describe('LockManager', () => {
  let testDir;
  let lockFilePath;

  beforeEach(async () => {
    testDir = await testUtils.createTempDir('lock-test');
    lockFilePath = path.join(testDir, 'test.lock');
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('acquire and release', () => {
    it('should acquire and release a lock successfully', async () => {
      // 获取锁
      await LockManager.acquire(lockFilePath);
      
      // 验证锁文件存在
      expect(await fs.pathExists(lockFilePath)).toBe(true);
      
      // 读取锁文件内容
      const lockData = await fs.readJson(lockFilePath);
      expect(lockData).toHaveProperty('pid');
      expect(lockData).toHaveProperty('acquired');
      expect(lockData.pid).toBe(process.pid);
      
      // 释放锁
      await LockManager.release(lockFilePath);
      
      // 验证锁文件已被删除
      expect(await fs.pathExists(lockFilePath)).toBe(false);
    });

    it('should handle acquiring already held lock by same process', async () => {
      // 先获取锁
      await LockManager.acquire(lockFilePath);
      
      try {
        // 同一进程再次获取锁应该成功（因为已经持有）
        await expect(LockManager.acquire(lockFilePath)).resolves.not.toThrow();
        
        // 验证锁文件仍然存在
        expect(await fs.pathExists(lockFilePath)).toBe(true);
      } finally {
        // 确保清理
        await LockManager.release(lockFilePath);
      }
    });

    it('should handle release of non-existent lock gracefully', async () => {
      const nonExistentLock = path.join(testDir, 'non-existent.lock');
      
      // 释放不存在的锁不应该抛出异常
      await expect(LockManager.release(nonExistentLock)).resolves.not.toThrow();
    });

    it('should fail when lock directory does not exist', async () => {
      const nestedLockPath = path.join(testDir, 'nested', 'dir', 'test.lock');
      
      // LockManager不会自动创建目录，这应该失败
      await expect(LockManager.acquire(nestedLockPath)).rejects.toThrow();
    });
  });

  describe('withLock', () => {
    it('should execute callback with lock protection', async () => {
      let executed = false;
      
      await LockManager.withLock(lockFilePath, async () => {
        // 在锁保护下验证锁文件存在
        expect(await fs.pathExists(lockFilePath)).toBe(true);
        executed = true;
      });
      
      // 验证回调已执行
      expect(executed).toBe(true);
      
      // 验证锁已被释放
      expect(await fs.pathExists(lockFilePath)).toBe(false);
    });

    it('should release lock even if callback throws error', async () => {
      const testError = new Error('Test error');
      
      await expect(
        LockManager.withLock(lockFilePath, async () => {
          // 验证锁已获取
          expect(await fs.pathExists(lockFilePath)).toBe(true);
          throw testError;
        })
      ).rejects.toThrow('Test error');
      
      // 验证锁已被释放
      expect(await fs.pathExists(lockFilePath)).toBe(false);
    });

    it('should pass return value from callback', async () => {
      const expectedResult = { data: 'test' };
      
      const result = await LockManager.withLock(lockFilePath, async () => {
        return expectedResult;
      });
      
      expect(result).toBe(expectedResult);
    });
  });

  describe('isLocked', () => {
    it('should return false for non-existent lock', async () => {
      expect(await LockManager.isLocked(lockFilePath)).toBe(false);
    });

    it('should return true for active lock', async () => {
      await LockManager.acquire(lockFilePath);
      
      try {
        expect(await LockManager.isLocked(lockFilePath)).toBe(true);
      } finally {
        await LockManager.release(lockFilePath);
      }
    });

    it('should return true for any existing lock file', async () => {
      // 创建一个锁文件（无论内容如何）
      const staleLockData = {
        pid: 99999, // 假设的不存在的进程ID
        acquired: Date.now() - 60000, // 1分钟前
        timeout: 30000
      };
      
      await fs.writeJson(lockFilePath, staleLockData);
      
      expect(await LockManager.isLocked(lockFilePath)).toBe(true);
    });

    it('should return true even for corrupted lock file', async () => {
      // 创建损坏的锁文件
      await fs.writeFile(lockFilePath, 'invalid json');
      
      expect(await LockManager.isLocked(lockFilePath)).toBe(true);
    });
  });

  describe('forceReleaseAll', () => {
    it('should release all active locks', async () => {
      // 创建多个锁
      const lock1 = path.join(testDir, 'lock1.lock');
      const lock2 = path.join(testDir, 'lock2.lock');
      
      await LockManager.acquire(lock1);
      await LockManager.acquire(lock2);
      
      // 验证锁文件存在
      expect(await fs.pathExists(lock1)).toBe(true);
      expect(await fs.pathExists(lock2)).toBe(true);
      
      // 强制释放所有锁
      await LockManager.forceReleaseAll();
      
      // 验证锁文件被删除
      expect(await fs.pathExists(lock1)).toBe(false);
      expect(await fs.pathExists(lock2)).toBe(false);
    });

    it('should handle empty active locks', async () => {
      // 没有活跃锁时应该正常完成
      await expect(LockManager.forceReleaseAll()).resolves.not.toThrow();
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple processes trying to acquire same lock', async () => {
      const promises = [];
      const results = [];
      
      // 模拟5个并发进程尝试获取同一个锁
      for (let i = 0; i < 5; i++) {
        promises.push(
          LockManager.withLock(lockFilePath, async () => {
            results.push(i);
            // 短暂延迟模拟实际工作
            await new Promise(resolve => setTimeout(resolve, 10));
          }, { timeout: 1000, maxRetries: 50 })
        );
      }
      
      await Promise.all(promises);
      
      // 所有任务都应该完成
      expect(results).toHaveLength(5);
      expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      if (process.platform === 'win32') {
        // Windows权限模型不同，跳过此测试
        return;
      }
      
      // 创建只读目录
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o555); // 只读权限
      
      const readOnlyLock = path.join(readOnlyDir, 'test.lock');
      
      try {
        await expect(LockManager.acquire(readOnlyLock)).rejects.toThrow();
      } finally {
        // 恢复权限以便清理
        await fs.chmod(readOnlyDir, 0o755);
      }
    });

    it('should handle invalid lock file paths', async () => {
      const invalidPaths = [
        '', // 空路径
        '/\0invalid', // 包含null字符
      ];
      
      for (const invalidPath of invalidPaths) {
        await expect(LockManager.acquire(invalidPath)).rejects.toThrow();
      }
    });
  });

  describe('timeout handling', () => {
    it('should respect custom timeout values', async () => {
      // 首先创建一个外部的锁文件（模拟其他进程持有的锁）
      const lockContent = JSON.stringify({
        pid: 99999, // 不同的进程ID
        acquired: Date.now(),
        timeout: 60000 // 长时间锁
      });
      
      await fs.writeFile(lockFilePath, lockContent);
      
      const startTime = Date.now();
      
      await expect(
        LockManager.acquire(lockFilePath, { 
          timeout: 200, 
          retryInterval: 50,
          maxRetries: 4 
        })
      ).rejects.toThrow();
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(150); // 至少尝试了指定的时间
      expect(elapsed).toBeLessThan(500); // 但不会等太久
      
      // 清理
      await fs.remove(lockFilePath);
    });
  });
});