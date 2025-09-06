/**
 * Resource Manager
 * 
 * 统一的资源管理器，确保所有异步操作和资源得到正确清理
 * 防止内存泄漏和测试环境污染
 */

const EventEmitter = require('events');

class ResourceManager extends EventEmitter {
  constructor() {
    super();
    this.resources = new Map();
    this.timers = new Set();
    this.processes = new Set();
    this.streams = new Set();
    this.cleanup = [];
    this.isShuttingDown = false;
    
    // 注册进程退出事件
    process.on('exit', () => this.cleanupSync());
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('unhandledRejection');
    });
  }

  /**
   * 注册定时器资源
   * @param {NodeJS.Timeout} timer - 定时器引用
   * @param {string} [name] - 资源名称
   * @returns {NodeJS.Timeout} 返回定时器引用
   */
  registerTimer(timer, name = 'anonymous') {
    this.timers.add({ timer, name, type: 'timer' });
    return timer;
  }

  /**
   * 注册进程资源
   * @param {ChildProcess} process - 子进程引用
   * @param {string} [name] - 资源名称
   * @returns {ChildProcess} 返回进程引用
   */
  registerProcess(process, name = 'anonymous') {
    const processInfo = { process, name, type: 'process' };
    this.processes.add(processInfo);
    
    // 自动清理已结束的进程
    process.on('exit', () => {
      this.processes.delete(processInfo);
    });
    
    return process;
  }

  /**
   * 注册流资源
   * @param {Stream} stream - 流引用
   * @param {string} [name] - 资源名称
   * @returns {Stream} 返回流引用
   */
  registerStream(stream, name = 'anonymous') {
    const streamInfo = { stream, name, type: 'stream' };
    this.streams.add(streamInfo);
    
    // 自动清理已结束的流
    stream.on('close', () => {
      this.streams.delete(streamInfo);
    });
    
    stream.on('end', () => {
      this.streams.delete(streamInfo);
    });
    
    return stream;
  }

  /**
   * 注册通用资源
   * @param {string} key - 资源键
   * @param {*} resource - 资源对象
   * @param {Function} cleanupFn - 清理函数
   */
  registerResource(key, resource, cleanupFn) {
    this.resources.set(key, { resource, cleanup: cleanupFn });
  }

  /**
   * 注册清理函数
   * @param {Function} cleanupFn - 清理函数
   * @param {string} [name] - 清理函数名称
   */
  registerCleanup(cleanupFn, name = 'anonymous') {
    this.cleanup.push({ fn: cleanupFn, name });
  }

  /**
   * 移除特定资源
   * @param {string} key - 资源键
   * @returns {boolean} 是否成功移除
   */
  async removeResource(key) {
    const resource = this.resources.get(key);
    if (resource) {
      try {
        await resource.cleanup(resource.resource);
        this.resources.delete(key);
        return true;
      } catch (error) {
        console.warn(`Failed to cleanup resource ${key}:`, error.message);
        return false;
      }
    }
    return false;
  }

  /**
   * 清理所有定时器
   * @returns {Promise<number>} 清理的定时器数量
   */
  async cleanupTimers() {
    let cleaned = 0;
    for (const timerInfo of this.timers) {
      try {
        clearTimeout(timerInfo.timer);
        clearInterval(timerInfo.timer);
        cleaned++;
      } catch (error) {
        console.warn(`Failed to cleanup timer ${timerInfo.name}:`, error.message);
      }
    }
    this.timers.clear();
    return cleaned;
  }

  /**
   * 清理所有进程
   * @returns {Promise<number>} 清理的进程数量
   */
  async cleanupProcesses() {
    let cleaned = 0;
    for (const processInfo of this.processes) {
      try {
        if (!processInfo.process.killed) {
          processInfo.process.kill('SIGTERM');
          
          // 如果进程在2秒内没有退出，强制杀死
          setTimeout(() => {
            if (!processInfo.process.killed) {
              processInfo.process.kill('SIGKILL');
            }
          }, 2000);
          
          cleaned++;
        }
      } catch (error) {
        console.warn(`Failed to cleanup process ${processInfo.name}:`, error.message);
      }
    }
    this.processes.clear();
    return cleaned;
  }

  /**
   * 清理所有流
   * @returns {Promise<number>} 清理的流数量
   */
  async cleanupStreams() {
    let cleaned = 0;
    for (const streamInfo of this.streams) {
      try {
        if (!streamInfo.stream.destroyed) {
          streamInfo.stream.destroy();
          cleaned++;
        }
      } catch (error) {
        console.warn(`Failed to cleanup stream ${streamInfo.name}:`, error.message);
      }
    }
    this.streams.clear();
    return cleaned;
  }

  /**
   * 清理所有资源
   * @returns {Promise<Object>} 清理统计信息
   */
  async cleanupAll() {
    if (this.isShuttingDown) {
      return { alreadyShuttingDown: true };
    }
    
    this.isShuttingDown = true;
    
    const stats = {
      timers: 0,
      processes: 0,
      streams: 0,
      resources: 0,
      cleanupFunctions: 0,
      errors: []
    };

    try {
      // 清理定时器
      stats.timers = await this.cleanupTimers();

      // 清理流
      stats.streams = await this.cleanupStreams();

      // 清理进程（最后清理，因为可能需要时间）
      stats.processes = await this.cleanupProcesses();

      // 清理通用资源
      for (const [key, resource] of this.resources) {
        try {
          await resource.cleanup(resource.resource);
          stats.resources++;
        } catch (error) {
          stats.errors.push(`Resource ${key}: ${error.message}`);
        }
      }
      this.resources.clear();

      // 执行清理函数
      for (const cleanupInfo of this.cleanup) {
        try {
          await cleanupInfo.fn();
          stats.cleanupFunctions++;
        } catch (error) {
          stats.errors.push(`Cleanup function ${cleanupInfo.name}: ${error.message}`);
        }
      }
      this.cleanup = [];

      // 触发清理完成事件
      this.emit('cleanup-complete', stats);
      
    } catch (error) {
      stats.errors.push(`General cleanup error: ${error.message}`);
    } finally {
      this.isShuttingDown = false;
    }

    return stats;
  }

  /**
   * 同步清理（用于进程退出时）
   */
  cleanupSync() {
    if (this.isShuttingDown) {
      return;
    }
    
    // 同步清理定时器
    for (const timerInfo of this.timers) {
      try {
        clearTimeout(timerInfo.timer);
        clearInterval(timerInfo.timer);
      } catch (error) {
        // 忽略错误，因为是同步清理
      }
    }

    // 同步清理流
    for (const streamInfo of this.streams) {
      try {
        if (!streamInfo.stream.destroyed) {
          streamInfo.stream.destroy();
        }
      } catch (error) {
        // 忽略错误
      }
    }

    // 同步清理进程
    for (const processInfo of this.processes) {
      try {
        if (!processInfo.process.killed) {
          processInfo.process.kill('SIGKILL'); // 强制杀死
        }
      } catch (error) {
        // 忽略错误
      }
    }
  }

  /**
   * 优雅关闭
   * @param {string} signal - 关闭信号
   */
  async shutdown(signal) {
    console.log(`\nReceived ${signal}, cleaning up resources...`);
    
    const stats = await this.cleanupAll();
    
    console.log('Cleanup completed:', {
      timers: stats.timers,
      processes: stats.processes,
      streams: stats.streams,
      resources: stats.resources,
      cleanupFunctions: stats.cleanupFunctions,
      errors: stats.errors.length
    });

    if (stats.errors.length > 0) {
      console.log('Cleanup errors:', stats.errors);
    }

    // 延迟一小段时间确保清理完成
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }

  /**
   * 获取当前资源统计
   * @returns {Object} 资源统计信息
   */
  getStats() {
    return {
      timers: this.timers.size,
      processes: this.processes.size,
      streams: this.streams.size,
      resources: this.resources.size,
      cleanupFunctions: this.cleanup.length,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * 创建一个自动管理的 setTimeout
   * @param {Function} callback - 回调函数
   * @param {number} delay - 延迟时间
   * @param {string} [name] - 定时器名称
   * @returns {NodeJS.Timeout} 定时器引用
   */
  setTimeout(callback, delay, name = 'anonymous') {
    const timerInfo = { timer: null, name, type: 'timer' };
    
    const timer = setTimeout((...args) => {
      // 执行完成后自动从管理器中移除
      this.timers.delete(timerInfo);
      callback(...args);
    }, delay);
    
    timerInfo.timer = timer;
    this.timers.add(timerInfo);
    return timer;
  }

  /**
   * 创建一个自动管理的 setInterval
   * @param {Function} callback - 回调函数
   * @param {number} interval - 间隔时间
   * @param {string} [name] - 定时器名称
   * @returns {NodeJS.Timeout} 定时器引用
   */
  setInterval(callback, interval, name = 'anonymous') {
    const timer = setInterval(callback, interval);
    return this.registerTimer(timer, name);
  }
}

// 创建全局单例
const globalResourceManager = new ResourceManager();

// 导出单例和类
module.exports = globalResourceManager;
module.exports.ResourceManager = ResourceManager;
module.exports.createResourceManager = () => new ResourceManager();