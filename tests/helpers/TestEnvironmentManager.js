/**
 * 安全的环境变量管理器
 * 
 * 提供测试环境的安全隔离，防止测试代码意外修改或删除实际用户数据
 */

const os = require('os');
const path = require('path');

class TestEnvironmentManager {
  constructor() {
    this.originalEnv = {};
    this.isActive = false;
    this.testMode = false;
  }

  /**
   * 激活测试环境
   * @param {string} testDir - 测试目录
   * @param {Object} options - 选项
   */
  activate(testDir, options = {}) {
    if (this.isActive) {
      throw new Error('测试环境已经激活');
    }

    // 保存原始环境变量
    this.originalEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      CCVM_TEST_MODE: process.env.CCVM_TEST_MODE,
      CC_CONFIG_DIR: process.env.CC_CONFIG_DIR,
      CC_PROVIDERS_DIR: process.env.CC_PROVIDERS_DIR,
      CC_BACKUPS_DIR: process.env.CC_BACKUPS_DIR
    };

    // 设置测试环境变量
    process.env.HOME = testDir;
    process.env.USERPROFILE = testDir;
    process.env.CCVM_TEST_MODE = 'true';
    
    // 清除可能的配置目录覆盖
    delete process.env.CC_CONFIG_DIR;
    delete process.env.CC_PROVIDERS_DIR;
    delete process.env.CC_BACKUPS_DIR;

    this.isActive = true;
    this.testMode = true;
  }

  /**
   * 停用测试环境并恢复原始状态
   */
  deactivate() {
    if (!this.isActive) {
      return;
    }

    // 恢复原始环境变量
    Object.keys(this.originalEnv).forEach(key => {
      if (this.originalEnv[key] !== undefined) {
        process.env[key] = this.originalEnv[key];
      } else {
        delete process.env[key];
      }
    });

    this.isActive = false;
    this.testMode = false;
    this.originalEnv = {};
  }

  /**
   * 检查是否在测试模式
   * @returns {boolean}
   */
  isTestMode() {
    return this.testMode || process.env.CCVM_TEST_MODE === 'true';
  }

  /**
   * 获取安全的测试配置目录
   * @param {string} baseDir - 基础目录
   * @returns {string} 安全的配置目录路径
   */
  getSafeConfigDir(baseDir) {
    // 确保目录在测试环境中
    const normalizedBase = path.resolve(baseDir);
    const normalizedHome = path.resolve(process.env.HOME || os.homedir());
    
    // 如果基础目录不在测试环境中，使用测试环境目录
    if (!normalizedBase.startsWith(normalizedHome)) {
      return path.join(normalizedHome, '.claude', 'ccvm');
    }
    
    return normalizedBase;
  }

  /**
   * 验证路径是否安全（不指向实际用户数据）
   * @param {string} filePath - 要验证的文件路径
   * @returns {boolean}
   */
  isSafePath(filePath) {
    if (!this.isTestMode()) {
      return false;
    }

    const realHomeDir = os.homedir();
    const normalizedPath = path.resolve(filePath);
    
    // 检查路径是否指向实际的用户目录
    if (normalizedPath.startsWith(realHomeDir) && 
        !normalizedPath.startsWith(path.resolve(process.env.HOME || ''))) {
      return false;
    }
    
    return true;
  }

  /**
   * 创建安全的测试环境包装器
   * @param {Function} testFn - 要执行的测试函数
   * @param {string} testDir - 测试目录
   * @returns {Promise<any>}
   */
  async withSafeEnvironment(testFn, testDir) {
    this.activate(testDir);
    
    try {
      return await testFn();
    } catch (error) {
      // 确保在错误情况下也能恢复环境
      this.deactivate();
      throw error;
    } finally {
      this.deactivate();
    }
  }
}

// 创建全局实例
const testEnvManager = new TestEnvironmentManager();

// 全局导出
global.testEnvManager = testEnvManager;

module.exports = testEnvManager;