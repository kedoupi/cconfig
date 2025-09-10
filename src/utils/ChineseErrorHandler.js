/**
 * 中文化错误处理系统
 * 将技术错误转换为用户友好的中文提示
 */

const chalk = require('chalk');

class ChineseErrorHandler {
  constructor() {
    // 错误代码到中文描述的映射
    this.errorMessages = {
      // 网络相关错误
      'ENOTFOUND': {
        title: '网络连接失败',
        description: '无法连接到指定的服务器',
        suggestions: [
          '检查网络连接是否正常',
          '验证 API 端点地址是否正确',
          '尝试使用其他网络或VPN'
        ],
        icon: '🌐'
      },
      'ECONNREFUSED': {
        title: '服务器拒绝连接',
        description: '目标服务器拒绝了连接请求',
        suggestions: [
          '检查 API 服务是否正常运行',
          '验证端口号是否正确',
          '确认防火墙设置允许连接'
        ],
        icon: '🚫'
      },
      'TIMEOUT': {
        title: '请求超时',
        description: '服务器响应时间过长',
        suggestions: [
          '检查网络连接速度',
          '尝试增加超时时间设置',
          '稍后重试或切换到其他 API 提供商'
        ],
        icon: '⏱️'
      },

      // 认证相关错误
      'INVALID_API_KEY': {
        title: 'API 密钥无效',
        description: '提供的 API 密钥不正确或已过期',
        suggestions: [
          '检查 API 密钥是否正确输入',
          '验证 API 密钥是否仍然有效',
          '重新获取新的 API 密钥'
        ],
        icon: '🔑'
      },
      'AUTH_FAILED': {
        title: '认证失败',
        description: '身份验证未通过',
        suggestions: [
          '确认 API 密钥格式正确',
          '检查账户是否有足够权限',
          '联系 API 提供商确认账户状态'
        ],
        icon: '🔐'
      },

      // 配置相关错误
      'CONFIG_NOT_FOUND': {
        title: '配置文件未找到',
        description: '系统找不到必要的配置文件',
        suggestions: [
          '运行 "ccvm add" 创建新的配置',
          '检查 ~/.claude/ccvm 目录是否存在',
          '尝试重新安装 CCVM'
        ],
        icon: '📄'
      },
      'INVALID_CONFIG': {
        title: '配置文件格式错误',
        description: '配置文件内容不正确或已损坏',
        suggestions: [
          '运行 "ccvm doctor --fix" 自动修复',
          '删除损坏的配置文件并重新创建',
          '检查 JSON 格式是否正确'
        ],
        icon: '⚠️'
      },

      // 文件系统相关错误
      'EACCES': {
        title: '文件权限不足',
        description: '没有足够的权限访问文件或目录',
        suggestions: [
          '检查文件权限设置',
          '使用 "chmod 600" 设置正确权限',
          '确认当前用户有写入权限'
        ],
        icon: '🔒'
      },
      'ENOENT': {
        title: '文件或目录不存在',
        description: '系统找不到指定的文件或目录',
        suggestions: [
          '检查文件路径是否正确',
          '确认文件是否已被删除',
          '重新创建缺失的文件或目录'
        ],
        icon: '📁'
      },

      // MCP 相关错误
      'MCP_SERVICE_UNAVAILABLE': {
        title: 'MCP 服务不可用',
        description: '无法连接到 Model Context Protocol 服务',
        suggestions: [
          '检查 MCP 服务是否已启动',
          '验证服务配置是否正确',
          '尝试重启相关服务'
        ],
        icon: '🔌'
      },
      'MCP_CONFIG_ERROR': {
        title: 'MCP 配置错误',
        description: 'MCP 服务配置存在问题',
        suggestions: [
          '运行 "ccvm mcp" 重新配置服务',
          '检查服务依赖是否已安装',
          '验证配置参数是否正确'
        ],
        icon: '🛠️'
      }
    };

    // 通用错误消息
    this.genericError = {
      title: '系统错误',
      description: '发生了未知的系统错误',
      suggestions: [
        '运行 "ccvm doctor" 检查系统状态',
        '查看详细错误日志了解更多信息',
        '如问题持续，请提交 Issue 反馈'
      ],
      icon: '❌'
    };
  }

