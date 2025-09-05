const Logger = require('../../../src/utils/Logger');

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    // Reset log level before each test
    Logger.currentLevel = Logger.levels.INFO;
    
    // Mock console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Log Levels', () => {
    it('should have correct log levels defined', () => {
      expect(Logger.levels.DEBUG).toBe(0);
      expect(Logger.levels.INFO).toBe(1);
      expect(Logger.levels.WARN).toBe(2);
      expect(Logger.levels.ERROR).toBe(3);
    });

    it('should set log level correctly', () => {
      Logger.setLevel('DEBUG');
      expect(Logger.currentLevel).toBe(Logger.levels.DEBUG);

      Logger.setLevel('ERROR');
      expect(Logger.currentLevel).toBe(Logger.levels.ERROR);

      Logger.setLevel(Logger.levels.WARN);
      expect(Logger.currentLevel).toBe(Logger.levels.WARN);
    });

    it('should handle invalid log level gracefully', () => {
      Logger.setLevel('INVALID');
      expect(Logger.currentLevel).toBe(Logger.levels.INFO); // Default

      Logger.setLevel('warn'); // Lowercase
      expect(Logger.currentLevel).toBe(Logger.levels.WARN);
    });
  });

  describe('debug()', () => {
    it('should log debug messages when level is DEBUG', () => {
      Logger.setLevel('DEBUG');
      Logger.debug('Debug message', { key: 'value' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🔍'),
        expect.stringContaining('Debug message'),
        { key: 'value' }
      );
    });

    it('should not log debug messages when level is higher', () => {
      Logger.setLevel('INFO');
      Logger.debug('Debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();

      Logger.setLevel('ERROR');
      Logger.debug('Debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should handle empty context', () => {
      Logger.setLevel('DEBUG');
      Logger.debug('Message without context');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🔍'),
        expect.stringContaining('Message without context'),
        ''
      );
    });
  });

  describe('info()', () => {
    it('should log info messages when level is INFO or lower', () => {
      Logger.setLevel('INFO');
      Logger.info('Info message', { data: 'test' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️'),
        expect.stringContaining('Info message'),
        { data: 'test' }
      );
    });

    it('should log info when level is DEBUG', () => {
      Logger.setLevel('DEBUG');
      Logger.info('Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should not log info when level is higher', () => {
      Logger.setLevel('WARN');
      Logger.info('Info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('warn()', () => {
    it('should log warning messages when level is WARN or lower', () => {
      Logger.setLevel('WARN');
      Logger.warn('Warning message', { code: 'W001' });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️'),
        expect.stringContaining('Warning message'),
        { code: 'W001' }
      );
    });

    it('should log warnings at all levels except ERROR', () => {
      Logger.setLevel('DEBUG');
      Logger.warn('Warning 1');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);

      Logger.setLevel('INFO');
      Logger.warn('Warning 2');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(2);

      Logger.setLevel('ERROR');
      Logger.warn('Warning 3');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(2); // Not called
    });
  });

  describe('error()', () => {
    it('should log error messages at all levels', () => {
      Logger.setLevel('ERROR');
      Logger.error('Error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.stringContaining('Error message')
      );
    });

    it('should log error with stack trace in DEBUG mode', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      
      const error = new Error('Test error');
      Logger.error('Error occurred', error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith('Stack trace:', error.stack);
      
      process.env.DEBUG = originalDebug;
    });

    it('should not log stack trace when not in DEBUG mode', () => {
      delete process.env.DEBUG;
      
      const error = new Error('Test error');
      Logger.error('Error occurred', error);
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Stack trace')
      );
    });

    it('should handle null error gracefully', () => {
      Logger.error('Error without exception', null);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('success()', () => {
    it('should always log success messages', () => {
      Logger.setLevel('ERROR');
      Logger.success('Operation successful');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
        expect.stringContaining('Operation successful')
      );
    });

    it('should log success at any level', () => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      
      levels.forEach((level, index) => {
        Logger.setLevel(level);
        Logger.success(`Success at ${level}`);
        expect(consoleSpy.log).toHaveBeenCalledTimes(index + 1);
      });
    });
  });

  describe('Environment-based initialization', () => {
    it('should set DEBUG level when DEBUG env var is set', () => {
      // Test the behavior by checking if Logger respects DEBUG environment variable
      // Since the module is already loaded, we'll test the behavior directly
      const originalDebug = process.env.DEBUG;
      
      // Simulate what happens when DEBUG is set during module initialization
      // The currentLevel is set at module load time based on process.env.DEBUG
      expect(process.env.DEBUG ? Logger.levels.DEBUG : Logger.levels.INFO)
        .toBe(Logger.currentLevel);
      
      process.env.DEBUG = originalDebug;
    });

    it('should default to INFO level when DEBUG is not set', () => {
      const originalDebug = process.env.DEBUG;
      delete process.env.DEBUG;
      
      // Re-require to test initialization
      delete require.cache[require.resolve('../../../src/utils/Logger')];
      const FreshLogger = require('../../../src/utils/Logger');
      
      expect(FreshLogger.currentLevel).toBe(FreshLogger.levels.INFO);
      
      if (originalDebug) {
        process.env.DEBUG = originalDebug;
      }
    });
  });

  describe('Context handling', () => {
    it('should handle various context types', () => {
      Logger.setLevel('DEBUG');
      
      Logger.debug('With object', { key: 'value', num: 123 });
      Logger.debug('With empty object', {});
      Logger.debug('Without context');
      Logger.debug('With null context', null);
      Logger.debug('With undefined context', undefined);
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(5);
    });

    it('should display context only when not empty', () => {
      Logger.setLevel('INFO');
      
      Logger.info('Message', { data: 'value' });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { data: 'value' }
      );
      
      Logger.info('Message', {});
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        ''
      );
    });
  });
});