const chalk = require('chalk');

/**
 * 错误处理工具类
 */
class ErrorHandler {
  /**
   * 处理错误并输出友好的错误信息
   */
  static handleError(error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.red('❌ 详细错误信息:'));
      console.error(error);
    } else {
      console.error(chalk.red('❌ 错误:'), error.message || error);
    }
  }

  /**
   * 警告信息
   */
  static handleWarning(message) {
    console.warn(chalk.yellow('⚠️  警告:'), message);
  }

  /**
   * 成功信息
   */
  static handleSuccess(message) {
    console.log(chalk.green('✅ 成功:'), message);
  }

  /**
   * 信息输出
   */
  static handleInfo(message) {
    console.log(chalk.blue('ℹ️  信息:'), message);
  }

  /**
   * 设置全局错误处理器
   */
  static setupGlobalErrorHandlers() {
    // 处理未捕获的异常
    process.on('uncaughtException', error => {
      console.error(chalk.red('❌ 未捕获的异常:'));
      console.error(error);
      process.exit(1);
    });

    // 处理未处理的Promise rejection
    process.on('unhandledRejection', (reason, _promise) => {
      console.error(chalk.red('❌ 未处理的Promise rejection:'));
      console.error(reason);
      process.exit(1);
    });

    // 优雅的退出处理
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 程序已退出'));
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log(chalk.yellow('\n👋 程序已终止'));
      process.exit(0);
    });
  }
}

module.exports = {
  handleError: ErrorHandler.handleError,
  handleWarning: ErrorHandler.handleWarning,
  handleSuccess: ErrorHandler.handleSuccess,
  handleInfo: ErrorHandler.handleInfo,
  setupGlobalErrorHandlers: ErrorHandler.setupGlobalErrorHandlers,
};
