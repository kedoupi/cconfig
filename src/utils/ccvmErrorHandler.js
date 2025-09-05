/**
 * CCVM Enhanced Error Handler
 * 
 * Enhanced error handling with standardized error codes, JSDoc support,
 * and improved debugging capabilities. Extends the existing ErrorHandler.
 * 
 * @author CCVM Team
 * @version 1.0.0
 */

const ErrorHandler = require('./errorHandler');
const { CCVMErrorCodes, ErrorCodes, ErrorSeverity, ErrorCategory } = require('./errorCodes');

/**
 * CCVM Enhanced Error
 * 
 * Custom error class with standardized error codes and enhanced metadata
 * 
 * @class
 * @extends Error
 */
class CCVMError extends Error {
  /**
   * Create a new CCVM Error
   * @param {string} message - Error message
   * @param {string} code - Error code from ErrorCodes
   * @param {ErrorCategory} category - Error category
   * @param {ErrorSeverity} severity - Error severity
   * @param {Object} context - Additional context information
   * @param {Error} originalError - Original error that caused this error
   */
  constructor(message, code = ErrorCodes.UNKNOWN_ERROR, category = ErrorCategory.UNKNOWN, severity = ErrorSeverity.ERROR, context = {}, originalError = null) {
    super(message);
    
    /**
     * Error name
     * @type {string}
     */
    this.name = 'CCVMError';
    
    /**
     * Standardized error code
     * @type {string}
     */
    this.code = code;
    
    /**
     * Error category
     * @type {ErrorCategory}
     */
    this.category = category;
    
    /**
     * Error severity level
     * @type {ErrorSeverity}
     */
    this.severity = severity;
    
    /**
     * Additional context information
     * @type {Object}
     */
    this.context = context || {};
    
    /**
     * Original error that caused this error
     * @type {Error|null}
     */
    this.originalError = originalError;
    
    /**
     * Timestamp when error was created
     * @type {string}
     */
    this.timestamp = new Date().toISOString();
    
    /**
     * Whether the operation can be retried
     * @type {boolean}
     */
    this.retryable = CCVMErrorCodes.isRetryable(code);
    
    /**
     * Suggestions for resolving the error
     * @type {string[]}
     */
    this.suggestions = CCVMErrorCodes.getSuggestions(code);
    
    // Maintain proper stack trace
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }
  
  /**
   * Convert error to JSON
   * @returns {Object} JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      suggestions: this.suggestions,
      stack: this.stack
    };
  }
  
  /**
   * Get user-friendly error message
   * @returns {string} User-friendly error message
   */
  getUserMessage() {
    const errorInfo = CCVMErrorCodes.getErrorInfo(this.code);
    const baseMessage = errorInfo ? errorInfo.message : this.message;
    return `${CCVMErrorCodes.formatErrorCode(this.code)} ${baseMessage}`;
  }
  
  /**
   * Get detailed error information for debugging
   * @returns {Object} Detailed error information
   */
  getDebugInfo() {
    return {
      ...this.toJSON(),
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack,
        code: this.originalError.code
      } : null
    };
  }
}

/**
 * CCVM Enhanced Error Handler
 * 
 * Enhanced error handling with standardized error codes and improved debugging
 * 
 * @class
 */
class CCVMErrorHandler extends ErrorHandler {
  /**
   * Create a new CCVM Enhanced Error Handler
   * @param {Object} options - Configuration options
   * @param {boolean} options.enableErrorCodes - Whether to use standardized error codes
   * @param {boolean} options.detailedLogging - Whether to enable detailed logging
   */
  constructor(options = {}) {
    super();
    
    /**
     * Configuration options
     * @type {Object}
     */
    this.options = {
      enableErrorCodes: true,
      detailedLogging: false,
      ...options
    };
  }
  
