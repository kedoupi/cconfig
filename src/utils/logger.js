/**
 * 统一的日志管理器
 * 提供一致的日志格式和级别控制
 */
class Logger {
  static levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  static currentLevel = process.env.DEBUG ? Logger.levels.DEBUG : Logger.levels.INFO;

  static debug(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.DEBUG) {
      console.log(`🔍 [DEBUG] ${message}`, Object.keys(context).length ? context : '');
    }
  }

  static info(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.INFO) {
      console.log(`ℹ️  ${message}`, Object.keys(context).length ? context : '');
    }
  }

  static warn(message, context = {}) {
    if (Logger.currentLevel <= Logger.levels.WARN) {
      console.warn(`⚠️  ${message}`, Object.keys(context).length ? context : '');
    }
  }

  static error(message, error = null) {
    if (Logger.currentLevel <= Logger.levels.ERROR) {
      console.error(`❌ ${message}`);
      if (error && process.env.DEBUG) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  static success(message) {
    console.log(`✅ ${message}`);
  }

  static setLevel(level) {
    if (typeof level === 'string') {
      Logger.currentLevel = Logger.levels[level.toUpperCase()] || Logger.levels.INFO;
    } else {
      Logger.currentLevel = level;
    }
  }
}

module.exports = Logger;