/**
 * Jest Global Setup
 * 测试全局设置
 */

// 全局测试超时设置
jest.setTimeout(30000);

// 模拟console方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留error和warn用于调试
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 全局测试辅助函数
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 测试环境标识
process.env.NODE_ENV = 'test';