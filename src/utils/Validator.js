const Logger = require('../utils/Logger');
const path = require('path');

/**
 * 验证器工具类
 * 提供输入验证和安全检查功能，包括URL验证、API密钥验证、路径安全检查等
 * 
 * @class
 * @example
 * const Validator = require('./Validator');
 * 
 * // 验证别名
 * if (Validator.isValidAlias('my-provider')) {
 *   console.log('别名有效');
 * }
 * 
 * // 验证URL
 * const urlResult = Validator.validateURL('https://api.example.com');
 * if (urlResult.valid) {
 *   console.log('URL有效:', urlResult.url);
 * }
 * 
 * // 验证API密钥
 * const keyResult = Validator.validateApiKey('sk-1234567890abcdef');
 * if (keyResult.valid) {
 *   console.log('API密钥有效');
 * }
 * 
 * // 验证配置
 * const configResult = Validator.validateConfig(config, {
 *   required: ['name', 'url'],
 *   properties: {
 *     name: { type: 'string' },
 *     url: { type: 'string', format: 'url' }
 *   }
 * });
 */
class Validator {
  /**
   * 验证别名格式，确保别名的安全性和可用性
   * 
   * @param {string} alias - 要验证的别名
   * @returns {boolean} 如果别名有效返回true，否则返回false
   * 
   * @example
   * // 有效的别名
   * Validator.isValidAlias('my-provider');    // true
   * Validator.isValidAlias('provider_123');   // true
   * Validator.isValidAlias('test-provider');  // true
   * 
   * // 无效的别名
   * Validator.isValidAlias('');               // false
   * Validator.isValidAlias('my provider');    // false (包含空格)
   * Validator.isValidAlias('../etc/passwd');   // false (路径遍历)
   * Validator.isValidAlias('provider/name');  // false (包含路径分隔符)
   * Validator.isValidAlias('a'.repeat(33));    // false (太长)
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
   * 验证URL格式和安全性，防止SSRF攻击和恶意URL
   * 
   * @param {string} url - 要验证的URL地址
   * @param {Object} [options={}] - 验证选项
   * @param {boolean} [options.allowHTTP=false] - 是否允许HTTP协议（生产环境默认不允许）
   * @param {boolean} [options.allowLocalhost=true] - 是否允许localhost地址
   * @returns {Object} 验证结果对象
   * @property {boolean} valid - URL是否有效
   * @property {string} [url] - 标准化后的URL（如果有效）
   * @property {string} [error] - 错误信息（如果无效）
   * 
   * @example
   * // 验证HTTPS URL
   * const result1 = Validator.validateURL('https://api.example.com');
   * // { valid: true, url: 'https://api.example.com' }
   * 
   * // 验证HTTP URL（默认不允许）
   * const result2 = Validator.validateURL('http://api.example.com');
   * // { valid: false, error: 'HTTPS required for production URLs' }
   * 
   * // 允许HTTP URL
   * const result3 = Validator.validateURL('http://localhost:3000', { allowHTTP: true });
   * // { valid: true, url: 'http://localhost:3000' }
   * 
   * // 禁止localhost
   * const result4 = Validator.validateURL('http://localhost', { allowLocalhost: false });
   * // { valid: false, error: 'Localhost URLs not allowed' }
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
   * 验证API密钥强度和安全性
   * 检查密钥长度、格式和潜在的安全问题
   * 
   * @param {string} apiKey - 要验证的API密钥
   * @returns {Object} 验证结果对象
   * @property {boolean} valid - API密钥是否有效
   * @property {string} [error] - 错误信息（如果无效）
   * 
   * @example
   * // 有效的API密钥
   * const result1 = Validator.validateApiKey('sk-1234567890abcdef');
   * // { valid: true }
   * 
   * // 无效的API密钥（太短）
   * const result2 = Validator.validateApiKey('short');
   * // { valid: false, error: 'API key is too short' }
   * 
   * // 无效的API密钥（包含空格）
   * const result3 = Validator.validateApiKey('sk-123 456');
   * // { valid: false, error: 'API key contains whitespace' }
   * 
   * // 弱密钥（会记录警告但仍返回有效）
   * const result4 = Validator.validateApiKey('sk-test-key-123');
   * // { valid: true } (同时会记录警告日志)
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
   * 验证文件路径安全性，防止路径遍历攻击
   * 
   * @param {string} filePath - 要验证的文件路径
   * @param {string} basePath - 基础路径（限制访问范围）
   * @returns {boolean} 如果路径安全返回true，否则返回false
   * 
   * @example
   * // 安全的路径
   * Validator.isPathSafe('/home/user/config.json', '/home/user');  // true
   * 
   * // 不安全的路径（路径遍历）
   * Validator.isPathSafe('/home/user/../etc/passwd', '/home/user');  // false
   * Validator.isPathSafe('/etc/passwd', '/home/user');  // false
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
   * 验证JSON字符串格式
   * 
   * @param {string} jsonString - JSON字符串
   * @returns {Object} 验证结果对象
   * @property {boolean} valid - JSON是否有效
   * @property {*} [data] - 解析后的数据（如果有效）
   * @property {string} [error] - 错误信息（如果无效）
   * 
   * @example
   * // 有效的JSON
   * const result1 = Validator.validateJSON('{"name": "test"}');
   * // { valid: true, data: { name: "test" } }
   * 
   * // 无效的JSON
   * const result2 = Validator.validateJSON('{"name": test}');
   * // { valid: false, error: "Unexpected token t in JSON at position 10" }
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
   * 验证超时值的有效性和合理性
   * 
   * @param {*} timeout - 要验证的超时值
   * @returns {Object} 验证结果对象
   * @property {boolean} valid - 超时值是否有效
   * @property {number} [value] - 解析后的超时值（如果有效）
   * @property {string} [error] - 错误信息（如果无效）
   * 
   * @example
   * // 有效的超时值
   * const result1 = Validator.validateTimeout(30000);
   * // { valid: true, value: 30000 }
   * 
   * // 无效的超时值（太短）
   * const result2 = Validator.validateTimeout(500);
   * // { valid: false, error: 'Timeout must be at least 1000ms' }
   * 
   * // 无效的超时值（太长）
   * const result3 = Validator.validateTimeout(700000);
   * // { valid: false, error: 'Timeout cannot exceed 600000ms (10 minutes)' }
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
   * 清理用户输入，移除潜在的恶意字符和控制字符
   * 防止命令注入和XSS攻击
   * 
   * @param {string} input - 要清理的用户输入
   * @returns {string} 清理后的安全字符串
   * 
   * @example
   * // 清理包含特殊字符的输入
   * const cleaned1 = Validator.sanitizeInput('hello; rm -rf /');
   * // 返回: 'hello rm -rf '
   * 
   * // 清理包含控制字符的输入
   * const cleaned2 = Validator.sanitizeInput('test\x00\x01data');
   * // 返回: 'testdata'
   * 
   * // 清理过长的输入
   * const cleaned3 = Validator.sanitizeInput('a'.repeat(2000));
   * // 返回: 1024个字符的字符串
   * 
   * // 无效输入
   * const cleaned4 = Validator.sanitizeInput(null);
   * // 返回: ''
   */
  static sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    const { 
      allowShellChars = false, 
      allowHtmlChars = false,
      maxLength = 1024,
      preserveSpaces = true 
    } = options;
    
