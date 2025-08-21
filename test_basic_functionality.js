#!/usr/bin/env node

/**
 * 基本功能测试脚本
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function runCommand(args = [], input = '', env = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', ['bin/cc-config.js', ...args], {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, ...env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function test(name, testFn) {
  try {
    console.log(`\n🧪 测试: ${name}`);
    await testFn();
    console.log(`✅ 通过: ${name}`);
  } catch (error) {
    console.log(`❌ 失败: ${name}`);
    console.log(`   错误: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('🚀 开始基本功能测试\n');
  
  let passed = 0;
  let total = 0;

  // 测试1: 版本命令
  total++;
  if (await test('版本命令', async () => {
    const result = await runCommand(['--version']);
    if (!result.stdout.includes('1.0.0')) {
      throw new Error('版本信息不正确');
    }
  })) passed++;

  // 测试2: 帮助命令
  total++;
  if (await test('帮助命令', async () => {
    const result = await runCommand(['--help']);
    if (!result.stdout.includes('Claude Code 配置工具集')) {
      throw new Error('帮助信息不正确');
    }
  })) passed++;

  // 测试3: 初始化配置
  total++;
  if (await test('初始化配置', async () => {
    // 使用临时目录进行测试
    const tempDir = path.join(os.tmpdir(), 'cc-config-test-' + Date.now());
    await fs.ensureDir(tempDir);
    
    const result = await runCommand(['init'], '', { HOME: tempDir });
    
    // 检查配置目录是否创建
    const configDir = path.join(tempDir, '.cc-config');
    if (!await fs.exists(configDir)) {
      throw new Error('配置目录未创建');
    }
    
    // 清理
    await fs.remove(tempDir);
  })) passed++;

  // 测试4: 状态命令
  total++;
  if (await test('状态命令', async () => {
    const result = await runCommand(['status']);
    if (!result.stdout.includes('Claude Code Kit 状态信息')) {
      throw new Error('状态信息不正确');
    }
  })) passed++;

  // 测试5: 服务商列表
  total++;
  if (await test('服务商列表', async () => {
    const result = await runCommand(['provider', 'list']);
    if (!result.stdout.includes('尚未配置任何服务商')) {
      throw new Error('服务商列表输出不正确');
    }
  })) passed++;

  console.log(`\n📊 测试结果: ${passed}/${total} 通过`);
  
  if (passed === total) {
    console.log('🎉 所有基本功能测试通过！');
    return true;
  } else {
    console.log('❌ 部分测试失败，需要修复');
    return false;
  }
}

// 运行测试
main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});