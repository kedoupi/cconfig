/**
 * CCVM Error Codes System
 * 
 * Standardized error codes for Claude Code Version Manager
 * Provides consistent error handling and improved debugging experience
 * 
 * @author CCVM Team
 * @version 1.0.0
 */

/**
 * Error severity levels
 * @readonly
 * @enum {string}
 */
const ErrorSeverity = {
  ERROR: 'error',      // Critical errors that stop operation
  WARNING: 'warning',  // Non-critical issues that allow continuation
  INFO: 'info',        // Informational messages
  DEBUG: 'debug'       // Debug information
};

/**
 * CCVM Error Categories
 * @readonly
 * @enum {string}
 */
const ErrorCategory = {
  CONFIGURATION: 'configuration',    // Configuration-related errors
  PROVIDER: 'provider',             // Provider management errors
  BACKUP: 'backup',                // Backup/restore errors
  ALIAS: 'alias',                  // Alias generation errors
  MCP: 'mcp',                      // MCP service errors
  FILESYSTEM: 'filesystem',        // File system errors
  NETWORK: 'network',              // Network-related errors
  VALIDATION: 'validation',        // Input validation errors
  PERMISSION: 'permission',        // Permission-related errors
  LOCK: 'lock',                    // File locking errors
  CLI: 'cli',                      // CLI command errors
  SYSTEM: 'system',                // System-level errors
  UNKNOWN: 'unknown'               // Uncategorized errors
};

/**
 * CCVM Error Codes
 * 
 * Format: CCVM_[CATEGORY]_[SPECIFIC_ERROR]
 * 
 * @readonly
 * @enum {string}
 */
