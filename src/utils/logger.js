/**
 * Unified Logger Utility
 * 
 * Provides structured logging with levels, filtering, and consistent formatting
 * to replace scattered console.warn calls throughout the codebase.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logFile = options.logFile || path.join(os.homedir(), '.claude', 'ccvm', 'debug.log');
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m', // Gray
      reset: '\x1b[0m'
    };
  }

  /**
   * Check if a log level should be output
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Format log message with timestamp and level
   */
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    
    let formattedMessage = `[${timestamp}] ${levelUpper} ${message}`;
    
    if (Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context)}`;
    }
    
    return formattedMessage;
  }

  /**
   * Format message for console output with colors
   */
  formatConsoleMessage(level, message, context = {}) {
    const color = this.colors[level] || '';
    const reset = this.colors.reset;
    const levelUpper = level.toUpperCase();
    
    let formattedMessage = `${color}[${levelUpper}]${reset} ${message}`;
    
    if (Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context, null, 2)}`;
    }
    
    return formattedMessage;
  }

  /**
   * Write log entry to file if enabled
   */
  async writeToFile(formattedMessage) {
    if (!this.enableFile) {return;}

    try {
      await fs.ensureDir(path.dirname(this.logFile));
      
      // Check file size and rotate if needed
      if (await fs.pathExists(this.logFile)) {
        const stats = await fs.stat(this.logFile);
        if (stats.size > this.maxFileSize) {
          await fs.move(this.logFile, `${this.logFile}.old`);
        }
      }
      
      await fs.appendFile(this.logFile, formattedMessage + '\n');
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Logger: Failed to write to file:', error.message);
    }
  }

  /**
   * Core logging method
   */
  async log(level, message, context = {}) {
    if (!this.shouldLog(level)) {return;}

    const fileMessage = this.formatMessage(level, message, context);
    const consoleMessage = this.formatConsoleMessage(level, message, context);

    // Write to file if enabled
    if (this.enableFile) {
      await this.writeToFile(fileMessage);
    }

    // Output to console if enabled
    if (this.enableConsole) {
      if (level === 'error') {
        console.error(consoleMessage);
      } else if (level === 'warn') {
        console.warn(consoleMessage);
      } else {
        console.log(consoleMessage);
      }
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async error(message, context = {}) {
    await this.log('error', message, context);
  }

  async warn(message, context = {}) {
    await this.log('warn', message, context);
  }

  async info(message, context = {}) {
    await this.log('info', message, context);
  }

  async debug(message, context = {}) {
    await this.log('debug', message, context);
  }

  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    const childLogger = new Logger({
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logFile: this.logFile,
      maxFileSize: this.maxFileSize
    });

    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = async (level, message, additionalContext = {}) => {
      const mergedContext = { ...context, ...additionalContext };
      return originalLog(level, message, mergedContext);
    };

    return childLogger;
  }

  /**
   * Enable or disable console output
   */
  setConsoleEnabled(enabled) {
    this.enableConsole = enabled;
  }

  /**
   * Enable or disable file logging
   */
  setFileEnabled(enabled) {
    this.enableFile = enabled;
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    } else {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${Object.keys(this.levels).join(', ')}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logFile: this.logFile,
      maxFileSize: this.maxFileSize
    };
  }

  /**
   * Clean up log files
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.logFile)) {
        await fs.remove(this.logFile);
      }
      if (await fs.pathExists(`${this.logFile}.old`)) {
        await fs.remove(`${this.logFile}.old`);
      }
      return true;
    } catch (error) {
      await this.error('Failed to cleanup log files', { error: error.message });
      return false;
    }
  }
}

// Create a default logger instance
const defaultLogger = new Logger({
  level: process.env.NODE_ENV === 'test' ? 'error' : 'warn',
  enableConsole: process.env.NODE_ENV !== 'test',
  enableFile: process.env.LOG_TO_FILE === 'true'
});

// Export both the class and a default instance
module.exports = Logger;
module.exports.logger = defaultLogger;

// Convenience exports for direct usage
module.exports.error = defaultLogger.error.bind(defaultLogger);
module.exports.warn = defaultLogger.warn.bind(defaultLogger);
module.exports.info = defaultLogger.info.bind(defaultLogger);
module.exports.debug = defaultLogger.debug.bind(defaultLogger);