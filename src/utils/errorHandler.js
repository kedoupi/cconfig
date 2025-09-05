/**
 * Error Handler Utility
 * 
 * Provides comprehensive error handling, logging, and recovery mechanisms
 * for Claude Code Kit operations.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Logger = require('./logger');
const errorCodes = require('./errorCodes');

/**
 * 统一错误处理器
 * 提供一致的错误处理模式，包括错误分类、恢复建议和日志记录
 * 支持实例化和静态方法两种使用方式
 * 
 * @class
 * @example
 * const ErrorHandler = require('./errorHandler');
 * 
 * // 使用静态方法
 * const handledError = ErrorHandler.handle(error, 'operation');
 * 
 * // 使用实例方法
 * const errorHandler = new ErrorHandler();
 * await errorHandler.handleError(error, context);
 */
class ErrorHandler {
  /**
   * 默认配置
   * @type {Object}
   * @private
   */
  static #defaultConfig = {
    logFile: path.join(os.homedir(), '.claude', 'ccvm', 'error.log'),
    maxLogSize: 10 * 1024 * 1024, // 10MB
    maxLogFiles: 3,
    autoRotate: true
  };

  /**
   * 错误类型映射
   * @type {Object.<string, string>}
   * @private
   */
  static #errorTypes = {
    'ENOENT': 'FILE_NOT_FOUND',
    'EACCES': 'PERMISSION_DENIED',
    'EISDIR': 'INVALID_PATH',
    'ENOTDIR': 'INVALID_PATH',
    'EEXIST': 'FILE_EXISTS',
    'ENOSPC': 'DISK_FULL',
    'EPERM': 'PERMISSION_DENIED',
    'EINVAL': 'INVALID_ARGUMENT',
    'ENOTFOUND': 'NETWORK_ERROR',
    'ECONNREFUSED': 'NETWORK_ERROR',
    'ETIMEDOUT': 'TIMEOUT_ERROR',
    'EAI_AGAIN': 'NETWORK_ERROR'
  };

  constructor(config = {}) {
    this.config = { ...ErrorHandler.#defaultConfig, ...config };
    this.logFile = this.config.logFile;
  }

  /**
   * 静态方法：处理错误并返回标准化的错误信息
   * 
   * @param {Error|string} error - 原始错误或错误消息
   * @param {string} [operation=''] - 操作名称，用于上下文信息
   * @param {Object} [context={}] - 上下文信息
   * @returns {Object} 标准化的错误对象
   * 
   * @example
   * try {
   *   await someOperation();
   * } catch (error) {
   *   const handledError = ErrorHandler.handle(error, 'someOperation');
   *   console.error(handledError.message);
   * }
   */
  static handle(error, operation = '', context = {}) {
    const errorObj = error instanceof Error ? error : new Error(error);
    const errorCode = ErrorHandler.#determineErrorCode(errorObj);
    const errorInfo = errorCodes[errorCode] || errorCodes.UNKNOWN_ERROR;
    
    const handledError = {
      code: errorCode,
      message: errorInfo.message || errorObj.message,
      originalError: errorObj,
      operation,
      context,
      severity: errorInfo.severity || 'medium',
      suggestion: errorInfo.suggestion || ErrorHandler.#generateGenericSuggestion(errorCode),
      timestamp: new Date().toISOString(),
      recoverable: errorInfo.recoverable !== false
    };

    // 记录错误日志
    ErrorHandler.#logErrorStatic(handledError);

    return handledError;
  }

  /**
   * 静态方法：创建自定义错误
   * 
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {Object} [context={}] - 上下文信息
   * @returns {Error} 创建的错误对象
   */
  static createError(code, message, context = {}) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * 静态方法：包装异步函数，提供统一的错误处理
   * 
   * @param {Function} fn - 要包装的异步函数
   * @param {string} [operation=''] - 操作名称
   * @returns {Function} 包装后的函数
   */
  static wrapAsync(fn, operation = '') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const handledError = ErrorHandler.handle(error, operation, { args });
        throw ErrorHandler.createError(
          handledError.code,
          handledError.message,
          handledError.context
        );
      }
    };
  }

  /**
   * 静态方法：判断错误是否可恢复
   * 
   * @param {Error|Object} error - 错误对象
   * @returns {boolean} 是否可恢复
   */
  static isRecoverable(error) {
    const errorCode = error.code || ErrorHandler.#determineErrorCode(error);
    const errorInfo = errorCodes[errorCode];
    return errorInfo ? errorInfo.recoverable !== false : true;
  }

  /**
   * 静态方法：格式化错误消息用于用户显示
   * 
   * @param {Error|Object} error - 错误对象
   * @param {boolean} [includeSuggestion=true] - 是否包含建议
   * @returns {string} 格式化的错误消息
   */
  static formatError(error, includeSuggestion = true) {
    const handledError = ErrorHandler.handle(error);
    let message = `❌ ${handledError.message}`;
    
    if (handledError.operation) {
      message += `\n操作: ${handledError.operation}`;
    }
    
    if (includeSuggestion && handledError.suggestion) {
      message += `\n💡 建议: ${handledError.suggestion}`;
    }
    
    if (handledError.severity === 'high') {
      message += '\n⚠️ 这是一个严重错误，可能需要立即处理。';
    }
    
    return message;
  }

  /**
   * Handle and log errors with context
   */
  async handleError(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      code: error.code,
      context,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    // Log to file
    await this.logError(errorInfo);

    // Return formatted error for display
    return this.formatError(errorInfo);
  }

  /**
   * Log error to file with rotation
   */
  async logError(errorInfo) {
    try {
      // Ensure log directory exists
      await fs.ensureDir(path.dirname(this.logFile));

      // Check if log rotation is needed
      await this.rotateLogsIfNeeded();

      // Append error to log file
      const logEntry = JSON.stringify(errorInfo, null, 2) + '\n---\n';
      await fs.appendFile(this.logFile, logEntry);

    } catch (logError) {
      // If logging fails, write to stderr
      console.error('Failed to log error:', logError.message);
      console.error('Original error:', JSON.stringify(errorInfo, null, 2));
    }
  }

  /**
   * Rotate log files if they exceed size limit
   */
  async rotateLogsIfNeeded() {
    if (!await fs.pathExists(this.logFile)) {
      return;
    }

    const stats = await fs.stat(this.logFile);
    if (stats.size < this.maxLogSize) {
      return;
    }

    // Rotate existing log files
    for (let i = this.maxLogFiles - 1; i >= 1; i--) {
      const oldFile = `${this.logFile}.${i}`;
      const newFile = `${this.logFile}.${i + 1}`;
      
      if (await fs.pathExists(oldFile)) {
        if (i + 1 > this.maxLogFiles) {
          await fs.remove(oldFile);
        } else {
          await fs.move(oldFile, newFile);
        }
      }
    }

    // Move current log to .1
    await fs.move(this.logFile, `${this.logFile}.1`);
  }

  /**
   * Format error for user display
   */
  formatError(errorInfo) {
    const { message, code, context } = errorInfo;
    
    // Categorize error types
    const category = this.categorizeError(errorInfo);
    
    return {
      category,
      message: this.getUserFriendlyMessage(message, category),
      code,
      context,
      suggestions: this.getSuggestions(category, errorInfo),
      supportInfo: {
        timestamp: errorInfo.timestamp,
        logFile: this.logFile
      }
    };
  }

  /**
   * Categorize errors for better handling
   */
  categorizeError(errorInfo) {
    const { message, code } = errorInfo;
    
    // Network errors
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || message.includes('network')) {
      return 'network';
    }
    
    // File system errors
    if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM') {
      return 'filesystem';
    }
    
    // Configuration errors
    if (message.includes('configuration') || message.includes('provider') || message.includes('alias')) {
      return 'configuration';
    }
    
    // Permission errors
    if (message.includes('permission') || code === 'EACCES') {
      return 'permission';
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    // Lock errors
    if (message.includes('lock') || message.includes('locked')) {
      return 'lock';
    }
    
    // CLI errors
    if (message.includes('command') || message.includes('CLI')) {
      return 'cli';
    }
    
    return 'unknown';
  }

  /**
   * Get user-friendly error messages
   */
  getUserFriendlyMessage(originalMessage, category) {
    const messages = {
      network: 'Network connection failed. Please check your internet connection and try again.',
      filesystem: 'File system error occurred. Please check file permissions and disk space.',
      configuration: 'Configuration error detected. The system configuration may be corrupted or incomplete.',
      permission: 'Permission denied. Please check file and directory permissions.',
      validation: 'Invalid input or configuration detected. Please verify your settings.',
      lock: 'Operation blocked by another process. Please wait and try again.',
      cli: 'Command execution failed. Please verify the command and its dependencies.',
      unknown: 'An unexpected error occurred. Please check the logs for more details.'
    };

    return messages[category] || originalMessage;
  }

  /**
   * Get suggestions based on error category
   */
  getSuggestions(category, _errorInfo) {
    const suggestions = {
      network: [
        'Check your internet connection',
        'Verify firewall settings',
        'Try again in a few moments',
        'Check if the service is accessible from a browser'
      ],
      filesystem: [
        'Check if the file or directory exists',
        'Verify you have read/write permissions',
        'Ensure sufficient disk space is available',
        'Try running with elevated permissions if necessary'
      ],
      configuration: [
        'Run "ccvm doctor --fix" to check and repair configuration',
        'Check if all required files exist',
        'Consider restoring from a backup using "ccvm history"',
        'Reinstall using the install script if issues persist'
      ],
      permission: [
        'Check file and directory permissions',
        'Ensure you own the configuration files',
        'Try running the command with appropriate permissions',
        'Verify the configuration directory is accessible'
      ],
      validation: [
        'Double-check your input values',
        'Verify configuration file syntax',
        'Use "ccvm doctor" to diagnose system issues',
        'Refer to documentation for correct format'
      ],
      lock: [
        'Wait for other operations to complete',
        'Check if another instance is running',
        'Remove stale lock files if safe to do so',
        'Restart your terminal if the issue persists'
      ],
      cli: [
        'Verify required dependencies are installed',
        'Check if Claude CLI is properly installed',
        'Update to the latest version',
        'Try reinstalling the affected components'
      ],
      unknown: [
        'Check the error log for more details',
        'Try running "ccvm doctor" for system diagnostics',
        'Report the issue if it persists',
        'Include the timestamp and log file when seeking support'
      ]
    };

    return suggestions[category] || suggestions.unknown;
  }

  /**
   * Get recent errors from log
   */
  async getRecentErrors(limit = 10) {
    try {
      if (!await fs.pathExists(this.logFile)) {
        return [];
      }

      const content = await fs.readFile(this.logFile, 'utf8');
      const errorBlocks = content.split('---\n').filter(block => block.trim());
      
      const errors = [];
      for (const block of errorBlocks.slice(-limit)) {
        try {
          const errorInfo = JSON.parse(block.trim());
          errors.push(errorInfo);
        } catch (parseError) {
          // Skip malformed entries
        }
      }

      return errors.reverse(); // Most recent first
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear error logs
   */
  async clearLogs() {
    try {
      await fs.remove(this.logFile);
      
      // Remove rotated logs too
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const rotatedLog = `${this.logFile}.${i}`;
        if (await fs.pathExists(rotatedLog)) {
          await fs.remove(rotatedLog);
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats() {
    try {
      const errors = await this.getRecentErrors(100);
      
      const stats = {
        total: errors.length,
        byCategory: {},
        byTimeRange: {
          lastHour: 0,
          lastDay: 0,
          lastWeek: 0
        },
        mostCommon: [],
        recentTrend: []
      };

      const now = Date.now();
      const messageCount = {};

      for (const error of errors) {
        const errorTime = new Date(error.timestamp).getTime();
        const category = this.categorizeError(error);
        
        // Count by category
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        
        // Count by time range
        const ageMs = now - errorTime;
        if (ageMs < 60 * 60 * 1000) {
          stats.byTimeRange.lastHour++;
        }
        if (ageMs < 24 * 60 * 60 * 1000) {
          stats.byTimeRange.lastDay++;
        }
        if (ageMs < 7 * 24 * 60 * 60 * 1000) {
          stats.byTimeRange.lastWeek++;
        }
        
        // Count message frequency
        const message = error.message;
        messageCount[message] = (messageCount[message] || 0) + 1;
      }

      // Most common errors
      stats.mostCommon = Object.entries(messageCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([message, count]) => ({ message, count }));

      return stats;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate error recovery options
   */
  async validateRecoveryOptions(errorInfo) {
    const { category } = this.formatError(errorInfo);
    const options = [];

    switch (category) {
      case 'configuration':
        options.push({
          name: 'Validate and fix configuration',
          command: 'ccvm doctor --fix',
          safe: true
        });
        options.push({
          name: 'Restore from backup',
          command: 'ccvm history',
          safe: true
        });
        break;

      case 'filesystem':
        options.push({
          name: 'Check system status',
          command: 'ccvm doctor',
          safe: true
        });
        break;

      case 'lock':
        options.push({
          name: 'Wait and retry',
          command: null,
          safe: true
        });
        break;

      default:
        options.push({
          name: 'Run system diagnostics',
          command: 'ccvm doctor',
          safe: true
        });
    }

    return options;
  }

  /**
   * 确定错误代码
   * 
   * @param {Error} error - 错误对象
   * @returns {string} 错误代码
   * @private
   */
  static #determineErrorCode(error) {
    if (error.code && ErrorHandler.#errorTypes[error.code]) {
      return ErrorHandler.#errorTypes[error.code];
    }
    
    if (error.code && errorCodes[error.code]) {
      return error.code;
    }
    
    // 根据错误消息推断错误类型
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (message.includes('permission') || message.includes('denied')) return 'PERMISSION_DENIED';
    if (message.includes('not found') || message.includes('no such file')) return 'FILE_NOT_FOUND';
    if (message.includes('network') || message.includes('connection')) return 'NETWORK_ERROR';
    if (message.includes('validation') || message.includes('invalid')) return 'VALIDATION_ERROR';
    if (message.includes('configuration') || message.includes('config')) return 'CONFIG_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 生成通用建议
   * 
   * @param {string} errorCode - 错误代码
   * @returns {string} 建议消息
   * @private
   */
  static #generateGenericSuggestion(errorCode) {
    const suggestions = {
      'FILE_NOT_FOUND': '请检查文件路径是否正确，或创建必要的文件。',
      'PERMISSION_DENIED': '请检查文件权限，或使用适当的权限运行程序。',
      'NETWORK_ERROR': '请检查网络连接，或稍后重试。',
      'TIMEOUT_ERROR': '操作超时，请增加超时时间或检查网络状况。',
      'VALIDATION_ERROR': '请检查输入数据是否符合要求。',
      'CONFIG_ERROR': '请检查配置文件格式和内容是否正确。',
      'UNKNOWN_ERROR': '发生未知错误，请查看详细错误信息并联系支持团队。'
    };
    
    return suggestions[errorCode] || '请检查错误详情并尝试相应解决方法。';
  }

  /**
   * 静态错误日志记录
   * 
   * @param {Object} handledError - 处理后的错误对象
   * @private
   */
  static #logErrorStatic(handledError) {
    const logMethod = handledError.severity === 'high' ? 'error' : 
                     handledError.severity === 'medium' ? 'warn' : 'info';
    
    Logger[logMethod](
      `${handledError.operation || 'Operation'} failed: ${handledError.message}`,
      {
        code: handledError.code,
        severity: handledError.severity,
        context: handledError.context,
        timestamp: handledError.timestamp
      }
    );

    // 在调试模式下记录完整错误堆栈
    if (process.env.DEBUG && handledError.originalError?.stack) {
      Logger.debug('Full error stack:', {
        stack: handledError.originalError.stack,
        operation: handledError.operation
      });
    }
  }
}

module.exports = ErrorHandler;