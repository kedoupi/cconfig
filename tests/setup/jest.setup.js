/**
 * Jest Global Setup
 * 测试全局设置
 */
const fs = require('fs-extra');
const path = require('path');

// 测试环境标识（必须在最前面设置）
process.env.NODE_ENV = 'test';

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

// 测试配置目录隔离
const TEST_DIR = path.join(__dirname, '..', '..', 'test-temp');

// 为测试指定隔离的 CConfig Home 目录
process.env.CCONFIG_HOME = path.join(TEST_DIR, '.cconfig');

// 每个测试文件运行前清理测试目录
beforeEach(async () => {
  await fs.remove(TEST_DIR);
  await fs.ensureDir(process.env.CCONFIG_HOME);
});

// 所有测试完成后清理
afterAll(async () => {
  await fs.remove(TEST_DIR);
});