const ErrorCodes = {
  // Configuration Errors (CCVM_CONFIG_*)
  CONFIG_INIT_FAILED: 'CCVM_CONFIG_001',
  CONFIG_LOCKED: 'CCVM_CONFIG_002',
  CONFIG_DIR_CREATE_FAILED: 'CCVM_CONFIG_003',
  CONFIG_FILE_WRITE_FAILED: 'CCVM_CONFIG_004',
  CONFIG_FILE_READ_FAILED: 'CCVM_CONFIG_005',
  CONFIG_FILE_CORRUPT: 'CCVM_CONFIG_006',
  CONFIG_RESET_FAILED: 'CCVM_CONFIG_007',
  CONFIG_BACKUP_FAILED: 'CCVM_CONFIG_008',
  
  // Provider Errors (CCVM_PROVIDER_*)
  PROVIDER_ADD_FAILED: 'CCVM_PROVIDER_001',
  PROVIDER_UPDATE_FAILED: 'CCVM_PROVIDER_002',
  PROVIDER_REMOVE_FAILED: 'CCVM_PROVIDER_003',
  PROVIDER_NOT_FOUND: 'CCVM_PROVIDER_004',
  PROVIDER_ALREADY_EXISTS: 'CCVM_PROVIDER_005',
  PROVIDER_VALIDATION_FAILED: 'CCVM_PROVIDER_006',
  PROVIDER_LIMIT_EXCEEDED: 'CCVM_PROVIDER_007',
  PROVIDER_FILE_WRITE_FAILED: 'CCVM_PROVIDER_008',
  PROVIDER_FILE_READ_FAILED: 'CCVM_PROVIDER_009',
  PROVIDER_ALIAS_INVALID: 'CCVM_PROVIDER_010',
  PROVIDER_URL_INVALID: 'CCVM_PROVIDER_011',
  PROVIDER_API_KEY_INVALID: 'CCVM_PROVIDER_012',
  PROVIDER_TIMEOUT_INVALID: 'CCVM_PROVIDER_013',
  PROVIDER_CONNECTIVITY_FAILED: 'CCVM_PROVIDER_014',
  PROVIDER_RESERVED_ALIAS: 'CCVM_PROVIDER_015',
  PROVIDER_LOCKED: 'CCVM_PROVIDER_016',
  
  // Backup Errors (CCVM_BACKUP_*)
  BACKUP_CREATE_FAILED: 'CCVM_BACKUP_001',
  BACKUP_RESTORE_FAILED: 'CCVM_BACKUP_002',
  BACKUP_NOT_FOUND: 'CCVM_BACKUP_003',
  BACKUP_DELETE_FAILED: 'CCVM_BACKUP_004',
  BACKUP_LIST_FAILED: 'CCVM_BACKUP_005',
  BACKUP_INTEGRITY_FAILED: 'CCVM_BACKUP_006',
  BACKUP_LOCKED: 'CCVM_BACKUP_007',
  BACKUP_DISK_SPACE_INSUFFICIENT: 'CCVM_BACKUP_008',
  BACKUP_CLEANUP_FAILED: 'CCVM_BACKUP_009',
  
  // Alias Errors (CCVM_ALIAS_*)
  ALIAS_GENERATE_FAILED: 'CCVM_ALIAS_001',
  ALIAS_FILE_CREATE_FAILED: 'CCVM_ALIAS_002',
  ALIAS_FILE_WRITE_FAILED: 'CCVM_ALIAS_003',
  ALIAS_VALIDATION_FAILED: 'CCVM_ALIAS_004',
  ALIAS_RESERVED_WORD: 'CCVM_ALIAS_005',
  ALIAS_TOO_LONG: 'CCVM_ALIAS_006',
  ALIAS_INVALID_CHARS: 'CCVM_ALIAS_007',
  ALIAS_SHELL_INJECTION: 'CCVM_ALIAS_008',
  ALIAS_LOCKED: 'CCVM_ALIAS_009',
  ALIAS_VERIFY_FAILED: 'CCVM_ALIAS_010',
  
  // MCP Errors (CCVM_MCP_*)
  MCP_SERVICE_NOT_FOUND: 'CCVM_MCP_001',
  MCP_INSTALL_FAILED: 'CCVM_MCP_002',
  MCP_CONFIG_INVALID: 'CCVM_MCP_003',
  MCP_SERVICE_START_FAILED: 'CCVM_MCP_004',
  MCP_SERVICE_STOP_FAILED: 'CCVM_MCP_005',
  MCP_REGISTRY_INVALID: 'CCVM_MCP_006',
  
  // File System Errors (CCVM_FILESYSTEM_*)
  FILESYSTEM_DIR_CREATE_FAILED: 'CCVM_FILESYSTEM_001',
  FILESYSTEM_FILE_CREATE_FAILED: 'CCVM_FILESYSTEM_002',
  FILESYSTEM_FILE_WRITE_FAILED: 'CCVM_FILESYSTEM_003',
  FILESYSTEM_FILE_READ_FAILED: 'CCVM_FILESYSTEM_004',
  FILESYSTEM_FILE_DELETE_FAILED: 'CCVM_FILESYSTEM_005',
  FILESYSTEM_PERMISSION_DENIED: 'CCVM_FILESYSTEM_006',
  FILESYSTEM_NOT_FOUND: 'CCVM_FILESYSTEM_007',
  FILESYSTEM_DISK_SPACE_INSUFFICIENT: 'CCVM_FILESYSTEM_008',
  
  // Network Errors (CCVM_NETWORK_*)
  NETWORK_CONNECTION_FAILED: 'CCVM_NETWORK_001',
  NETWORK_TIMEOUT: 'CCVM_NETWORK_002',
  NETWORK_DNS_RESOLVE_FAILED: 'CCVM_NETWORK_003',
  NETWORK_SSL_ERROR: 'CCVM_NETWORK_004',
  
  // Validation Errors (CCVM_VALIDATION_*)
  VALIDATION_INVALID_INPUT: 'CCVM_VALIDATION_001',
  VALIDATION_REQUIRED_FIELD_MISSING: 'CCVM_VALIDATION_002',
  VALIDATION_INVALID_FORMAT: 'CCVM_VALIDATION_003',
  VALIDATION_INVALID_LENGTH: 'CCVM_VALIDATION_004',
  VALIDATION_INVALID_RANGE: 'CCVM_VALIDATION_005',
  VALIDATION_PATTERN_MISMATCH: 'CCVM_VALIDATION_006',
  
  // Permission Errors (CCVM_PERMISSION_*)
  PERMISSION_FILE_ACCESS_DENIED: 'CCVM_PERMISSION_001',
  PERMISSION_DIR_ACCESS_DENIED: 'CCVM_PERMISSION_002',
  PERMISSION_INSUFFICIENT_PRIVILEGES: 'CCVM_PERMISSION_003',
  
  // Lock Errors (CCVM_LOCK_*)
  LOCK_ACQUIRE_FAILED: 'CCVM_LOCK_001',
  LOCK_RELEASE_FAILED: 'CCVM_LOCK_002',
  LOCK_FILE_CREATE_FAILED: 'CCVM_LOCK_003',
  LOCK_STALE_DETECTED: 'CCVM_LOCK_004',
  LOCK_CONFLICT: 'CCVM_LOCK_005',
  
  // CLI Errors (CCVM_CLI_*)
  CLI_COMMAND_NOT_FOUND: 'CCVM_CLI_001',
  CLI_INVALID_ARGUMENTS: 'CCVM_CLI_002',
  CLI_COMMAND_FAILED: 'CCVM_CLI_003',
  CLI_INTERACTIVE_FAILED: 'CCVM_CLI_004',
  
  // System Errors (CCVM_SYSTEM_*)
  SYSTEM_NODE_VERSION_INCOMPATIBLE: 'CCVM_SYSTEM_001',
  SYSTEM_MEMORY_INSUFFICIENT: 'CCVM_SYSTEM_002',
  SYSTEM_UNKNOWN_ERROR: 'CCVM_SYSTEM_003',
  
  // Generic Errors
  UNKNOWN_ERROR: 'CCVM_UNKNOWN_001',
  OPERATION_CANCELLED: 'CCVM_CANCELLED_001'
};

