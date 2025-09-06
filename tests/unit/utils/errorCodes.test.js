/**
 * Error Codes Unit Tests
 * 测试错误代码定义和相关功能
 */

const {
  ErrorSeverity,
  ErrorCategory,
  ErrorCodes,
  ErrorDefinitions,
  CCVMErrorCodes
} = require('../../../src/utils/errorCodes');

describe('ErrorSeverity', () => {
  it('should define all severity levels', () => {
    expect(ErrorSeverity.ERROR).toBe('error');
    expect(ErrorSeverity.WARNING).toBe('warning');
    expect(ErrorSeverity.INFO).toBe('info');
    expect(ErrorSeverity.DEBUG).toBe('debug');
  });

  it('should be immutable', () => {
    expect(() => {
      ErrorSeverity.ERROR = 'modified';
    }).toThrow();
  });

  it('should contain all expected severity levels', () => {
    const expected = ['ERROR', 'WARNING', 'INFO', 'DEBUG'];
    const actual = Object.keys(ErrorSeverity);
    
    expect(actual).toEqual(expect.arrayContaining(expected));
    expect(actual.length).toBe(expected.length);
  });
});

describe('ErrorCategory', () => {
  it('should define all error categories', () => {
    expect(ErrorCategory.CONFIGURATION).toBe('configuration');
    expect(ErrorCategory.PROVIDER).toBe('provider');
    expect(ErrorCategory.BACKUP).toBe('backup');
    expect(ErrorCategory.ALIAS).toBe('alias');
    expect(ErrorCategory.MCP).toBe('mcp');
    expect(ErrorCategory.FILESYSTEM).toBe('filesystem');
    expect(ErrorCategory.NETWORK).toBe('network');
    expect(ErrorCategory.VALIDATION).toBe('validation');
    expect(ErrorCategory.PERMISSION).toBe('permission');
    expect(ErrorCategory.LOCK).toBe('lock');
    expect(ErrorCategory.CLI).toBe('cli');
    expect(ErrorCategory.SYSTEM).toBe('system');
    expect(ErrorCategory.UNKNOWN).toBe('unknown');
  });

  it('should be immutable', () => {
    expect(() => {
      ErrorCategory.CONFIGURATION = 'modified';
    }).toThrow();
  });

  it('should contain all expected categories', () => {
    const expected = [
      'CONFIGURATION', 'PROVIDER', 'BACKUP', 'ALIAS', 'MCP',
      'FILESYSTEM', 'NETWORK', 'VALIDATION', 'PERMISSION',
      'LOCK', 'CLI', 'SYSTEM', 'UNKNOWN'
    ];
    const actual = Object.keys(ErrorCategory);
    
    expect(actual).toEqual(expect.arrayContaining(expected));
    expect(actual.length).toBeGreaterThanOrEqual(expected.length);
  });
});

