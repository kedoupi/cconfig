const ErrorHandler = require('../../lib/error-handler');

describe('ErrorHandler', () => {
  let consoleSpy;
  let exitSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('validateRequired', () => {
    it('should pass for valid parameter', () => {
      expect(() => {
        ErrorHandler.validateRequired('test', 'name');
      }).not.toThrow();
    });

    it('should throw for missing parameter', () => {
      expect(() => {
        ErrorHandler.validateRequired(null, 'name');
      }).toThrow('参数 name 是必需的');
    });

    it('should throw for empty parameter', () => {
      expect(() => {
        ErrorHandler.validateRequired('', 'name');
      }).toThrow('参数 name 是必需的');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = ErrorHandler.safeJsonParse('{"key": "value"}', 'test');
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw for invalid JSON', () => {
      expect(() => {
        ErrorHandler.safeJsonParse('{invalid json}', 'test');
      }).toThrow('解析 test 失败:');
    });
  });

  describe('handleError', () => {
    it('should handle ENOENT error', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';

      ErrorHandler.handleError(error, '测试操作');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('文件或目录不存在'));
    });

    it('should handle EACCES error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      ErrorHandler.handleError(error, '测试操作');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('权限不足'));
    });

    it('should handle JSON errors', () => {
      const error = new Error('Invalid JSON format');

      ErrorHandler.handleError(error, '测试操作');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JSON 格式错误'));
    });
  });
});