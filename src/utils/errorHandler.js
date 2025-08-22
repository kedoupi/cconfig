/**
 * Error Handler Utility
 * 
 * Provides comprehensive error handling, logging, and recovery mechanisms
 * for Claude Code Kit operations.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ErrorHandler {
  constructor() {
    this.logFile = path.join(os.homedir(), '.cc-config', 'error.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 3;
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
      console.error('Original error:', errorInfo);
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
        'Run "cc-config validate --fix" to check and repair configuration',
        'Check if all required files exist',
        'Consider restoring from a backup using "cc-config history"',
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
        'Use "cc-config doctor" to diagnose system issues',
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
        'Try running "cc-config doctor" for system diagnostics',
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
          command: 'cc-config validate --fix',
          safe: true
        });
        options.push({
          name: 'Restore from backup',
          command: 'cc-config history',
          safe: true
        });
        break;

      case 'filesystem':
        options.push({
          name: 'Check system status',
          command: 'cc-config doctor',
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
          command: 'cc-config doctor',
          safe: true
        });
    }

    return options;
  }
}

module.exports = ErrorHandler;