  /**
   * Create a standardized CCVM error
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error
   * @returns {CCVMError} Standardized CCVM error
   */
  createError(message, code = ErrorCodes.UNKNOWN_ERROR, context = {}, originalError = null) {
    const errorInfo = CCVMErrorCodes.getErrorInfo(code);
    const category = errorInfo ? errorInfo.category : ErrorCategory.UNKNOWN;
    const severity = errorInfo ? errorInfo.severity : ErrorSeverity.ERROR;
    
    return new CCVMError(message, code, category, severity, context, originalError);
  }
  
  /**
   * Handle and log errors with enhanced formatting
   * @param {Error|CCVMError} error - Error to handle
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Formatted error information
   */
  async handleError(error, context = {}) {
    // Convert to CCVMError if it's not already
    let ccvmError = error;
    if (!(error instanceof CCVMError)) {
      if (this.options.enableErrorCodes) {
        // Try to map to appropriate error code based on error message
        const errorCode = this.mapErrorToCode(error);
        ccvmError = this.createError(error.message, errorCode, context, error);
      } else {
        // Use original error for backward compatibility
        ccvmError = error;
      }
    }
    
    // Add additional context
    ccvmError.context = { ...ccvmError.context, ...context };
    
    // Log using the existing ErrorHandler
    if (this.options.enableErrorCodes) {
      const logResult = await super.handleError(ccvmError, ccvmError.context);
      
      // Enhance the result with CCVM-specific information
      return {
        ...logResult,
        code: ccvmError.code,
        category: ccvmError.category,
        severity: ccvmError.severity,
        retryable: ccvmError.retryable,
        suggestions: ccvmError.suggestions,
        userMessage: ccvmError.getUserMessage(),
        debugInfo: this.options.detailedLogging ? ccvmError.getDebugInfo() : null
      };
    } else {
      // Use original ErrorHandler for backward compatibility
      return super.handleError(error, context);
    }
  }
  
  /**
   * Map standard errors to CCVM error codes
   * @param {Error} error - Original error
   * @returns {string} Corresponding CCVM error code
   */
  mapErrorToCode(error) {
    const message = error.message.toLowerCase();
    const code = error.code;
    
    // Map based on error codes
    if (code === 'ENOENT') {
      return ErrorCodes.FILESYSTEM_NOT_FOUND;
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return ErrorCodes.FILESYSTEM_PERMISSION_DENIED;
    }
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return ErrorCodes.NETWORK_CONNECTION_FAILED;
    }
    
    // Map based on error message content
    if (message.includes('configuration') || message.includes('config')) {
      return ErrorCodes.CONFIG_INIT_FAILED;
    }
    if (message.includes('provider') && message.includes('not found')) {
      return ErrorCodes.PROVIDER_NOT_FOUND;
    }
    if (message.includes('provider') && message.includes('already exists')) {
      return ErrorCodes.PROVIDER_ALREADY_EXISTS;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCodes.VALIDATION_INVALID_INPUT;
    }
    if (message.includes('permission') || message.includes('denied')) {
      return ErrorCodes.FILESYSTEM_PERMISSION_DENIED;
    }
    if (message.includes('lock') || message.includes('locked')) {
      return ErrorCodes.LOCK_ACQUIRE_FAILED;
    }
    if (message.includes('alias') && message.includes('reserved')) {
      return ErrorCodes.PROVIDER_RESERVED_ALIAS;
    }
    if (message.includes('alias') && (message.includes('invalid') || message.includes('too long'))) {
      return ErrorCodes.PROVIDER_ALIAS_INVALID;
    }
    if (message.includes('backup') && message.includes('failed')) {
      return ErrorCodes.BACKUP_CREATE_FAILED;
    }
    
