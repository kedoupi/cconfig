const Validator = require('../../../src/utils/Validator');

describe('Validator', () => {
  describe('isValidAlias', () => {
    it('should accept valid aliases', () => {
      expect(Validator.isValidAlias('test')).toBe(true);
      expect(Validator.isValidAlias('test-123')).toBe(true);
      expect(Validator.isValidAlias('test_123')).toBe(true);
      expect(Validator.isValidAlias('Test123')).toBe(true);
      expect(Validator.isValidAlias('a')).toBe(true);
    });

    it('should reject invalid aliases', () => {
      expect(Validator.isValidAlias('')).toBe(false);
      expect(Validator.isValidAlias(null)).toBe(false);
      expect(Validator.isValidAlias(undefined)).toBe(false);
      expect(Validator.isValidAlias(123)).toBe(false);
      expect(Validator.isValidAlias('test/alias')).toBe(false);
      expect(Validator.isValidAlias('test\\alias')).toBe(false);
      expect(Validator.isValidAlias('../test')).toBe(false);
      expect(Validator.isValidAlias('test alias')).toBe(false);
      expect(Validator.isValidAlias('test@alias')).toBe(false);
      expect(Validator.isValidAlias('a'.repeat(33))).toBe(false); // Too long
    });

    it('should reject path traversal attempts', () => {
      expect(Validator.isValidAlias('..')).toBe(false);
      expect(Validator.isValidAlias('test/../etc')).toBe(false);
      expect(Validator.isValidAlias('test/../../')).toBe(false);
    });
  });

  describe('validateURL', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = Validator.validateURL('https://api.example.com');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://api.example.com/');
    });

    it('should accept valid HTTP URLs for localhost', () => {
      const result = Validator.validateURL('http://localhost:3000');
      expect(result.valid).toBe(true);
    });

    it('should accept HTTP for private networks', () => {
      expect(Validator.validateURL('http://192.168.1.1').valid).toBe(true);
      expect(Validator.validateURL('http://10.0.0.1').valid).toBe(true);
      expect(Validator.validateURL('http://172.16.0.1').valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(Validator.validateURL('not-a-url').valid).toBe(false);
      expect(Validator.validateURL('').valid).toBe(false);
      expect(Validator.validateURL('ftp://example.com').valid).toBe(false);
      expect(Validator.validateURL('javascript:alert(1)').valid).toBe(false);
    });

    it('should handle URL validation options', () => {
      const result = Validator.validateURL('http://example.com', { allowHTTP: true });
      expect(result.valid).toBe(true);
      
      const result2 = Validator.validateURL('http://localhost', { allowLocalhost: false });
      expect(result2.valid).toBe(false);
    });

    it('should allow HTTP in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const result = Validator.validateURL('http://api.example.com');
      expect(result.valid).toBe(true);
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API keys', () => {
      expect(Validator.validateApiKey('sk-proj-1234567890').valid).toBe(true);
      expect(Validator.validateApiKey('a'.repeat(100)).valid).toBe(true);
    });

    it('should reject invalid API keys', () => {
      expect(Validator.validateApiKey('').valid).toBe(false);
      expect(Validator.validateApiKey(null).valid).toBe(false);
      expect(Validator.validateApiKey(123).valid).toBe(false);
      expect(Validator.validateApiKey('short').valid).toBe(false); // Too short
      expect(Validator.validateApiKey('a'.repeat(513)).valid).toBe(false); // Too long
      expect(Validator.validateApiKey('key with spaces').valid).toBe(false);
    });

    it('should warn about weak patterns', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      Validator.validateApiKey('test-api-key-123');
      Validator.validateApiKey('demo-key-456');
      Validator.validateApiKey('example123456');
      
      consoleSpy.mockRestore();
    });
  });

  describe('isPathSafe', () => {
    it('should validate safe paths', () => {
      expect(Validator.isPathSafe('/home/user/file.txt', '/home/user')).toBe(true);
      expect(Validator.isPathSafe('/home/user/subdir/file.txt', '/home/user')).toBe(true);
    });

    it('should reject unsafe paths', () => {
      expect(Validator.isPathSafe('/etc/passwd', '/home/user')).toBe(false);
      expect(Validator.isPathSafe('../../../etc/passwd', '/home/user')).toBe(false);
      expect(Validator.isPathSafe('/home/other/file.txt', '/home/user')).toBe(false);
    });

    it('should handle invalid paths gracefully', () => {
      expect(Validator.isPathSafe(null, '/home/user')).toBe(false);
      expect(Validator.isPathSafe('/home/user/file.txt', null)).toBe(false);
    });
  });

  describe('validateJSON', () => {
    it('should validate correct JSON', () => {
      const result = Validator.validateJSON('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should reject invalid JSON', () => {
      const result = Validator.validateJSON('{invalid json}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle edge cases', () => {
      expect(Validator.validateJSON('null').valid).toBe(true);
      expect(Validator.validateJSON('true').valid).toBe(true);
      expect(Validator.validateJSON('123').valid).toBe(true);
      expect(Validator.validateJSON('"string"').valid).toBe(true);
    });
  });

  describe('validateTimeout', () => {
    it('should accept valid timeouts', () => {
      expect(Validator.validateTimeout(5000).valid).toBe(true);
      expect(Validator.validateTimeout('5000').valid).toBe(true);
      expect(Validator.validateTimeout(600000).valid).toBe(true);
    });

    it('should reject invalid timeouts', () => {
      expect(Validator.validateTimeout('not-a-number').valid).toBe(false);
      expect(Validator.validateTimeout(500).valid).toBe(false); // Too small
      expect(Validator.validateTimeout(700000).valid).toBe(false); // Too large
      expect(Validator.validateTimeout(null).valid).toBe(false);
    });

    it('should return parsed value', () => {
      const result = Validator.validateTimeout('5000');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5000);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize user input', () => {
      expect(Validator.sanitizeInput('normal text')).toBe('normal text');
      expect(Validator.sanitizeInput('text\x00with\x1Fcontrol')).toBe('textwithcontrol');
      expect(Validator.sanitizeInput('text;with|dangerous&chars')).toBe('textwithdangerouschars');
      expect(Validator.sanitizeInput('  spaces  ')).toBe('spaces');
    });

    it('should handle edge cases', () => {
      expect(Validator.sanitizeInput(null)).toBe('');
      expect(Validator.sanitizeInput(undefined)).toBe('');
      expect(Validator.sanitizeInput(123)).toBe('');
      expect(Validator.sanitizeInput('')).toBe('');
    });

    it('should limit input length', () => {
      const longInput = 'a'.repeat(2000);
      const result = Validator.sanitizeInput(longInput);
      expect(result.length).toBe(1024);
    });

    it('should remove command injection attempts', () => {
      expect(Validator.sanitizeInput('text; rm -rf /')).toBe('text rm -rf /');
      expect(Validator.sanitizeInput('$(whoami)')).toBe('whoami');
      expect(Validator.sanitizeInput('`ls -la`')).toBe('ls -la');
      expect(Validator.sanitizeInput('text && malicious')).toBe('text  malicious');
    });
  });

  describe('validateConfig', () => {
    const schema = {
      required: ['name', 'version'],
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        port: { type: 'number', min: 1, max: 65535 },
        url: { type: 'string', format: 'url' },
        alias: { type: 'string', format: 'alias' }
      }
    };

    it('should validate correct config', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        port: 3000,
        url: 'https://example.com',
        alias: 'test-alias'
      };
      const result = Validator.validateConfig(config, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const config = { name: 'test' };
      const result = Validator.validateConfig(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
    });

    it('should validate field types', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        port: '3000' // Wrong type
      };
      const result = Validator.validateConfig(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be of type number');
    });

    it('should validate field formats', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        url: 'not-a-url',
        alias: 'invalid/alias'
      };
      const result = Validator.validateConfig(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate range constraints', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        port: 70000
      };
      const result = Validator.validateConfig(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be at most 65535');
    });

    it('should handle unknown format types gracefully', () => {
      const customSchema = {
        properties: {
          field: { type: 'string', format: 'unknown-format' }
        }
      };
      const config = { field: 'value' };
      const result = Validator.validateConfig(config, customSchema);
      expect(result.valid).toBe(true);
    });

    it('should handle empty schema', () => {
      const result = Validator.validateConfig({}, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});