    let sanitized = input;
    
    // 移除控制字符（保留换行符和制表符）
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // 移除危险的shell注入模式
    if (!allowShellChars) {
      const dangerousPatterns = [
        /;\s*rm\s+-rf\s+.*/gi,        // rm -rf 命令及后面的所有内容
        /;\s*sudo\s+.*/gi,            // sudo 命令及后面的所有内容
        /\|\s*sh\s*$/gi,            // | sh 管道
        /`[^`]*\s*(rm|sudo|sh)[^`]*`/gi,  // 反引号中的危险命令
        /\$\([^)]*\s*(rm|sudo|sh)[^)]*\)/gi, // $() 中的危险命令
        /;\s*npm\s+(uninstall|run)\s+/gi,  // npm 危险命令
        /;\s*yarn\s+(remove|run)\s+/gi,    // yarn 危险命令
        /;\s*curl\s+.*\s*\|\s*sh/gi,      // curl | shell 组合
        /;\s*wget\s+.*\s*\|\s*sh/gi,      // wget | shell 组合
        /[^a-zA-Z0-9._\-\/@:\s]/g         // 保留基本安全字符
      ];
      
      for (const pattern of dangerousPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // 移除HTML/XML标签以防止XSS攻击
    if (!allowHtmlChars) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      // 转义HTML特殊字符
      const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      sanitized = sanitized.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
    }
    
    // 处理空格
    if (!preserveSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }
    
    // 限制长度
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // 移除潜在的路径遍历攻击
    sanitized = sanitized.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
    
    return sanitized.trim();
  }

  /**
   * 验证配置对象的结构和内容
   * 支持必需字段检查、类型验证、格式验证和范围验证
   * 
   * @param {Object} config - 要验证的配置对象
   * @param {Object} schema - 验证模式定义
   * @param {string[]} [schema.required] - 必需字段列表
   * @param {Object} [schema.properties] - 属性验证规则
   * @returns {Object} 验证结果对象
   * @property {boolean} valid - 配置是否有效
   * @property {string[]} [errors] - 错误信息列表（如果无效）
   * 
   * @example
   * // 定义验证模式
   * const schema = {\n   *   required: ['name', 'url', 'timeout'],\n   *   properties: {\n   *     name: { type: 'string' },\n   *     url: { type: 'string', format: 'url' },\n   *     timeout: { type: 'number', min: 1000, max: 30000 },\n   *     alias: { type: 'string', format: 'alias' }\n   *   }\n   * };\n   * \n   * // 验证配置\n   * const config = {\n   *   name: 'My Provider',\n   *   url: 'https://api.example.com',\n   *   timeout: 5000,\n   *   alias: 'my-provider'\n   * };\n   * \n   * const result = Validator.validateConfig(config, schema);\n   * // { valid: true, errors: [] }\n   * \n   * // 缺少必需字段的配置\n   * const invalidConfig = { name: 'Test' };\n   * const invalidResult = Validator.validateConfig(invalidConfig, schema);\n   * // { valid: false, errors: ['Missing required field: url', 'Missing required field: timeout'] }
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

  /**
   * 验证输入是否包含潜在的命令注入攻击
   * 
   * @param {string} input - 要检查的输入
   * @returns {Object} 检查结果
   * @property {boolean} isSafe - 输入是否安全
   * @property {string[]} [risks] - 发现的风险列表（如果不安全）
   * 
   * @example
   * const check1 = Validator.checkCommandInjection('hello world');
   * // { isSafe: true, risks: [] }
   * 
   * const check2 = Validator.checkCommandInjection('rm -rf /tmp');
   * // { isSafe: false, risks: ['contains dangerous rm command'] }
   */
  static checkCommandInjection(input) {
    if (!input || typeof input !== 'string') {
      return { isSafe: true, risks: [] };
    }

    const risks = [];
    const lowerInput = input.toLowerCase();

    // 检查危险命令模式
    const dangerousPatterns = [
      { pattern: /\brm\s+-rf\b/gi, description: 'contains dangerous rm command' },
      { pattern: /\bsudo\b/gi, description: 'contains sudo command' },
      { pattern: /\bsh\s+-c\b/gi, description: 'contains shell execution' },
      { pattern: /\beval\b/gi, description: 'contains eval command' },
      { pattern: /\bexec\b/gi, description: 'contains exec command' },
      { pattern: /;\s*rm\b/gi, description: 'contains chained rm command' },
      { pattern: /\|\s*sh\b/gi, description: 'contains pipe to shell' },
      { pattern: /`[^`]*rm[^`]*`/gi, description: 'contains backtick rm command' },
      { pattern: /\$\([^)]*rm[^)]*\)/gi, description: 'contains command substitution rm' },
      { pattern: /\bnc\s+-l\b/gi, description: 'contains netcat listener' },
      { pattern: /\bbash\s+-i\b/gi, description: 'contains interactive shell' }
    ];

    for (const { pattern, description } of dangerousPatterns) {
      if (pattern.test(input)) {
        risks.push(description);
      }
    }

    // 检查路径遍历攻击
    if (/\.\.\//.test(input) || /\.\.\\/.test(input)) {
      risks.push('contains path traversal');
    }

    // 检查环境变量操作
    if (/\$\{[^}]+\}/.test(input) || /\$[A-Z_]+/.test(input)) {
      risks.push('contains environment variable access');
    }

    return {
      isSafe: risks.length === 0,
      risks
    };
  }

  /**
   * 验证文件路径是否安全，防止路径遍历攻击
   * 
   * @param {string} filePath - 要验证的文件路径
   * @param {Object} [options={}] - 验证选项
   * @param {boolean} [options.allowAbsolute=true] - 是否允许绝对路径
   * @param {string} [options.allowedBaseDir] - 允许的基础目录
   * @returns {Object} 验证结果
   * @property {boolean} isValid - 路径是否有效
   * @property {string} [normalizedPath] - 标准化后的路径
   * @property {string[]} [errors] - 错误信息列表
   * 
   * @example
   * const result1 = Validator.validateSafePath('/home/user/config.json');
   * // { isValid: true, normalizedPath: '/home/user/config.json' }
   * 
   * const result2 = Validator.validateSafePath('../../etc/passwd');
   * // { isValid: false, errors: ['Path traversal detected'] }
   */
  static validateSafePath(filePath, options = {}) {
    const { allowAbsolute = true, allowedBaseDir } = options;
    const errors = [];

    if (!filePath || typeof filePath !== 'string') {
      return {
        isValid: false,
        errors: ['Invalid file path']
      };
    }

    // 检查路径遍历攻击
    if (filePath.includes('..') || filePath.includes('~')) {
      errors.push('Path traversal detected');
    }

    // 检查绝对路径
    if (!allowAbsolute && path.isAbsolute(filePath)) {
      errors.push('Absolute paths not allowed');
    }

    // 标准化路径
    let normalizedPath;
    try {
      normalizedPath = path.normalize(filePath);
      
      // 如果指定了基础目录，确保路径在允许范围内
      if (allowedBaseDir) {
        const resolvedBase = path.resolve(allowedBaseDir);
        const resolvedPath = path.resolve(normalizedPath);
        
        if (!resolvedPath.startsWith(resolvedBase)) {
          errors.push('Path outside allowed base directory');
        }
      }
    } catch (error) {
      errors.push('Invalid path format');
    }

    // 检查可疑的文件名
    const suspiciousPatterns = [
      /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.sh$/i,
      /passwd$/, /shadow$/, /hosts$/, /\.key$/i, /\.pem$/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalizedPath)) {
        errors.push(`Suspicious file pattern detected: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      normalizedPath,
      errors
    };
  }

  /**
   * 验证API密钥格式和安全性
   * 
   * @param {string} apiKey - 要验证的API密钥
   * @param {Object} [options={}] - 验证选项
   * @param {string} [options.expectedPrefix] - 期望的前缀（如 'sk-'）
   * @param {number} [options.minLength=10] - 最小长度
   * @param {number} [options.maxLength=100] - 最大长度
   * @returns {Object} 验证结果
   * @property {boolean} isValid - 密钥是否有效
   * @property {string[]} [errors] - 错误信息列表
   * 
   * @example
   * const result = Validator.validateApiKey('sk-1234567890abcdef', {
   *   expectedPrefix: 'sk-',
   *   minLength: 20,
   *   maxLength: 50
   * });
   */
  static validateApiKey(apiKey, options = {}) {
    const { expectedPrefix, minLength = 10, maxLength = 100 } = options;
    const errors = [];

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key is required');
      return { isValid: false, errors };
    }

    // 检查长度
    if (apiKey.length < minLength) {
      errors.push(`API key too short (minimum ${minLength} characters)`);
    }
    if (apiKey.length > maxLength) {
      errors.push(`API key too long (maximum ${maxLength} characters)`);
    }

    // 检查前缀
    if (expectedPrefix && !apiKey.startsWith(expectedPrefix)) {
      errors.push(`API key must start with '${expectedPrefix}'`);
    }

    // 检查密钥格式（通常只包含字母、数字和连字符）
    if (!/^[a-zA-Z0-9\-_]+$/.test(apiKey)) {
      errors.push('API key contains invalid characters');
    }

    // 检查常见的测试/占位符密钥
    const placeholderPatterns = [
      /^test[-_]?key$/i,
      /^your[-_]?key$/i,
      /^placeholder$/i,
      /^sk[-_]?test[-_]?key$/i,
      /^1234567890abcdef$/,
      /^deadbeefdeadbeef$/
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(apiKey)) {
        errors.push('API key appears to be a placeholder or test key');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 深度清理对象，移除所有不安全的属性和值
   * 
   * @param {Object} obj - 要清理的对象
   * @param {Object} [options={}] - 清理选项
   * @param {boolean} [options.removeFunctions=true] - 是否移除函数
   * @param {boolean} [options.removeUndefined=true] - 是否移除undefined值
   * @param {number} [options.maxDepth=10] - 最大递归深度
   * @returns {Object} 清理后的对象
   * 
   * @example
   * const dirty = {
   *   name: 'test',
   *   password: 'secret',
   *   func: () => console.log('dangerous'),
   *   nested: { evil: '<script>alert(1)</script>' }
   * };
   * 
   * const clean = Validator.deepSanitizeObject(dirty, {
   *   removeFunctions: true,
   *   removeUndefined: true
   * });
   */
  static deepSanitizeObject(obj, options = {}) {
    const { 
      removeFunctions = true, 
      removeUndefined = true, 
      maxDepth = 10,
      currentDepth = 0 
    } = options;

    if (currentDepth >= maxDepth) {
      return {};
    }

    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const result = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      // 跳过原型链属性
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }

      // 跳过函数
      if (removeFunctions && typeof value === 'function') {
        continue;
      }

      // 跳过undefined值
      if (removeUndefined && value === undefined) {
        continue;
      }

      // 清理键名
      const cleanKey = this.sanitizeInput(key, { 
        allowShellChars: true, 
        allowHtmlChars: true,
        maxLength: 100 
      });

      // 递归清理值
      if (typeof value === 'object' && value !== null) {
        result[cleanKey] = this.deepSanitizeObject(value, {
          ...options,
          currentDepth: currentDepth + 1
        });
      } else if (typeof value === 'string') {
        result[cleanKey] = this.sanitizeInput(value);
      } else {
        result[cleanKey] = value;
      }
    }

    return result;
  }
}

module.exports = Validator;