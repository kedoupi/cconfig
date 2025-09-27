const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const config = require('../../lib/config');

describe('Config Module', () => {
  describe('validateAlias', () => {
    test('should accept valid aliases', () => {
      expect(() => config.validateAlias('test')).not.toThrow();
      expect(() => config.validateAlias('test-123')).not.toThrow();
      expect(() => config.validateAlias('test_456')).not.toThrow();
      expect(() => config.validateAlias('Test_123-ABC')).not.toThrow();
    });

    test('should reject invalid aliases', () => {
      expect(() => config.validateAlias('')).toThrow('别名仅允许字母、数字、下划线、短横线，且长度<=64');
      expect(() => config.validateAlias('test.com')).toThrow();
      expect(() => config.validateAlias('test space')).toThrow();
      expect(() => config.validateAlias('test@email')).toThrow();
      expect(() => config.validateAlias('a'.repeat(65))).toThrow();
    });

    test('should reject null or undefined', () => {
      expect(() => config.validateAlias(null)).toThrow();
      expect(() => config.validateAlias(undefined)).toThrow();
    });
  });

  describe('validateApiUrlSecure', () => {
    test('should accept valid HTTP/HTTPS URLs', () => {
      expect(config.validateApiUrlSecure('https://api.anthropic.com')).toBe(true);
      expect(config.validateApiUrlSecure('http://localhost:8080')).toBe(true);
      expect(config.validateApiUrlSecure('https://example.com/api/v1')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(config.validateApiUrlSecure('not-a-url')).toBe('请输入有效的 URL 格式');
      expect(config.validateApiUrlSecure('ftp://example.com')).toBe('请输入有效的 HTTP 或 HTTPS URL');
      expect(config.validateApiUrlSecure('file:///etc/passwd')).toBe('请输入有效的 HTTP 或 HTTPS URL');
    });
  });

  describe('formatRelativeTime', () => {
    test('should format recent times correctly', () => {
      const now = new Date();

      // 刚刚
      expect(config.formatRelativeTime(now.toISOString())).toBe('刚刚');

      // 分钟前
      const minutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(config.formatRelativeTime(minutesAgo.toISOString())).toBe('5 分钟前');

      // 小时前
      const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(config.formatRelativeTime(hoursAgo.toISOString())).toBe('2 小时前');

      // 天前
      const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(config.formatRelativeTime(daysAgo.toISOString())).toBe('3 天前');
    });

    test('should handle invalid dates', () => {
      expect(config.formatRelativeTime('invalid-date')).toBe('-');
      expect(config.formatRelativeTime('')).toBe('-');
      expect(config.formatRelativeTime(null)).toBe('-');
    });

    test('should format old dates as locale string', () => {
      const oldDate = new Date('2020-01-01');
      const result = config.formatRelativeTime(oldDate.toISOString());
      expect(result).toContain('2020');
    });
  });

  describe('truncateMiddle', () => {
    test('should not truncate short strings', () => {
      expect(config.truncateMiddle('short', 10)).toBe('short');
      expect(config.truncateMiddle('exact', 5)).toBe('exact');
    });

    test('should truncate long strings correctly', () => {
      expect(config.truncateMiddle('very-long-string-that-needs-truncation', 20))
        .toBe('very-lon...runcation');

      expect(config.truncateMiddle('abcdefghijk', 8))
        .toBe('ab...ijk');
    });

    test('should handle edge cases', () => {
      expect(config.truncateMiddle('test', 3)).toBe('tes');
      expect(config.truncateMiddle('test', 2)).toBe('te');
      expect(config.truncateMiddle('', 5)).toBe('');
      expect(config.truncateMiddle(null, 5)).toBe('');
      expect(config.truncateMiddle(undefined, 5)).toBe('');
    });
  });

  describe('isWindows', () => {
    test('should return boolean', () => {
      expect(typeof config.isWindows()).toBe('boolean');
    });
  });

  describe('getProviderFile', () => {
    test('should return correct file path for valid alias', () => {
      const result = config.getProviderFile('test');
      expect(result).toContain('test.json');
      expect(result).toContain(config.PROVIDERS_DIR);
    });

    test('should throw error for invalid alias', () => {
      expect(() => config.getProviderFile('invalid.alias')).toThrow();
      expect(() => config.getProviderFile('../../../etc/passwd')).toThrow();
    });

    test('should prevent path traversal', () => {
      expect(() => config.getProviderFile('../../secrets')).toThrow('别名仅允许字母、数字、下划线、短横线，且长度<=64');
    });
  });

  describe('constants', () => {
    test('should have correct directory paths', () => {
      const expectedBase = process.env.CCONFIG_HOME || path.join(os.homedir(), '.cconfig');
      expect(config.CONFIG_DIR).toBe(expectedBase);
      expect(config.PROVIDERS_DIR).toBe(path.join(expectedBase, 'providers'));
      expect(config.CONFIG_FILE).toBe(path.join(expectedBase, 'config.json'));
      expect(config.LEGACY_CONFIG_DIR).toBe(path.join(os.homedir(), '.claude', 'cconfig'));
    });
  });
});