/**
 * Error Code Information
 * 
 * @typedef {Object} ErrorInfo
 * @property {string} code - Error code
 * @property {string} message - Human-readable error message
 * @property {ErrorSeverity} severity - Error severity level
 * @property {ErrorCategory} category - Error category
 * @property {string[]} suggestions - Suggested solutions
 * @property {boolean} retryable - Whether the operation can be retried
 */

/**
 * Error code definitions
 * @type {Object.<string, ErrorInfo>}
 */
const ErrorDefinitions = {
  [ErrorCodes.CONFIG_INIT_FAILED]: {
    code: ErrorCodes.CONFIG_INIT_FAILED,
    message: 'Configuration initialization failed',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.CONFIGURATION,
    suggestions: [
      'Check file permissions in ~/.claude/ccvm/',
      'Ensure sufficient disk space',
      'Try running "ccvm doctor --fix"'
    ],
    retryable: true
  },
  
  [ErrorCodes.CONFIG_LOCKED]: {
    code: ErrorCodes.CONFIG_LOCKED,
    message: 'Configuration is locked by another process',
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.CONFIGURATION,
    suggestions: [
      'Wait for other operations to complete',
      'Check for stuck processes',
      'Remove stale lock files if safe'
    ],
    retryable: true
  },
  
  [ErrorCodes.PROVIDER_NOT_FOUND]: {
    code: ErrorCodes.PROVIDER_NOT_FOUND,
    message: 'Provider not found',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.PROVIDER,
    suggestions: [
      'Check the provider alias spelling',
      'Use "ccvm list" to see available providers',
      'Add the provider if it doesn\'t exist'
    ],
    retryable: false
  },
  
  [ErrorCodes.PROVIDER_ALREADY_EXISTS]: {
    code: ErrorCodes.PROVIDER_ALREADY_EXISTS,
    message: 'Provider already exists',
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.PROVIDER,
    suggestions: [
      'Use "ccvm edit" to modify existing provider',
      'Use "ccvm remove" to delete and recreate',
      'Choose a different alias'
    ],
    retryable: false
  },
  
  [ErrorCodes.PROVIDER_VALIDATION_FAILED]: {
    code: ErrorCodes.PROVIDER_VALIDATION_FAILED,
    message: 'Provider validation failed',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
    suggestions: [
      'Check all required fields are provided',
      'Verify URL format is correct',
      'Ensure API key is valid and long enough'
    ],
    retryable: false
  },
  
  [ErrorCodes.FILESYSTEM_PERMISSION_DENIED]: {
    code: ErrorCodes.FILESYSTEM_PERMISSION_DENIED,
    message: 'Permission denied',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.PERMISSION,
    suggestions: [
      'Check file and directory permissions',
      'Ensure you own the configuration directory',
      'Try running with appropriate permissions'
    ],
    retryable: true
  },
  
  [ErrorCodes.LOCK_ACQUIRE_FAILED]: {
    code: ErrorCodes.LOCK_ACQUIRE_FAILED,
    message: 'Failed to acquire lock',
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.LOCK,
    suggestions: [
      'Wait for other operations to complete',
      'Check for stuck processes',
      'Try again in a few moments'
    ],
    retryable: true
  },
  
  [ErrorCodes.VALIDATION_INVALID_INPUT]: {
    code: ErrorCodes.VALIDATION_INVALID_INPUT,
    message: 'Invalid input provided',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
    suggestions: [
      'Check your input format',
      'Refer to documentation for correct format',
      'Use "ccvm doctor" for system diagnostics'
    ],
    retryable: false
  },
  
  [ErrorCodes.UNKNOWN_ERROR]: {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: 'An unknown error occurred',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.UNKNOWN,
    suggestions: [
      'Check the error logs for more details',
      'Try running "ccvm doctor"',
      'Report the issue if it persists'
    ],
    retryable: true
  }
};