  /**
   * 处理并格式化错误信息
   * @param {Error|string} error - 错误对象或错误代码
   * @param {string} context - 错误上下文信息
   * @param {boolean} verbose - 是否显示详细信息
   */
  handleError(error, context = '', verbose = false) {
    let errorCode, errorMessage, rawError;
    
    if (error instanceof Error) {
      errorCode = error.code || error.name || 'UNKNOWN';
      errorMessage = error.message;
      rawError = error;
    } else if (typeof error === 'string') {
      errorCode = error;
      errorMessage = '';
      rawError = null;
    } else {
      errorCode = 'UNKNOWN';
      errorMessage = String(error);
      rawError = error;
    }

    const errorInfo = this.errorMessages[errorCode] || this.genericError;
    
    console.error('');
    console.error(chalk.red.bold(`${errorInfo.icon} ${errorInfo.title}`));
    console.error(chalk.gray(`${errorInfo.description}`));
    
    if (context) {
      console.error(chalk.yellow(`\n📍 发生位置：${context}`));
    }

    console.error(chalk.blue('\n💡 建议解决方案：'));
    errorInfo.suggestions.forEach((suggestion, index) => {
      console.error(chalk.blue(`   ${index + 1}. ${suggestion}`));
    });

    if (verbose && rawError) {
      console.error(chalk.gray('\n🔍 技术详情：'));
      console.error(chalk.gray(`   错误代码：${errorCode}`));
      if (errorMessage) {
        console.error(chalk.gray(`   错误信息：${errorMessage}`));
      }
      if (rawError.stack) {
        console.error(chalk.gray(`   调用栈：\n${rawError.stack}`));
      }
    }

    console.error(chalk.cyan('\n📖 获取帮助：'));
    console.error(chalk.cyan('   • 运行 "ccvm doctor" 诊断系统'));
    console.error(chalk.cyan('   • 查看文档：https://github.com/kedoupi/ccvm'));
    console.error(chalk.cyan('   • 提交问题：https://github.com/kedoupi/ccvm/issues'));
    console.error('');
  }

  /**
   * 处理网络相关错误
   */
  handleNetworkError(error, url = '') {
    let errorCode = 'NETWORK_ERROR';
    
    if (error.code === 'ENOTFOUND') {
      errorCode = 'ENOTFOUND';
    } else if (error.code === 'ECONNREFUSED') {
      errorCode = 'ECONNREFUSED';  
    } else if (error.message?.includes('timeout')) {
      errorCode = 'TIMEOUT';
    }

    const context = url ? `连接到 ${url}` : '网络请求';
    this.handleError(errorCode, context);
    
    // 提供额外的网络诊断建议
    console.error(chalk.magenta('🔧 网络诊断工具：'));
    console.error(chalk.magenta('   • ping api.anthropic.com'));
    console.error(chalk.magenta('   • nslookup api.anthropic.com'));
    console.error(chalk.magenta('   • curl -I https://api.anthropic.com'));
  }

  /**
   * 处理 API 认证错误
   */
  handleAuthError(statusCode, response) {
    let errorCode = 'AUTH_FAILED';
    
    if (statusCode === 401) {
      errorCode = 'INVALID_API_KEY';
    }

    this.handleError(errorCode, 'API 认证');
    
    // 提供 API 密钥管理建议
    console.error(chalk.green('🔑 API 密钥管理：'));
    console.error(chalk.green('   • ccvm list                 # 查看现有配置'));
    console.error(chalk.green('   • ccvm edit <配置名>        # 编辑 API 密钥'));
    console.error(chalk.green('   • ccvm add                  # 添加新的配置'));
  }

  /**
   * 处理配置文件错误
   */
  handleConfigError(error, configPath = '') {
    let errorCode = 'INVALID_CONFIG';
    
    if (error.code === 'ENOENT') {
      errorCode = 'CONFIG_NOT_FOUND';
    } else if (error.code === 'EACCES') {
      errorCode = 'EACCES';
    }

    const context = configPath ? `配置文件 ${configPath}` : '配置管理';
    this.handleError(errorCode, context);
    
    // 提供配置修复建议
    console.error(chalk.yellow('⚙️ 配置管理工具：'));
    console.error(chalk.yellow('   • ccvm status              # 检查配置状态'));
    console.error(chalk.yellow('   • ccvm doctor --fix        # 自动修复配置'));
    console.error(chalk.yellow('   • ccvm reset               # 重置所有配置'));
  }

  /**
   * 创建友好的成功消息
   */
  showSuccess(message, details = []) {
    console.log(chalk.green.bold(`✅ ${message}`));
    if (details.length > 0) {
      details.forEach(detail => {
        console.log(chalk.green(`   • ${detail}`));
      });
    }
    console.log('');
  }

  /**
   * 创建友好的警告消息  
   */
  showWarning(message, suggestions = []) {
    console.log(chalk.yellow.bold(`⚠️  ${message}`));
    if (suggestions.length > 0) {
      console.log(chalk.yellow('💡 建议：'));
      suggestions.forEach(suggestion => {
        console.log(chalk.yellow(`   • ${suggestion}`));
      });
    }
    console.log('');
  }

  /**
   * 创建友好的信息提示
   */
  showInfo(message, icon = 'ℹ️') {
    console.log(chalk.blue(`${icon} ${message}`));
  }
}

module.exports = new ChineseErrorHandler();