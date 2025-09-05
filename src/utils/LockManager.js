const fs = require('fs').promises;
const path = require('path');

/**
 * 文件锁管理器
 * 提供统一的文件锁机制，避免并发操作冲突
 * 
 * @class
 * @example
 * const LockManager = require('./LockManager');
 * 
 * // 使用withLock方法自动管理锁
 * await LockManager.withLock('/tmp/config.lock', async () => {
 *   // 执行需要锁保护的操作
 *   await FileUtils.writeJsonAtomic('config.json', data);
 * });
 * 
 * // 手动管理锁
 * await LockManager.acquire('/tmp/config.lock');
 * try {
 *   // 执行操作
 * } finally {
 *   await LockManager.release('/tmp/config.lock');
 * }
 */
class LockManager {
  /**
   * 活跃的锁集合
   * @type {Map<string, {acquired: number, timeout: NodeJS.Timeout}>}
   * @private
   */
  static #activeLocks = new Map();

  /**
   * 锁文件默认超时时间（毫秒）
   * @type {number}
   * @private
   */
  static #DEFAULT_TIMEOUT = 30000; // 30秒

  /**
   * 获取文件锁
   * 使用锁文件机制确保同一时间只有一个进程可以操作特定资源
   * 
   * @param {string} lockFilePath - 锁文件路径
   * @param {Object} [options={}] - 锁选项
   * @param {number} [options.timeout=30000] - 锁超时时间（毫秒）
   * @param {number} [options.retryInterval=100] - 重试间隔（毫秒）
   * @param {number} [options.maxRetries=300] - 最大重试次数
   * @returns {Promise<void>}
   * @throws {Error} 当无法获取锁时抛出错误
   * 
   * @example
   * // 获取默认锁
   * await LockManager.acquire('/tmp/config.lock');
   * 
   * // 自定义锁参数
   * await LockManager.acquire('/tmp/config.lock', {
   *   timeout: 60000,    // 60秒超时
   *   retryInterval: 50, // 50毫秒重试间隔
   *   maxRetries: 1200   // 最多重试1200次
   * });
   */
  static async acquire(lockFilePath, options = {}) {
    const { timeout = this.#DEFAULT_TIMEOUT, retryInterval = 100, maxRetries = 300 } = options;
    
    // 检查是否已经持有此锁
    if (this.#activeLocks.has(lockFilePath)) {
      return;
    }

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      
      try {
        // 尝试创建锁文件
        const lockContent = JSON.stringify({
          pid: process.pid,
          acquired: Date.now(),
          timeout: timeout
        });

        await fs.writeFile(lockFilePath, lockContent, { flag: 'wx' });
        
        // 设置自动超时释放
        const timeoutId = setTimeout(() => {
          this.release(lockFilePath).catch(() => {
            // 忽略超时释放时的错误
          });
        }, timeout);

        // 记录活跃锁
        this.#activeLocks.set(lockFilePath, {
          acquired: Date.now(),
          timeout: timeoutId
        });

        return;
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }

        // 检查锁文件是否过期
        try {
          const lockContent = await fs.readFile(lockFilePath, 'utf8');
          const lockData = JSON.parse(lockContent);
          
          if (Date.now() - lockData.acquired > lockData.timeout) {
            // 锁已过期，删除并重试
            await fs.unlink(lockFilePath);
            continue;
          }
        } catch {
          // 锁文件损坏，删除并重试
          try {
            await fs.unlink(lockFilePath);
          } catch {
            // 忽略删除错误
          }
        }

        // 检查是否超时
        if (Date.now() - startTime > timeout) {
          throw new Error(`无法获取锁 ${lockFilePath}，在 ${timeout}ms 后超时`);
        }

        // 等待重试
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }

    throw new Error(`无法获取锁 ${lockFilePath}，达到最大重试次数 ${maxRetries}`);
  }

  /**
   * 释放文件锁
   * 
   * @param {string} lockFilePath - 锁文件路径
   * @returns {Promise<void>}
   * @throws {Error} 当释放锁失败时抛出错误
   * 
   * @example
   * // 释放锁
   * await LockManager.release('/tmp/config.lock');
   */
  static async release(lockFilePath) {
    // 清除超时定时器
    const lockInfo = this.#activeLocks.get(lockFilePath);
    if (lockInfo && lockInfo.timeout) {
      clearTimeout(lockInfo.timeout);
    }

    // 从活跃锁中移除
    this.#activeLocks.delete(lockFilePath);

    // 删除锁文件
    try {
      await fs.unlink(lockFilePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 使用锁执行操作（自动管理锁的生命周期）
   * 这是最推荐的锁使用方式，确保锁的正确获取和释放
   * 
   * @param {string} lockFilePath - 锁文件路径
   * @param {Function} operation - 要执行的操作（返回Promise）
   * @param {Object} [options={}] - 锁选项
   * @param {number} [options.timeout=30000] - 锁超时时间（毫秒）
   * @param {number} [options.retryInterval=100] - 重试间隔（毫秒）
   * @param {number} [options.maxRetries=300] - 最大重试次数
   * @returns {Promise<*>} 操作的结果
   * @throws {Error} 当获取锁失败或操作失败时抛出错误
   * 
   * @example
   * // 基本用法
   * const result = await LockManager.withLock('/tmp/config.lock', async () => {
   *   return await someProtectedOperation();
   * });
   * 
   * // 带错误处理
   * try {
   *   await LockManager.withLock('/tmp/config.lock', async () => {
   *     await FileUtils.writeJsonAtomic('config.json', data);
   *   });
   * } catch (error) {
   *   console.error('操作失败:', error);
   * }
   */
  static async withLock(lockFilePath, operation, options = {}) {
    await this.acquire(lockFilePath, options);
    
    try {
      const result = await operation();
      return result;
    } finally {
      await this.release(lockFilePath);
    }
  }

  /**
   * 检查锁是否存在
   * 
   * @param {string} lockFilePath - 锁文件路径
   * @returns {Promise<boolean>} 锁是否存在
   * 
   * @example
   * const isLocked = await LockManager.isLocked('/tmp/config.lock');
   * if (isLocked) {
   *   console.log('资源被锁定');
   * }
   */
  static async isLocked(lockFilePath) {
    try {
      await fs.access(lockFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 强制释放所有活跃锁
   * 通常在进程退出时调用，确保清理所有锁
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * // 进程退出时清理所有锁
   * process.on('exit', async () => {
   *   await LockManager.forceReleaseAll();
   * });
   */
  static async forceReleaseAll() {
    const releasePromises = Array.from(this.#activeLocks.keys()).map(lockFilePath => 
      this.release(lockFilePath).catch(() => {
        // 忽略单个锁释放失败
      })
    );
    
    await Promise.allSettled(releasePromises);
  }

  /**
   * 获取活跃锁信息
   * 主要用于调试和监控
   * 
   * @returns {Array<{path: string, acquired: number, age: number}>} 活跃锁信息数组
   * 
   * @example
   * const activeLocks = LockManager.getActiveLocks();
   * console.log('活跃锁:', activeLocks);
   */
  static getActiveLocks() {
    return Array.from(this.#activeLocks.entries()).map(([path, info]) => ({
      path,
      acquired: info.acquired,
      age: Date.now() - info.acquired
    }));
  }
}

// 进程退出时自动清理所有锁
process.on('exit', () => {
  LockManager.forceReleaseAll().catch(() => {
    // 忽略清理错误
  });
});

module.exports = LockManager;