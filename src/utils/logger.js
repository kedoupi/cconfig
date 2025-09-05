/**
 * 统一的日志管理器
 * 提供一致的日志格式和级别控制，支持彩色输出和上下文信息
 * 
 * @class
 * @example
 * const Logger = require('./Logger');
 * 
 * // 设置日志级别
 * Logger.setLevel('DEBUG');
 * 
 * // 记录不同级别的日志
 * Logger.debug('调试信息', { userId: 123 });
 * Logger.info('操作成功');
 * Logger.warn('警告信息');
 * Logger.error('操作失败', new Error('Something went wrong'));
 * Logger.success('任务完成');
 */
class Logger {
  /**
   * 日志级别定义
   * @type {Object.<string, number>}
   * @property {number} DEBUG - 调试级别 (0)
   * @property {number} INFO - 信息级别 (1)
   * @property {number} WARN - 警告级别 (2)
   * @property {number} ERROR - 错误级别 (3)
   */
  static levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  /**
   * 当前日志级别
   * 当环境变量 DEBUG 设置时自动启用调试级别
   * @type {number}
   */
  static currentLevel = process.env.DEBUG ? Logger.levels.DEBUG : Logger.levels.INFO;

  /**
   * 记录调试级别的日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [context={}] - 上下文信息对象
   * 
   * @example
   * Logger.debug('用户登录', { userId: 123, ip: '192.168.1.1' });
   * Logger.debug('缓存命中', { key: 'user:123', ttl: 3600 });
   */
  static debug(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.DEBUG) {
      const contextParam = context && Object.keys(context).length > 0 ? context : '';
      console.log('🔍', `${message}`, contextParam);
    }
  }

  /**
   * 记录信息级别的日志
   * 
   * @param {string} message - 日志消息
   * @param {Object} [context={}] - 上下文信息对象
   * 
   * @example
   * Logger.info('用户注册成功', { userId: 123, email: 'user@example.com' });
   * Logger.info('配置文件加载完成');
   */
  static info(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.INFO) {
      const contextParam = context && Object.keys(context).length > 0 ? context : '';
      console.log('ℹ️', `${message}`, contextParam);
    }
  }

  /**
   * 记录警告级别的日志
   * 
   * @param {string} message - 警告消息
   * @param {Object} [context={}] - 上下文信息对象
   * 
   * @example
   * Logger.warn('API调用接近限制', { current: 95, limit: 100 });
   * Logger.warn('配置文件使用了默认值', { key: 'timeout', defaultValue: 30 });
   */
  static warn(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.WARN) {
      const contextParam = context && Object.keys(context).length > 0 ? context : '';
      console.warn('⚠️', `${message}`, contextParam);
    }
  }

  /**
   * 记录错误级别的日志
   * 
   * @param {string} message - 错误消息
   * @param {Error|null} [error=null] - 错误对象，仅在DEBUG模式下显示堆栈
   * 
   * @example
   * Logger.error('数据库连接失败', new Error('Connection timeout'));
   * Logger.error('文件读取失败');
   */
  static error(message, error = null) {
    if (Logger.currentLevel <= Logger.levels.ERROR) {
      console.error('❌', `${message}`);
      if (error && process.env.DEBUG) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  /**
   * 记录成功消息
   * 
   * @param {string} message - 成功消息
   * 
   * @example
   * Logger.success('文件上传完成');
   * Logger.success('用户创建成功');
   */
  static success(message) {
    console.log('✅', `${message}`);
  }

  /**
   * 设置日志级别
   * 
   * @param {string|number} level - 日志级别 ('DEBUG', 'INFO', 'WARN', 'ERROR') 或数字级别
   * @returns {void}
   * 
   * @example
   * // 使用字符串设置
   * Logger.setLevel('DEBUG');
   * Logger.setLevel('INFO');
   * 
   * // 使用数字设置
   * Logger.setLevel(Logger.levels.DEBUG);
   * 
   * // 无效级别会默认设置为 INFO
   * Logger.setLevel('INVALID'); // 设置为 INFO
   */
  static setLevel(level) {
    if (typeof level === 'string') {
      const normalizedLevel = level.toUpperCase();
      if (Logger.levels.hasOwnProperty(normalizedLevel)) {
        Logger.currentLevel = Logger.levels[normalizedLevel];
      } else {
        Logger.currentLevel = Logger.levels.INFO;
      }
    } else if (typeof level === 'number' && level >= 0 && level <= 3) {
      Logger.currentLevel = level;
    } else {
      Logger.currentLevel = Logger.levels.INFO;
    }
  }
}

module.exports = Logger;