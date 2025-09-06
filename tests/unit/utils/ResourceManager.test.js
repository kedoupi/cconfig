/**
 * ResourceManager Unit Tests
 * 测试资源管理器的所有功能
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const ResourceManager = require('../../../src/utils/ResourceManager');

describe('ResourceManager', () => {
  let resourceManager;

  beforeEach(() => {
    // 每个测试使用独立的ResourceManager实例
    const { ResourceManager: RM } = require('../../../src/utils/ResourceManager');
    resourceManager = new RM();
  });

  afterEach(async () => {
    // 每个测试后清理资源
    if (resourceManager) {
      await resourceManager.cleanupAll();
    }
  });

  describe('constructor', () => {
    it('should initialize with empty collections', () => {
      expect(resourceManager.resources).toBeInstanceOf(Map);
      expect(resourceManager.timers).toBeInstanceOf(Set);
      expect(resourceManager.processes).toBeInstanceOf(Set);
      expect(resourceManager.streams).toBeInstanceOf(Set);
      expect(resourceManager.cleanup).toBeInstanceOf(Array);
      expect(resourceManager.isShuttingDown).toBe(false);
    });

    it('should extend EventEmitter', () => {
      expect(resourceManager).toBeInstanceOf(EventEmitter);
    });
  });

  describe('registerTimer', () => {
    it('should register a timer successfully', () => {
      const timer = setTimeout(() => {}, 1000);
      
      const result = resourceManager.registerTimer(timer, 'test-timer');
      
      expect(result).toBe(timer);
      expect(resourceManager.timers.size).toBe(1);
      
      // 清理
      clearTimeout(timer);
    });

    it('should use default name for anonymous timer', () => {
      const timer = setTimeout(() => {}, 1000);
      
      resourceManager.registerTimer(timer);
      
      expect(resourceManager.timers.size).toBe(1);
      const timerInfo = Array.from(resourceManager.timers)[0];
      expect(timerInfo.name).toBe('anonymous');
      expect(timerInfo.type).toBe('timer');
      
      clearTimeout(timer);
    });

    it('should handle multiple timers', () => {
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setInterval(() => {}, 1000);
      
      resourceManager.registerTimer(timer1, 'timer1');
      resourceManager.registerTimer(timer2, 'timer2');
      
      expect(resourceManager.timers.size).toBe(2);
      
      clearTimeout(timer1);
      clearInterval(timer2);
    });
  });

  describe('registerProcess', () => {
    it('should register a process successfully', () => {
      const mockProcess = new EventEmitter();
      mockProcess.pid = 12345;
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;
      
      const result = resourceManager.registerProcess(mockProcess, 'test-process');
      
      expect(result).toBe(mockProcess);
      expect(resourceManager.processes.size).toBe(1);
    });

    it('should auto-cleanup process on exit', () => {
      const mockProcess = new EventEmitter();
      mockProcess.pid = 12345;
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;
      
      resourceManager.registerProcess(mockProcess, 'test-process');
      expect(resourceManager.processes.size).toBe(1);
      
      // 模拟进程退出
      mockProcess.emit('exit');
      
      expect(resourceManager.processes.size).toBe(0);
    });
  });

  describe('registerStream', () => {
    it('should register a stream successfully', () => {
      const mockStream = new Readable();
      
      const result = resourceManager.registerStream(mockStream, 'test-stream');
      
      expect(result).toBe(mockStream);
      expect(resourceManager.streams.size).toBe(1);
    });

    it('should auto-cleanup stream on close', () => {
      const mockStream = new EventEmitter();
      mockStream.destroy = jest.fn();
      mockStream.destroyed = false;
      
      resourceManager.registerStream(mockStream, 'test-stream');
      expect(resourceManager.streams.size).toBe(1);
      
      // 模拟流关闭
      mockStream.emit('close');
      
      expect(resourceManager.streams.size).toBe(0);
    });

    it('should auto-cleanup stream on end', () => {
      const mockStream = new EventEmitter();
      mockStream.destroy = jest.fn();
      mockStream.destroyed = false;
      
      resourceManager.registerStream(mockStream, 'test-stream');
      expect(resourceManager.streams.size).toBe(1);
      
      // 模拟流结束
      mockStream.emit('end');
      
      expect(resourceManager.streams.size).toBe(0);
    });
  });

  describe('registerResource', () => {
    it('should register a generic resource with cleanup function', () => {
      const mockResource = { data: 'test' };
      const cleanupFn = jest.fn();
      
      resourceManager.registerResource('test-key', mockResource, cleanupFn);
      
      expect(resourceManager.resources.size).toBe(1);
      expect(resourceManager.resources.get('test-key')).toEqual({
        resource: mockResource,
        cleanup: cleanupFn
      });
    });

    it('should overwrite existing resource with same key', () => {
      const resource1 = { data: 'test1' };
      const resource2 = { data: 'test2' };
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();
      
      resourceManager.registerResource('test-key', resource1, cleanup1);
      resourceManager.registerResource('test-key', resource2, cleanup2);
      
      expect(resourceManager.resources.size).toBe(1);
      expect(resourceManager.resources.get('test-key').resource).toBe(resource2);
    });
  });

  describe('registerCleanup', () => {
    it('should register cleanup function', () => {
      const cleanupFn = jest.fn();
      
      resourceManager.registerCleanup(cleanupFn, 'test-cleanup');
      
      expect(resourceManager.cleanup).toHaveLength(1);
      expect(resourceManager.cleanup[0]).toEqual({
        fn: cleanupFn,
        name: 'test-cleanup'
      });
    });

    it('should use default name for anonymous cleanup', () => {
      const cleanupFn = jest.fn();
      
      resourceManager.registerCleanup(cleanupFn);
      
      expect(resourceManager.cleanup[0].name).toBe('anonymous');
    });
  });

  describe('removeResource', () => {
    it('should remove and cleanup existing resource', async () => {
      const mockResource = { data: 'test' };
      const cleanupFn = jest.fn().mockResolvedValue();
      
      resourceManager.registerResource('test-key', mockResource, cleanupFn);
      
      const result = await resourceManager.removeResource('test-key');
      
      expect(result).toBe(true);
      expect(cleanupFn).toHaveBeenCalledWith(mockResource);
      expect(resourceManager.resources.has('test-key')).toBe(false);
    });

    it('should return false for non-existent resource', async () => {
      const result = await resourceManager.removeResource('non-existent');
      
      expect(result).toBe(false);
    });

    it('should handle cleanup function errors gracefully', async () => {
      const mockResource = { data: 'test' };
      const cleanupFn = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      resourceManager.registerResource('test-key', mockResource, cleanupFn);
      
      const result = await resourceManager.removeResource('test-key');
      
      expect(result).toBe(false);
      expect(resourceManager.resources.has('test-key')).toBe(true);
    });
  });

  describe('cleanupTimers', () => {
    it('should cleanup all registered timers', async () => {
      const timer1 = setTimeout(() => {}, 5000);
      const timer2 = setInterval(() => {}, 1000);
      
      resourceManager.registerTimer(timer1, 'timer1');
      resourceManager.registerTimer(timer2, 'timer2');
      
      const cleaned = await resourceManager.cleanupTimers();
      
      expect(cleaned).toBe(2);
      expect(resourceManager.timers.size).toBe(0);
      
      // 验证定时器已被清理（不会执行）
      clearTimeout(timer1); // 预防性清理
      clearInterval(timer2);
    });

    it('should handle empty timers collection', async () => {
      const cleaned = await resourceManager.cleanupTimers();
      
      expect(cleaned).toBe(0);
    });
  });

  describe('cleanupProcesses', () => {
    it('should cleanup all registered processes', async () => {
      const mockProcess1 = new EventEmitter();
      mockProcess1.kill = jest.fn();
      mockProcess1.killed = false;
      
      const mockProcess2 = new EventEmitter();
      mockProcess2.kill = jest.fn();
      mockProcess2.killed = false;
      
      resourceManager.registerProcess(mockProcess1, 'process1');
      resourceManager.registerProcess(mockProcess2, 'process2');
      
      const cleaned = await resourceManager.cleanupProcesses();
      
      expect(cleaned).toBe(2);
      expect(mockProcess1.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess2.kill).toHaveBeenCalledWith('SIGTERM');
      expect(resourceManager.processes.size).toBe(0);
    });

    it('should skip already killed processes', async () => {
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = true;
      
      resourceManager.registerProcess(mockProcess, 'process1');
      
      const cleaned = await resourceManager.cleanupProcesses();
      
      expect(cleaned).toBe(0);
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStreams', () => {
    it('should cleanup all registered streams', async () => {
      const mockStream1 = new EventEmitter();
      mockStream1.destroy = jest.fn();
      mockStream1.destroyed = false;
      
      const mockStream2 = new EventEmitter();
      mockStream2.destroy = jest.fn();
      mockStream2.destroyed = false;
      
      resourceManager.registerStream(mockStream1, 'stream1');
      resourceManager.registerStream(mockStream2, 'stream2');
      
      const cleaned = await resourceManager.cleanupStreams();
      
      expect(cleaned).toBe(2);
      expect(mockStream1.destroy).toHaveBeenCalled();
      expect(mockStream2.destroy).toHaveBeenCalled();
      expect(resourceManager.streams.size).toBe(0);
    });

    it('should skip already destroyed streams', async () => {
      const mockStream = new EventEmitter();
      mockStream.destroy = jest.fn();
      mockStream.destroyed = true;
      
      resourceManager.registerStream(mockStream, 'stream1');
      
      const cleaned = await resourceManager.cleanupStreams();
      
      expect(cleaned).toBe(0);
      expect(mockStream.destroy).not.toHaveBeenCalled();
    });
  });

  describe('cleanupAll', () => {
    it('should cleanup all resources and return stats', async () => {
      // 注册各种资源
      const timer = setTimeout(() => {}, 5000);
      resourceManager.registerTimer(timer, 'test-timer');
      
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;
      resourceManager.registerProcess(mockProcess, 'test-process');
      
      const mockStream = new EventEmitter();
      mockStream.destroy = jest.fn();
      mockStream.destroyed = false;
      resourceManager.registerStream(mockStream, 'test-stream');
      
      const mockResource = { data: 'test' };
      const cleanupFn = jest.fn().mockResolvedValue();
      resourceManager.registerResource('test-key', mockResource, cleanupFn);
      
      const cleanupFunc = jest.fn().mockResolvedValue();
      resourceManager.registerCleanup(cleanupFunc, 'test-cleanup');
      
      const stats = await resourceManager.cleanupAll();
      
      expect(stats.timers).toBe(1);
      expect(stats.processes).toBe(1);
      expect(stats.streams).toBe(1);
      expect(stats.resources).toBe(1);
      expect(stats.cleanupFunctions).toBe(1);
      expect(stats.errors).toEqual([]);
      
      expect(resourceManager.timers.size).toBe(0);
      expect(resourceManager.processes.size).toBe(0);
      expect(resourceManager.streams.size).toBe(0);
      expect(resourceManager.resources.size).toBe(0);
      expect(resourceManager.cleanup).toHaveLength(0);
    });

    it('should handle cleanup errors and continue', async () => {
      const failingCleanup = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      resourceManager.registerResource('failing-key', {}, failingCleanup);
      
      const workingCleanup = jest.fn().mockResolvedValue();
      resourceManager.registerResource('working-key', {}, workingCleanup);
      
      const stats = await resourceManager.cleanupAll();
      
      expect(stats.resources).toBe(1); // Only one succeeded
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0]).toContain('Cleanup failed');
    });

    it('should prevent concurrent cleanup calls', async () => {
      resourceManager.isShuttingDown = true;
      
      const stats = await resourceManager.cleanupAll();
      
      expect(stats.alreadyShuttingDown).toBe(true);
    });

    it('should emit cleanup-complete event', async () => {
      const eventPromise = new Promise((resolve) => {
        resourceManager.once('cleanup-complete', resolve);
      });
      
      await resourceManager.cleanupAll();
      
      const stats = await eventPromise;
      expect(stats).toBeDefined();
    });
  });

  describe('cleanupSync', () => {
    it('should cleanup synchronously without errors', () => {
      const timer = setTimeout(() => {}, 5000);
      resourceManager.registerTimer(timer, 'test-timer');
      
      const mockStream = new EventEmitter();
      mockStream.destroy = jest.fn();
      mockStream.destroyed = false;
      resourceManager.registerStream(mockStream, 'test-stream');
      
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;
      resourceManager.registerProcess(mockProcess, 'test-process');
      
      // 应该不抛出异常
      expect(() => {
        resourceManager.cleanupSync();
      }).not.toThrow();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    it('should handle already shutting down state', () => {
      resourceManager.isShuttingDown = true;
      
      expect(() => {
        resourceManager.cleanupSync();
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return current resource statistics', () => {
      const timer = setTimeout(() => {}, 5000);
      resourceManager.registerTimer(timer, 'test-timer');
      
      const mockProcess = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;
      resourceManager.registerProcess(mockProcess, 'test-process');
      
      resourceManager.registerResource('test-key', {}, jest.fn());
      resourceManager.registerCleanup(jest.fn());
      
      const stats = resourceManager.getStats();
      
      expect(stats).toEqual({
        timers: 1,
        processes: 1,
        streams: 0,
        resources: 1,
        cleanupFunctions: 1,
        isShuttingDown: false
      });
      
      clearTimeout(timer);
    });
  });

  describe('setTimeout', () => {
    it('should create managed timeout', async () => {
      let executed = false;
      
      const timer = resourceManager.setTimeout(() => {
        executed = true;
      }, 50, 'test-timeout');
      
      expect(resourceManager.timers.size).toBe(1);
      
      // 等待定时器执行
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(executed).toBe(true);
      // 执行后应该自动从管理器中移除
      expect(resourceManager.timers.size).toBe(0);
    });
  });

  describe('setInterval', () => {
    it('should create managed interval', async () => {
      let count = 0;
      
      const timer = resourceManager.setInterval(() => {
        count++;
      }, 50, 'test-interval');
      
      expect(resourceManager.timers.size).toBe(1);
      
      // 等待几次执行
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(count).toBeGreaterThan(1);
      
      clearInterval(timer);
    });
  });

  describe('shutdown', () => {
    it('should perform graceful shutdown', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      // 添加一些资源
      resourceManager.registerResource('test', {}, jest.fn().mockResolvedValue());
      
      await resourceManager.shutdown('TEST');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Received TEST'));
      
      // 等待一小段时间让setTimeout执行
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});