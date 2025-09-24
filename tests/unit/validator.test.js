const Validator = require('../../lib/validator');

describe('Validator - 简化版', () => {
  describe('validateProvider', () => {
    it('should pass for valid provider', () => {
      const validProvider = {
        alias: 'test',
        apiUrl: 'https://api.example.com',
        apiKey: 'sk-test123'
      };

      expect(() => {
        Validator.validateProvider(validProvider);
      }).not.toThrow();
    });

    it('should throw for missing apiUrl', () => {
      const invalidProvider = {
        alias: 'test',
        apiKey: 'sk-test123'
        // missing apiUrl
      };

      expect(() => {
        Validator.validateProvider(invalidProvider);
      }).toThrow('API URL 不能为空');
    });

    it('should throw for empty alias', () => {
      const invalidProvider = {
        alias: '',
        apiUrl: 'https://api.example.com',
        apiKey: 'sk-test123'
      };

      expect(() => {
        Validator.validateProvider(invalidProvider);
      }).toThrow('Provider 别名不能为空');
    });

    it('should throw for missing apiKey', () => {
      const invalidProvider = {
        alias: 'test',
        apiUrl: 'https://api.example.com'
        // missing apiKey
      };

      expect(() => {
        Validator.validateProvider(invalidProvider);
      }).toThrow('API Key 不能为空');
    });
  });
});