describe('ErrorCodes', () => {
  it('should define configuration error codes', () => {
    expect(ErrorCodes.CONFIG_INIT_FAILED).toBeDefined();
    expect(ErrorCodes.CONFIG_LOCKED).toBeDefined();
    expect(ErrorCodes.CONFIG_FILE_READ_FAILED).toBeDefined();
  });

  it('should define provider error codes', () => {
    expect(ErrorCodes.PROVIDER_ADD_FAILED).toBeDefined();
    expect(ErrorCodes.PROVIDER_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.PROVIDER_ALREADY_EXISTS).toBeDefined();
    expect(ErrorCodes.PROVIDER_VALIDATION_FAILED).toBeDefined();
  });

  it('should define filesystem error codes', () => {
    expect(ErrorCodes.FILESYSTEM_PERMISSION_DENIED).toBeDefined();
    expect(ErrorCodes.FILESYSTEM_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.FILESYSTEM_FILE_WRITE_FAILED).toBeDefined();
  });

  it('should define network error codes', () => {
    expect(ErrorCodes.NETWORK_CONNECTION_FAILED).toBeDefined();
    expect(ErrorCodes.NETWORK_TIMEOUT).toBeDefined();
  });

  it('should define validation error codes', () => {
    expect(ErrorCodes.VALIDATION_INVALID_INPUT).toBeDefined();
    expect(ErrorCodes.VALIDATION_REQUIRED_FIELD_MISSING).toBeDefined();
  });

  it('should follow naming convention', () => {
    const codes = Object.keys(ErrorCodes);
    
    codes.forEach(code => {
      const value = ErrorCodes[code];
      expect(value).toMatch(/^CCVM_[A-Z_]+_[0-9]{3}$/);
    });
  });

  it('should have unique error codes', () => {
    const values = Object.values(ErrorCodes);
    const uniqueValues = new Set(values);
    
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('ErrorDefinitions', () => {
  it('should contain error definitions for defined codes', () => {
    expect(ErrorDefinitions[ErrorCodes.CONFIG_INIT_FAILED]).toBeDefined();
    expect(ErrorDefinitions[ErrorCodes.PROVIDER_NOT_FOUND]).toBeDefined();
    expect(ErrorDefinitions[ErrorCodes.FILESYSTEM_PERMISSION_DENIED]).toBeDefined();
  });

  it('should have proper structure for each error definition', () => {
    const definition = ErrorDefinitions[ErrorCodes.CONFIG_INIT_FAILED];
    
    expect(definition).toHaveProperty('code');
    expect(definition).toHaveProperty('message');
    expect(definition).toHaveProperty('severity');
    expect(definition).toHaveProperty('category');
    expect(definition).toHaveProperty('suggestions');
    expect(definition).toHaveProperty('retryable');
    
    expect(Array.isArray(definition.suggestions)).toBe(true);
    expect(typeof definition.retryable).toBe('boolean');
  });
});

describe('CCVMErrorCodes class', () => {
  describe('getErrorInfo', () => {
    it('should return error info for valid codes', () => {
      const errorInfo = CCVMErrorCodes.getErrorInfo(ErrorCodes.PROVIDER_NOT_FOUND);
      
      expect(errorInfo).toBeDefined();
      expect(errorInfo.code).toBe(ErrorCodes.PROVIDER_NOT_FOUND);
      expect(errorInfo.category).toBe(ErrorCategory.PROVIDER);
    });

    it('should return undefined for invalid codes', () => {
      const errorInfo = CCVMErrorCodes.getErrorInfo('INVALID_CODE');
      
      expect(errorInfo).toBeUndefined();
    });
  });

  describe('getErrorsByCategory', () => {
    it('should return errors for valid category', () => {
      const configErrors = CCVMErrorCodes.getErrorsByCategory(ErrorCategory.CONFIGURATION);
      
      expect(Array.isArray(configErrors)).toBe(true);
      expect(configErrors.length).toBeGreaterThan(0);
      expect(configErrors.every(e => e.category === ErrorCategory.CONFIGURATION)).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const errors = CCVMErrorCodes.getErrorsByCategory('INVALID_CATEGORY');
      
      expect(errors).toEqual([]);
    });
  });

  describe('isValidErrorCode', () => {
    it('should return true for valid error codes', () => {
      expect(CCVMErrorCodes.isValidErrorCode(ErrorCodes.CONFIG_INIT_FAILED)).toBe(true);
      expect(CCVMErrorCodes.isValidErrorCode(ErrorCodes.PROVIDER_NOT_FOUND)).toBe(true);
    });

    it('should return false for invalid error codes', () => {
      expect(CCVMErrorCodes.isValidErrorCode('INVALID_CODE')).toBe(false);
      expect(CCVMErrorCodes.isValidErrorCode('')).toBe(false);
      expect(CCVMErrorCodes.isValidErrorCode(null)).toBe(false);
      expect(CCVMErrorCodes.isValidErrorCode(undefined)).toBe(false);
    });
  });

  describe('getAllErrorCodes', () => {
    it('should return array of all error codes', () => {
      const allCodes = CCVMErrorCodes.getAllErrorCodes();
      
      expect(Array.isArray(allCodes)).toBe(true);
      expect(allCodes.length).toBeGreaterThan(0);
      expect(allCodes).toContain(ErrorCodes.CONFIG_INIT_FAILED);
      expect(allCodes).toContain(ErrorCodes.PROVIDER_NOT_FOUND);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for valid error codes', () => {
      const suggestions = CCVMErrorCodes.getSuggestions(ErrorCodes.CONFIG_INIT_FAILED);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid codes', () => {
      const suggestions = CCVMErrorCodes.getSuggestions('INVALID_CODE');
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('isRetryable', () => {
    it('should return boolean for valid error codes', () => {
      const retryable = CCVMErrorCodes.isRetryable(ErrorCodes.LOCK_ACQUIRE_FAILED);
      
      expect(typeof retryable).toBe('boolean');
    });

    it('should return false for invalid codes', () => {
      const retryable = CCVMErrorCodes.isRetryable('INVALID_CODE');
      
      expect(retryable).toBe(false);
    });
  });

  describe('formatErrorCode', () => {
    it('should format error code for display', () => {
      const formatted = CCVMErrorCodes.formatErrorCode(ErrorCodes.CONFIG_INIT_FAILED);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain(ErrorCodes.CONFIG_INIT_FAILED);
    });

    it('should handle any string input', () => {
      const formatted = CCVMErrorCodes.formatErrorCode('TEST_CODE');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
});

describe('error code consistency', () => {
  it('should maintain consistent naming conventions', () => {
    const codes = Object.values(ErrorCodes);
    
    codes.forEach(code => {
      expect(code).toMatch(/^CCVM_[A-Z][A-Z_0-9]*[A-Z0-9]$/);
    });
  });

  it('should have meaningful categories', () => {
    const definedErrors = Object.values(ErrorDefinitions);
    
    definedErrors.forEach(errorDef => {
      expect(Object.values(ErrorCategory)).toContain(errorDef.category);
    });
  });

  it('should have valid severity levels', () => {
    const definedErrors = Object.values(ErrorDefinitions);
    
    definedErrors.forEach(errorDef => {
      expect(Object.values(ErrorSeverity)).toContain(errorDef.severity);
    });
  });

  it('should have non-empty suggestions for errors', () => {
    const definedErrors = Object.values(ErrorDefinitions);
    
    definedErrors.forEach(errorDef => {
      expect(Array.isArray(errorDef.suggestions)).toBe(true);
      expect(errorDef.suggestions.length).toBeGreaterThan(0);
      errorDef.suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('integration tests', () => {
  it('should work with error code validation', () => {
    const validCode = ErrorCodes.PROVIDER_NOT_FOUND;
    
    expect(CCVMErrorCodes.isValidErrorCode(validCode)).toBe(true);
    
    const errorInfo = CCVMErrorCodes.getErrorInfo(validCode);
    expect(errorInfo).toBeDefined();
    expect(errorInfo.category).toBe(ErrorCategory.PROVIDER);
  });

  it('should provide consistent error metadata', () => {
    const providerErrors = CCVMErrorCodes.getErrorsByCategory(ErrorCategory.PROVIDER);
    
    expect(providerErrors.length).toBeGreaterThan(0);
    
    providerErrors.forEach(error => {
      expect(error.category).toBe(ErrorCategory.PROVIDER);
      expect(CCVMErrorCodes.isValidErrorCode(error.code)).toBe(true);
      expect(error.suggestions.length).toBeGreaterThan(0);
    });
  });

  it('should handle error formatting consistently', () => {
    const testCodes = [
      ErrorCodes.CONFIG_INIT_FAILED,
      ErrorCodes.PROVIDER_NOT_FOUND,
      ErrorCodes.FILESYSTEM_PERMISSION_DENIED,
      ErrorCodes.VALIDATION_INVALID_INPUT
    ];
    
    testCodes.forEach(code => {
      const formatted = CCVMErrorCodes.formatErrorCode(code);
      expect(formatted).toContain(code);
      
      const suggestions = CCVMErrorCodes.getSuggestions(code);
      expect(Array.isArray(suggestions)).toBe(true);
      
      const retryable = CCVMErrorCodes.isRetryable(code);
      expect(typeof retryable).toBe('boolean');
    });
  });
});