/**
 * CCVM Error Codes System
 * 
 * Provides standardized error codes and handling for CCVM operations
 */
class CCVMErrorCodes {
  /**
   * Get error information by code
   * @param {string} code - Error code
   * @returns {ErrorInfo|undefined} Error information
   */
  static getErrorInfo(code) {
    return ErrorDefinitions[code];
  }
  
  /**
   * Get error information by category
   * @param {ErrorCategory} category - Error category
   * @returns {ErrorInfo[]} Array of error information
   */
  static getErrorsByCategory(category) {
    return Object.values(ErrorDefinitions).filter(error => error.category === category);
  }
  
  /**
   * Check if an error code exists
   * @param {string} code - Error code to check
   * @returns {boolean} True if error code exists
   */
  static isValidErrorCode(code) {
    return code in ErrorDefinitions;
  }
  
  /**
   * Get all error codes
   * @returns {string[]} Array of all error codes
   */
  static getAllErrorCodes() {
    return Object.keys(ErrorDefinitions);
  }
  
  /**
   * Get user-friendly suggestions for an error
   * @param {string} code - Error code
   * @returns {string[]} Array of suggestions
   */
  static getSuggestions(code) {
    const errorInfo = ErrorDefinitions[code];
    return errorInfo ? errorInfo.suggestions : [];
  }
  
  /**
   * Check if an error is retryable
   * @param {string} code - Error code
   * @returns {boolean} True if error is retryable
   */
  static isRetryable(code) {
    const errorInfo = ErrorDefinitions[code];
    return errorInfo ? errorInfo.retryable : false;
  }
  
  /**
   * Format error code for display
   * @param {string} code - Error code
   * @returns {string} Formatted error code
   */
  static formatErrorCode(code) {
    return `[${code}]`;
  }
}

module.exports = {
  CCVMErrorCodes,
  ErrorCodes,
  ErrorSeverity,
  ErrorCategory,
  ErrorDefinitions
};