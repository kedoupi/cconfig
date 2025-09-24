const chalk = require('chalk');

/**
 * 统一错误处理工具
 */
class ErrorHandler {
  /**
   * 处理异步操作错误
   * @param {Function} asyncFn - 异步函数
   * @param {string} operation - 操作描述
   * @returns {Function} 包装后的异步函数
   */
  static wrapAsync(asyncFn, operation = '操作') {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        ErrorHandler.handleError(error, operation);
        process.exit(1);
      }
    };
  }

  /**
   * 标准化错误处理
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  static handleError(error, context = '未知操作') {
    console.error(chalk.red(`❌ ${context}失败:`));

    // 根据错误类型提供更好的用户提示
    if (error.code === 'ENOENT') {
      console.error(chalk.yellow('   文件或目录不存在'));
      console.error(chalk.gray('   提示: 检查文件路径是否正确'));
    } else if (error.code === 'EACCES') {
      console.error(chalk.yellow('   权限不足'));
      console.error(chalk.gray('   提示: 检查文件/目录权限'));
    } else if (error.code === 'ENOTDIR') {
      console.error(chalk.yellow('   路径不是目录'));
    } else if (error.message.includes('JSON')) {
      console.error(chalk.yellow('   JSON 格式错误'));
      console.error(chalk.gray('   提示: 检查配置文件格式'));
    } else {
      console.error(chalk.yellow(`   ${error.message}`));
    }
  }

  /**
   * 简单参数验证 - 仅用于关键场景
   * @param {any} value - 要验证的值
   * @param {string} name - 参数名称
   */
  static validateRequired(value, name) {
    if (!value) {
      throw new Error(`参数 ${name} 是必需的`);
    }
  }

  /**
   * 安全地解析 JSON
   * @param {string} jsonStr - JSON 字符串
   * @param {string} source - 来源描述
   * @returns {object} 解析结果
   */
  static safeJsonParse(jsonStr, source = '数据') {
    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`解析 ${source} 失败: ${error.message}`);
    }
  }
}

module.exports = ErrorHandler;