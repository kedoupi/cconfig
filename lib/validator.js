const ErrorHandler = require('./error-handler');

/**
 * 简化的验证工具 - 只包含真正需要的验证
 */
class Validator {
  /**
   * 基础 Provider 验证
   * @param {object} provider - Provider 对象
   */
  static validateProvider(provider) {
    if (!provider || typeof provider !== 'object') {
      throw new Error('Provider 配置必须是一个对象');
    }

    // 只验证关键字段存在
    if (!provider.alias || !provider.alias.trim()) {
      throw new Error('Provider 别名不能为空');
    }
    if (!provider.apiUrl || !provider.apiUrl.trim()) {
      throw new Error('API URL 不能为空');
    }
    if (!provider.apiKey || !provider.apiKey.trim()) {
      throw new Error('API Key 不能为空');
    }
  }
}

module.exports = Validator;