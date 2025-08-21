// Jest 全局设置文件

// 设置测试超时时间
jest.setTimeout(10000);

// 全局变量
global.TEST_TIMEOUT = 5000;

// Mock 控制台输出以避免测试时的噪音
const originalConsole = global.console;

// 在测试期间静默某些控制台输出
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // 保留 error 以便调试
    error: originalConsole.error,
  };
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});