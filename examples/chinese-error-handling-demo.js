#!/usr/bin/env node

/**
 * CCVM 中文化错误处理演示
 * 展示如何在实际代码中使用中文化的错误处理系统
 */

const ErrorHandler = require('../src/utils/errorHandler');

async function demonstrateChineseErrorHandling() {
  console.log('🇨🇳 CCVM 中文化错误处理系统演示\n');

  // 1. 演示网络错误
  console.log('📡 网络错误演示：');
  try {
    throw new Error('connect ENOTFOUND api.example.com');
  } catch (error) {
    error.code = 'ENOTFOUND';
    ErrorHandler.handleNetworkErrorChinese(error, 'https://api.example.com');
  }

  await delay(2000);

  // 2. 演示认证错误
  console.log('🔐 认证错误演示：');
  ErrorHandler.handleAuthErrorChinese(401, { message: 'Invalid API key' });

  await delay(2000);

  // 3. 演示配置错误
  console.log('⚙️ 配置错误演示：');
  try {
    throw new Error('config.json not found');
  } catch (error) {
    error.code = 'ENOENT';
    ErrorHandler.handleConfigErrorChinese(error, '~/.claude/ccvm/config.json');
  }

  await delay(2000);

  // 4. 演示成功消息
  console.log('✅ 成功消息演示：');
  ErrorHandler.showSuccess('CCVM 配置已成功更新', [
    '已添加新的 API 提供商 "自定义API"',
    'Shell 函数已重新加载',
    '配置文件权限已设置为 600'
  ]);

  await delay(2000);

  // 5. 演示警告消息
  console.log('⚠️ 警告消息演示：');
  ErrorHandler.showWarning('检测到过期的 API 密钥', [
    '建议更新 API 密钥以确保服务正常',
    '可以运行 "ccvm edit 配置名" 来更新',
    '过期的密钥可能导致请求失败'
  ]);

  await delay(2000);

  // 6. 演示信息提示
  console.log('ℹ️ 信息提示演示：');
  ErrorHandler.showInfo('正在同步配置到云端...', '☁️');
  ErrorHandler.showInfo('已发现 3 个可用的 MCP 服务');
  ErrorHandler.showInfo('系统健康检查已完成', '🏥');

  console.log('\n🎉 演示完成！');
  console.log('这些中文化的错误处理功能可以让中文开发者更容易理解和解决问题。');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行演示
demonstrateChineseErrorHandling().catch(console.error);