    // Default to unknown error
    return ErrorCodes.UNKNOWN_ERROR;
  }
  
  /**
   * Create a configuration error
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error
   * @returns {CCVMError} Configuration error
   */
  createConfigurationError(message, context = {}, originalError = null) {
    return this.createError(message, ErrorCodes.CONFIG_INIT_FAILED, context, originalError);
  }
  
  /**
   * Create a provider error
   * @param {string} message - Error message
   * @param {string} code - Specific provider error code
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error
   * @returns {CCVMError} Provider error
   */
  createProviderError(message, code = ErrorCodes.PROVIDER_ADD_FAILED, context = {}, originalError = null) {
    return this.createError(message, code, context, originalError);
  }
  
  /**
   * Create a file system error
   * @param {string} message - Error message
   * @param {string} code - Specific filesystem error code
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error
   * @returns {CCVMError} File system error
   */
  createFileSystemError(message, code = ErrorCodes.FILESYSTEM_FILE_WRITE_FAILED, context = {}, originalError = null) {
    return this.createError(message, code, context, originalError);
  }
  
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error
   * @returns {CCVMError} Validation error
   */
  createValidationError(message, context = {}, originalError = null) {
    return this.createError(message, ErrorCodes.VALIDATION_INVALID_INPUT, context, originalError);
  }
  
  /**
   * Get error statistics with enhanced information
   * @returns {Promise<Object>} Enhanced error statistics
   */
  async getEnhancedErrorStats() {
    const basicStats = await this.getErrorStats();
    
    if (!basicStats) {
      return null;
    }
    
    // Enhance with error code information
    const enhancedStats = {
      ...basicStats,
      byErrorCode: {},
      bySeverity: {},
      byRetryable: {
        retryable: 0,
        nonRetryable: 0
      },
      topSuggestions: []
    };
    
    // Process recent errors to gather enhanced statistics
    const recentErrors = await this.getRecentErrors(100);
    
    for (const error of recentErrors) {
      // Try to map to CCVM error code
      const errorCode = this.mapErrorToCode(error);
      const errorInfo = CCVMErrorCodes.getErrorInfo(errorCode);
      
      if (errorInfo) {
        // Count by error code
        enhancedStats.byErrorCode[errorCode] = (enhancedStats.byErrorCode[errorCode] || 0) + 1;
        
        // Count by severity
        const severity = errorInfo.severity;
        enhancedStats.bySeverity[severity] = (enhancedStats.bySeverity[severity] || 0) + 1;
        
        // Count by retryable
        if (errorInfo.retryable) {
          enhancedStats.byRetryable.retryable++;
        } else {
          enhancedStats.byRetryable.nonRetryable++;
        }
        
        // Collect suggestions
        for (const suggestion of errorInfo.suggestions) {
          const existing = enhancedStats.topSuggestions.find(s => s.suggestion === suggestion);
          if (existing) {
            existing.count++;
          } else {
            enhancedStats.topSuggestions.push({ suggestion, count: 1 });
          }
        }
      }
    }
    
    // Sort suggestions by frequency
    enhancedStats.topSuggestions.sort((a, b) => b.count - a.count);
    enhancedStats.topSuggestions = enhancedStats.topSuggestions.slice(0, 10);
    
    return enhancedStats;
  }
  
  /**
   * Validate error recovery options with enhanced logic
   * @param {CCVMError} error - CCVM error
   * @returns {Promise<Array>} Recovery options
   */
  async validateEnhancedRecoveryOptions(error) {
    const basicOptions = await this.validateRecoveryOptions(error);
    
    // Add CCVM-specific recovery options
    const ccvmOptions = [];
    
    switch (error.code) {
      case ErrorCodes.CONFIG_INIT_FAILED:
        ccvmOptions.push({
          name: 'Check configuration directory permissions',
          command: 'ls -la ~/.claude/ccvm/',
          safe: true
        });
        break;
        
      case ErrorCodes.PROVIDER_VALIDATION_FAILED:
        ccvmOptions.push({
          name: 'Validate provider configuration manually',
          command: `ccvm show ${error.context.providerAlias || '<alias>'}`,
          safe: true
        });
        break;
        
      case ErrorCodes.FILESYSTEM_PERMISSION_DENIED:
        ccvmOptions.push({
          name: 'Check and fix permissions',
          command: 'chmod -R 755 ~/.claude/ccvm/',
          safe: true
        });
        break;
    }
    
    return [...basicOptions, ...ccvmOptions];
  }
}

module.exports = {
  CCVMErrorHandler,
  CCVMError,
  CCVMErrorCodes,
  ErrorCodes,
  ErrorSeverity,
  ErrorCategory
};