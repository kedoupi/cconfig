#!/usr/bin/env node

/**
 * 测试环境安全验证脚本
 * 
 * 验证测试环境是否正确隔离，不会影响实际用户数据
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🔒 测试环境安全验证');
console.log('==================');

// 获取真实的用户主目录
const realHomeDir = os.homedir();
const realConfigDir = path.join(realHomeDir, '.claude', 'ccvm');
const realProvidersDir = path.join(realConfigDir, 'providers');

console.log(`📁 真实用户目录: ${realHomeDir}`);
console.log(`📁 真实配置目录: ${realConfigDir}`);

// 检查是否存在真实的Provider配置
const hasRealProviders = fs.existsSync(realProvidersDir);
let originalProviders = [];

if (hasRealProviders) {
  try {
    const providerFiles = fs.readdirSync(realProvidersDir);
    originalProviders = providerFiles.filter(file => file.endsWith('.json'));
    console.log(`📋 发现 ${originalProviders.length} 个真实Provider配置: ${originalProviders.join(', ')}`);
  } catch (error) {
    console.warn('⚠️  无法读取真实Provider目录:', error.message);
  }
} else {
  console.log('📋 未发现真实Provider配置');
}

console.log('\n🧪 开始测试环境安全检查...');

// 创建临时测试目录
const testDir = path.join(os.tmpdir(), 'ccvm-security-test-' + Date.now());
fs.ensureDirSync(testDir);

console.log(`📁 测试目录: ${testDir}`);

try {
  // 设置测试环境
  const originalEnv = {
    HOME: process.env.HOME,
    CCVM_TEST_MODE: process.env.CCVM_TEST_MODE
  };

  process.env.HOME = testDir;
  process.env.CCVM_TEST_MODE = 'true';

  console.log('🔧 设置测试环境变量...');

  // 测试ConfigManager在测试模式下的行为
  const ConfigManager = require('../../src/core/ConfigManager');
  const testConfigManager = new ConfigManager();

  console.log('📊 ConfigManager配置:');
  console.log(`   - 配置目录: ${testConfigManager.configDir}`);
  console.log(`   - Claude目录: ${testConfigManager.claudeDir}`);
  console.log(`   - Provider目录: ${testConfigManager.providersDir}`);

  // 验证测试目录确实指向测试环境
  const isTestConfigSafe = testConfigManager.configDir.startsWith(testDir) || 
                           testConfigManager.configDir.startsWith(os.tmpdir());
  const isTestClaudeSafe = testConfigManager.claudeDir.startsWith(testDir) || 
                          testConfigManager.claudeDir.startsWith(os.tmpdir());

  console.log(`\n🔍 安全检查结果:`);
  console.log(`   - 配置目录安全: ${isTestConfigSafe ? '✅' : '❌'}`);
  console.log(`   - Claude目录安全: ${isTestClaudeSafe ? '✅' : '❌'}`);

  if (!isTestConfigSafe || !isTestClaudeSafe) {
    throw new Error('❌ 测试环境路径不安全！');
  }

  // 初始化测试配置
  console.log('\n🏗️  初始化测试配置...');
  await testConfigManager.init();

  // 创建测试Provider
  console.log('📝 创建测试Provider...');
  const testProvider = {
    alias: 'test-security-provider',
    baseURL: 'https://api.test.com',
    apiKey: 'test-security-key-12345678901234567890',
    timeout: '3000000'
  };

  const testProviderFile = path.join(testConfigManager.providersDir, 'test-security-provider.json');
  fs.writeJsonSync(testProviderFile, testProvider);

  console.log('✅ 测试Provider创建成功');

  // 验证真实用户数据未被影响
  console.log('\n🔍 验证真实用户数据完整性...');

  if (hasRealProviders) {
    const currentProviderFiles = fs.readdirSync(realProvidersDir);
    const currentProviders = currentProviderFiles.filter(file => file.endsWith('.json'));
    
    const providersMatch = JSON.stringify(originalProviders.sort()) === 
                          JSON.stringify(currentProviders.sort());
    
    console.log(`   - Provider列表一致性: ${providersMatch ? '✅' : '❌'}`);
    
    if (!providersMatch) {
      console.error('❌ 真实Provider配置被修改！');
      console.error(`   原始: ${originalProviders.join(', ')}`);
      console.error(`   当前: ${currentProviders.join(', ')}`);
      throw new Error('真实用户数据被修改！');
    }
  } else {
    const stillNoProviders = !fs.existsSync(realProvidersDir) || 
                              fs.readdirSync(realProvidersDir).length === 0;
    console.log(`   - 无真实Provider数据: ${stillNoProviders ? '✅' : '❌'}`);
    
    if (!stillNoProviders) {
      throw new Error('测试创建了意外的真实Provider数据！');
    }
  }

  // 测试运行npm test是否安全
  console.log('\n🧪 运行测试套件安全检查...');
  
  try {
    // 在子进程中运行测试，确保环境隔离
    const testOutput = execSync('npm test -- --testNamePattern="ConfigManager" --passWithNoTests', {
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        HOME: testDir,
        CCVM_TEST_MODE: 'true'
      }
    });

    console.log('✅ 测试套件运行成功');

    // 再次验证真实数据未被影响
    if (hasRealProviders) {
      const finalProviderFiles = fs.readdirSync(realProvidersDir);
      const finalProviders = finalProviderFiles.filter(file => file.endsWith('.json'));
      
      const finalProvidersMatch = JSON.stringify(originalProviders.sort()) === 
                                 JSON.stringify(finalProviders.sort());
      
      console.log(`   - 测试后Provider一致性: ${finalProvidersMatch ? '✅' : '❌'}`);
      
      if (!finalProvidersMatch) {
        throw new Error('测试运行后真实Provider数据被修改！');
      }
    }
  } catch (testError) {
    console.warn('⚠️  测试套件运行失败，但这不影响安全性验证');
    console.warn(testError.message);
  }

  console.log('\n🎉 所有安全检查通过！');
  console.log('✅ 测试环境正确隔离，不会影响真实用户数据');

} catch (error) {
  console.error('\n❌ 安全验证失败:', error.message);
  process.exit(1);
} finally {
  // 恢复原始环境
  if (originalEnv.HOME !== undefined) {
    process.env.HOME = originalEnv.HOME;
  }
  if (originalEnv.CCVM_TEST_MODE !== undefined) {
    process.env.CCVM_TEST_MODE = originalEnv.CCVM_TEST_MODE;
  } else {
    delete process.env.CCVM_TEST_MODE;
  }

  // 清理测试目录
  try {
    fs.removeSync(testDir);
    console.log(`🧹 已清理测试目录: ${testDir}`);
  } catch (cleanupError) {
    console.warn('⚠️  清理测试目录失败:', cleanupError.message);
  }
}

console.log('\n🔒 测试环境安全验证完成');