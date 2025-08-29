/**
 * ErrorHandler Test Suite
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ErrorHandler = require('../../../src/utils/errorHandler');
const { createTestEnvironment, cleanupTestEnvironment } = require('../../helpers/testUtils');

describe('ErrorHandler', () => {
  let errorHandler;
  let testConfigDir;
  let originalLogFile;

  beforeEach(async () => {
    const testEnv = await createTestEnvironment('error-handler');
    testConfigDir = testEnv.configDir;
    
    errorHandler = new ErrorHandler();
    
    // Redirect log file to test directory
    originalLogFile = errorHandler.logFile;
    errorHandler.logFile = path.join(testConfigDir, 'error.log');
  });

  afterEach(async () => {
    // Restore original log file path
    errorHandler.logFile = originalLogFile;
    await cleanupTestEnvironment(testConfigDir);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const handler = new ErrorHandler();
      expect(handler.logFile).toBe(path.join(os.homedir(), '.claude', 'ccvm', 'error.log'));
      expect(handler.maxLogSize).toBe(10 * 1024 * 1024);
      expect(handler.maxLogFiles).toBe(3);
    });
  });

  describe('categorizeError', () => {
    it('should categorize network errors correctly', () => {
      const networkError = { message: 'network timeout', code: 'ENOTFOUND' };
      expect(errorHandler.categorizeError(networkError)).toBe('network');

      const connectionError = { message: 'connection refused', code: 'ECONNREFUSED' };
      expect(errorHandler.categorizeError(connectionError)).toBe('network');
    });

    it('should categorize filesystem errors correctly', () => {
      const fileNotFound = { message: 'file not found', code: 'ENOENT' };
      expect(errorHandler.categorizeError(fileNotFound)).toBe('filesystem');

      const permissionDenied = { message: 'permission denied', code: 'EACCES' };
      expect(errorHandler.categorizeError(permissionDenied)).toBe('filesystem');
    });

    it('should categorize configuration errors correctly', () => {
      const configError = { message: 'configuration is invalid', code: null };
      expect(errorHandler.categorizeError(configError)).toBe('configuration');

      const providerError = { message: 'provider not found', code: null };
      expect(errorHandler.categorizeError(providerError)).toBe('configuration');
    });

    it('should categorize validation errors correctly', () => {
      const validationError = { message: 'validation failed', code: null };
      expect(errorHandler.categorizeError(validationError)).toBe('validation');

      const invalidError = { message: 'invalid input provided', code: null };
      expect(errorHandler.categorizeError(invalidError)).toBe('validation');
    });

    it('should categorize lock errors correctly', () => {
      const lockError = { message: 'resource is locked', code: null };
      expect(errorHandler.categorizeError(lockError)).toBe('lock');
    });

    it('should return unknown for unrecognized errors', () => {
      const unknownError = { message: 'something went wrong', code: 'UNKNOWN' };
      expect(errorHandler.categorizeError(unknownError)).toBe('unknown');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly messages for each category', () => {
      expect(errorHandler.getUserFriendlyMessage('original', 'network'))
        .toContain('Network connection failed');
      
      expect(errorHandler.getUserFriendlyMessage('original', 'filesystem'))
        .toContain('File system error');
      
      expect(errorHandler.getUserFriendlyMessage('original', 'configuration'))
        .toContain('Configuration error');
      
      expect(errorHandler.getUserFriendlyMessage('original', 'unknown'))
        .toContain('unexpected error');
    });

    it('should fall back to original message for unknown categories', () => {
      const original = 'original error message';
      expect(errorHandler.getUserFriendlyMessage(original, 'nonexistent'))
        .toBe(original);
    });
  });

  describe('getSuggestions', () => {
    it('should provide relevant suggestions for each error category', () => {
      const networkSuggestions = errorHandler.getSuggestions('network', {});
      expect(networkSuggestions).toContain('Check your internet connection');

      const fsSuggestions = errorHandler.getSuggestions('filesystem', {});
      expect(fsSuggestions).toContain('Check if the file or directory exists');

      const configSuggestions = errorHandler.getSuggestions('configuration', {});
      expect(configSuggestions).toContain('Run "ccvm doctor --fix" to check and repair configuration');

      const validationSuggestions = errorHandler.getSuggestions('validation', {});
      expect(validationSuggestions).toContain('Double-check your input values');
    });

    it('should return default suggestions for unknown categories', () => {
      const suggestions = errorHandler.getSuggestions('nonexistent', {});
      expect(suggestions).toContain('Check the error log for more details');
    });
  });

  describe('handleError', () => {
    it('should handle and format errors correctly', async () => {
      const error = new Error('Test error message');
      error.code = 'TEST_CODE';
      
      const context = { operation: 'test', file: 'test.js' };
      const result = await errorHandler.handleError(error, context);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('code', 'TEST_CODE');
      expect(result).toHaveProperty('context', context);
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('supportInfo');
      expect(result.supportInfo).toHaveProperty('timestamp');
      expect(result.supportInfo).toHaveProperty('logFile');
    });

    it('should log error to file', async () => {
      const error = new Error('Test logging error');
      
      await errorHandler.handleError(error, { test: true });
      
      expect(await fs.pathExists(errorHandler.logFile)).toBe(true);
      
      const logContent = await fs.readFile(errorHandler.logFile, 'utf8');
      expect(logContent).toContain('Test logging error');
      expect(logContent).toContain('"test": true');
    });
  });

  describe('logError', () => {
    it('should create log directory if it does not exist', async () => {
      const logDir = path.dirname(errorHandler.logFile);
      await fs.remove(logDir);
      
      expect(await fs.pathExists(logDir)).toBe(false);
      
      const errorInfo = {
        timestamp: new Date().toISOString(),
        message: 'test message',
        stack: 'test stack'
      };
      
      await errorHandler.logError(errorInfo);
      
      expect(await fs.pathExists(logDir)).toBe(true);
      expect(await fs.pathExists(errorHandler.logFile)).toBe(true);
    });

    it('should append errors to log file', async () => {
      const error1 = { message: 'First error', timestamp: '2023-01-01T00:00:00Z' };
      const error2 = { message: 'Second error', timestamp: '2023-01-02T00:00:00Z' };
      
      await errorHandler.logError(error1);
      await errorHandler.logError(error2);
      
      const logContent = await fs.readFile(errorHandler.logFile, 'utf8');
      expect(logContent).toContain('First error');
      expect(logContent).toContain('Second error');
    });

    it('should handle logging failures gracefully', async () => {
      // Mock fs.appendFile to fail
      const originalAppendFile = fs.appendFile;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      fs.appendFile = jest.fn().mockRejectedValue(new Error('Write failed'));
      
      const errorInfo = { message: 'test error' };
      
      await expect(errorHandler.logError(errorInfo)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log error:', 'Write failed');
      
      // Restore mocks
      fs.appendFile = originalAppendFile;
      consoleSpy.mockRestore();
    });
  });

  describe('rotateLogsIfNeeded', () => {
    it('should not rotate if log file does not exist', async () => {
      expect(await fs.pathExists(errorHandler.logFile)).toBe(false);
      
      await expect(errorHandler.rotateLogsIfNeeded()).resolves.not.toThrow();
    });

    it('should not rotate if log file is under size limit', async () => {
      await fs.writeFile(errorHandler.logFile, 'small log content');
      
      const statsBefore = await fs.stat(errorHandler.logFile);
      await errorHandler.rotateLogsIfNeeded();
      const statsAfter = await fs.stat(errorHandler.logFile);
      
      expect(statsAfter.size).toBe(statsBefore.size);
    });

    it('should rotate logs when size limit is exceeded', async () => {
      // Create a large log file (larger than maxLogSize)
      const largeContent = 'x'.repeat(errorHandler.maxLogSize + 1000);
      await fs.writeFile(errorHandler.logFile, largeContent);
      
      await errorHandler.rotateLogsIfNeeded();
      
      expect(await fs.pathExists(`${errorHandler.logFile}.1`)).toBe(true);
      expect(await fs.pathExists(errorHandler.logFile)).toBe(false);
    });
  });

  describe('getRecentErrors', () => {
    it('should return empty array when no log file exists', async () => {
      const errors = await errorHandler.getRecentErrors();
      expect(errors).toEqual([]);
    });

    it('should parse and return recent errors', async () => {
      const error1 = { message: 'Error 1', timestamp: '2023-01-01T00:00:00Z' };
      const error2 = { message: 'Error 2', timestamp: '2023-01-02T00:00:00Z' };
      
      await errorHandler.logError(error1);
      await errorHandler.logError(error2);
      
      const errors = await errorHandler.getRecentErrors(5);
      
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Error 2'); // Most recent first
      expect(errors[1].message).toBe('Error 1');
    });

    it('should limit results to specified count', async () => {
      // Add multiple errors
      for (let i = 0; i < 5; i++) {
        await errorHandler.logError({ message: `Error ${i}`, timestamp: new Date().toISOString() });
      }
      
      const errors = await errorHandler.getRecentErrors(3);
      expect(errors.length).toBeLessThanOrEqual(3);
    });

    it('should handle malformed log entries gracefully', async () => {
      await fs.writeFile(errorHandler.logFile, 'invalid json\n---\n{"valid": "json"}\n---\n');
      
      const errors = await errorHandler.getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].valid).toBe('json');
    });
  });

  describe('clearLogs', () => {
    it('should remove log files successfully', async () => {
      await fs.writeFile(errorHandler.logFile, 'test content');
      await fs.writeFile(`${errorHandler.logFile}.1`, 'rotated content');
      
      expect(await fs.pathExists(errorHandler.logFile)).toBe(true);
      expect(await fs.pathExists(`${errorHandler.logFile}.1`)).toBe(true);
      
      const result = await errorHandler.clearLogs();
      
      expect(result).toBe(true);
      expect(await fs.pathExists(errorHandler.logFile)).toBe(false);
      expect(await fs.pathExists(`${errorHandler.logFile}.1`)).toBe(false);
    });

    it('should return false on failure', async () => {
      // Mock fs.remove to fail
      const originalRemove = fs.remove;
      fs.remove = jest.fn().mockRejectedValue(new Error('Remove failed'));
      
      const result = await errorHandler.clearLogs();
      expect(result).toBe(false);
      
      // Restore mock
      fs.remove = originalRemove;
    });
  });

  describe('validateRecoveryOptions', () => {
    it('should provide appropriate recovery options for configuration errors', async () => {
      const configError = { message: 'configuration error', code: null };
      const options = await errorHandler.validateRecoveryOptions(configError);
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.some(opt => opt.command === 'ccvm doctor --fix')).toBe(true);
      expect(options.every(opt => opt.safe === true)).toBe(true);
    });

    it('should provide recovery options for filesystem errors', async () => {
      const fsError = { message: 'file system error', code: 'ENOENT' };
      const options = await errorHandler.validateRecoveryOptions(fsError);
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.some(opt => opt.command === 'ccvm doctor')).toBe(true);
    });

    it('should provide default recovery options for unknown errors', async () => {
      const unknownError = { message: 'mystery error', code: null };
      const options = await errorHandler.validateRecoveryOptions(unknownError);
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.some(opt => opt.command === 'ccvm doctor')).toBe(true);
    });
  });

  describe('getErrorStats', () => {
    it('should return null when no errors exist', async () => {
      const stats = await errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.byCategory).toEqual({});
      expect(stats.mostCommon).toEqual([]);
    });

    it('should calculate error statistics correctly', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago
      const oneDayAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      
      // Add test errors
      await errorHandler.logError({
        message: 'network error',
        code: 'ENOTFOUND',
        timestamp: oneHourAgo.toISOString()
      });
      
      await errorHandler.logError({
        message: 'file error',
        code: 'ENOENT',
        timestamp: oneDayAgo.toISOString()
      });
      
      const stats = await errorHandler.getErrorStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byCategory.network).toBe(1);
      expect(stats.byCategory.filesystem).toBe(1);
      expect(stats.byTimeRange.lastHour).toBe(1);
      expect(stats.byTimeRange.lastDay).toBe(2);
      expect(stats.mostCommon.length).toBeGreaterThan(0);
    });
  });
});