const Logger = require('../utils/Logger');

/**
 * 验证器工具类
 * 提供输入验证和安全检查功能
 */
class Validator {
  /**
   * 验证别名格式
   * @param {string} alias - 别名
   * @returns {boolean} 是否有效
   */
  static isValidAlias(alias) {
    if (!alias || typeof alias !== 'string') {
      return false;
    }
    
    // 长度检查
    if (alias.length < 1 || alias.length > 32) {
      return false;
    }
    
    // 格式检查：只允许字母、数字、连字符和下划线
    if (!/^[a-zA-Z0-9-_]+$/.test(alias)) {
      return false;
    }
    
    // 防止路径遍历
    if (alias.includes('..') || alias.includes('/') || alias.includes('\\')) {
      return false;
    }
    
    return true;
  }

  /**
   * 验证URL格式和安全性
   * @param {string} url - URL地址
   * @param {Object} options - 验证选项
   * @returns {Object} 验证结果
   */
  static validateURL(url, options = {}) {
    const { allowHTTP = false, allowLocalhost = true } = options;
    
    try {
      const parsedUrl = new URL(url);
      
      // 协议检查
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { valid: false, error: 'Invalid protocol' };
      }
      
      // HTTPS要求检查
      const isLocalhost = parsedUrl.hostname === 'localhost' || 
                         parsedUrl.hostname.startsWith('127.') ||
                         parsedUrl.hostname === '::1';
      
      const isPrivateNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(parsedUrl.hostname);
      
      if (parsedUrl.protocol === 'http:') {
        if (!allowHTTP && !isLocalhost && !isPrivateNetwork) {
          const isTestingEnv = process.env.NODE_ENV === 'test' || process.env.CC_ALLOW_HTTP === 'true';
          if (!isTestingEnv) {
            return { valid: false, error: 'HTTPS required for production URLs' };
          }
        }
      }
      
      // 本地主机检查
      if (!allowLocalhost && isLocalhost) {
        return { valid: false, error: 'Localhost URLs not allowed' };
      }
      
      return { valid: true, url: parsedUrl.toString() };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * 验证API密钥强度
   * @param {string} apiKey - API密钥
   * @returns {Object} 验证结果
   */
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required' };
    }
    
    // 长度检查
    if (apiKey.length < 10) {
      return { valid: false, error: 'API key is too short' };
    }
    
    if (apiKey.length > 512) {
      return { valid: false, error: 'API key is too long' };
    }
    
    // 检查弱密钥模式
    const weakPatterns = ['test', 'demo', 'example', '123456', 'password'];
    const lowerKey = apiKey.toLowerCase();
    
    for (const pattern of weakPatterns) {
      if (lowerKey.includes(pattern)) {
        Logger.warn('API key contains weak pattern', { pattern });
        // 警告但不阻止
        break;
      }
    }
    
    // 检查是否包含空格或特殊字符
    if (/\s/.test(apiKey)) {
      return { valid: false, error: 'API key contains whitespace' };
    }
    
    return { valid: true };
  }

  /**
   * 验证文件路径安全性
   * @param {string} filePath - 文件路径
   * @param {string} basePath - 基础路径
   * @returns {boolean} 是否安全
   */
  static isPathSafe(filePath, basePath) {
    const path = require('path');
    
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(basePath);
      
      // 确保路径在基础路径内
      return resolvedPath.startsWith(resolvedBase);
    } catch {
      return false;
    }
  }

  /**
   * 验证JSON结构
   * @param {string} jsonString - JSON字符串
   * @returns {Object} 验证结果
   */
  static validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return { valid: true, data: parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 验证超时值
   * @param {*} timeout - 超时值
   * @returns {Object} 验证结果
   */
  static validateTimeout(timeout) {
    const parsed = parseInt(timeout);
    
    if (isNaN(parsed)) {
      return { valid: false, error: 'Timeout must be a number' };
    }
    
    if (parsed < 1000) {
      return { valid: false, error: 'Timeout must be at least 1000ms' };
    }
    
    if (parsed > 600000) {
      return { valid: false, error: 'Timeout cannot exceed 600000ms (10 minutes)' };
    }
    
    return { valid: true, value: parsed };
  }

  /**
   * 清理用户输入
   * @param {string} input - 用户输入
   * @returns {string} 清理后的输入
   */
  static sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // 移除控制字符
    // eslint-disable-next-line no-control-regex
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 移除潜在的命令注入字符
    sanitized = sanitized.replace(/[;&|`$(){}[\]<>]/g, '');
    
    // 限制长度
    if (sanitized.length > 1024) {
      sanitized = sanitized.substring(0, 1024);
    }
    
    return sanitized.trim();
  }

  /**
   * 验证配置对象
   * @param {Object} config - 配置对象
   * @param {Object} schema - 验证模式
   * @returns {Object} 验证结果
   */
  static validateConfig(config, schema) {
    const errors = [];
    
    // 检查必需字段
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    // 检查字段类型
    if (schema.properties) {
      for (const [field, rules] of Object.entries(schema.properties)) {
        if (field in config) {
          const value = config[field];
          
          // 类型检查
          if (rules.type && typeof value !== rules.type) {
            errors.push(`Field '${field}' must be of type ${rules.type}`);
          }
          
          // 格式检查
          if (rules.format) {
            switch (rules.format) {
              case 'url': {
                const urlResult = Validator.validateURL(value);
                if (!urlResult.valid) {
                  errors.push(`Field '${field}': ${urlResult.error}`);
                }
                break;
              }
              case 'alias':
                if (!Validator.isValidAlias(value)) {
                  errors.push(`Field '${field}' has invalid alias format`);
                }
                break;
              default:
                // Unknown format, skip validation
                break;
            }
          }
          
          // 范围检查
          if (rules.min !== undefined && value < rules.min) {
            errors.push(`Field '${field}' must be at least ${rules.min}`);
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push(`Field '${field}' must be at most ${rules.max}`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Validator;