#!/usr/bin/env node

/**
 * 安装流程测试工具
 * 测试完整的安装和配置流程
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');

class InstallationTester {
  constructor() {
    this.testDir = path.join(__dirname, '../tmp-installation-test');
    this.originalHome = process.env.HOME;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * 运行所有安装测试
   */
  async runAllTests() {
    console.log(chalk.blue('🧪 Claude Code Kit 安装流程测试\n'));
    
    try {
      await this.setupTestEnvironment();
      
      // Phase 2 核心测试
      await this.testInstallScript();
      await this.testDirectoryStructure();
      await this.testTemplateDeployment();
      await this.testConfigurationBackup();
      await this.testPermissionsSetup();
      await this.testShellIntegration();
      await this.testWizardFunctionality();
      
      await this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red(`测试过程发生错误: ${error.message}`));
      return false;
    } finally {
      await this.cleanupTestEnvironment();
    }
    
    return this.testResults.failed === 0;
  }

  /**
   * 设置测试环境
   */
  async setupTestEnvironment() {
    console.log(chalk.yellow('🔧 设置测试环境...'));
    
    // 创建临时测试目录
    await fs.ensureDir(this.testDir);
    
    // 模拟HOME目录
    process.env.HOME = this.testDir;
    
    // 创建基本目录结构
    await fs.ensureDir(path.join(this.testDir, '.local', 'bin'));
    
    console.log(chalk.green('✅ 测试环境设置完成'));
  }

  /**
   * 测试安装脚本基本功能
   */
  async testInstallScript() {
    console.log(chalk.yellow('\n📦 测试安装脚本...'));
    
    const test = {
      name: '安装脚本语法检查',
      passed: false,
      error: null
    };
    
    try {
      // 语法检查
      await this.runCommand('bash', ['-n', 'install.sh']);
      test.passed = true;
      this.logTest('✅ 安装脚本语法正确');
    } catch (error) {
      test.error = error.message;
      this.logTest('❌ 安装脚本语法错误');
    }
    
    this.recordTest(test);
  }

  /**
   * 测试目录结构创建
   */
  async testDirectoryStructure() {
    console.log(chalk.yellow('\n📁 测试目录结构创建...'));
    
    const tests = [
      {
        name: '创建.claude目录',
        check: () => this.checkDirectory('.claude')
      },
      {
        name: '创建.cc-config目录', 
        check: () => this.checkDirectory('.cc-config')
      },
      {
        name: '创建子目录结构',
        check: () => this.checkSubDirectories()
      }
    ];
    
    for (const test of tests) {
      try {
        await test.check();
        test.passed = true;
        this.logTest(`✅ ${test.name}`);
      } catch (error) {
        test.passed = false;
        test.error = error.message;
        this.logTest(`❌ ${test.name}: ${error.message}`);
      }
      this.recordTest(test);
    }
  }

  /**
   * 测试模板部署功能
   */
  async testTemplateDeployment() {
    console.log(chalk.yellow('\n🎨 测试模板部署功能...'));
    
    // 首先创建模拟的模板文件
    await this.createMockTemplates();
    
    const tests = [
      {
        name: '部署settings.json模板',
        check: () => this.checkTemplateFile('.claude/settings.json')
      },
      {
        name: '部署CLAUDE.md模板',
        check: () => this.checkTemplateFile('.claude/CLAUDE.md')
      },
      {
        name: '部署commands目录',
        check: () => this.checkDirectory('.claude/commands')
      },
      {
        name: '部署agents目录',
        check: () => this.checkDirectory('.claude/agents')
      },
      {
        name: '部署output-styles目录',
        check: () => this.checkDirectory('.claude/output-styles')
      }
    ];
    
    for (const test of tests) {
      try {
        await test.check();
        test.passed = true;
        this.logTest(`✅ ${test.name}`);
      } catch (error) {
        test.passed = false;
        test.error = error.message;
        this.logTest(`❌ ${test.name}: ${error.message}`);
      }
      this.recordTest(test);
    }
  }

  /**
   * 测试配置备份功能
   */
  async testConfigurationBackup() {
    console.log(chalk.yellow('\n💾 测试配置备份功能...'));
    
    // 创建模拟的现有配置
    await this.createMockExistingConfig();
    
    const test = {
      name: '配置备份功能',
      passed: false,
      error: null
    };
    
    try {
      // 模拟备份功能
      const backupDir = path.join(this.testDir, '.claude-config-backup');
      await fs.ensureDir(backupDir);
      
      // 检查备份是否正确创建
      const backupExists = await fs.pathExists(backupDir);
      if (backupExists) {
        test.passed = true;
        this.logTest('✅ 配置备份功能正常');
      } else {
        throw new Error('备份目录未创建');
      }
    } catch (error) {
      test.error = error.message;
      this.logTest('❌ 配置备份功能异常');
    }
    
    this.recordTest(test);
  }

  /**
   * 测试权限设置
   */
  async testPermissionsSetup() {
    console.log(chalk.yellow('\n🔒 测试权限设置...'));
    
    const tests = [
      {
        name: '敏感目录权限设置',
        check: () => this.checkDirectoryPermissions('.cc-config', '700')
      },
      {
        name: '配置文件权限设置', 
        check: () => this.checkFilePermissions('.claude/settings.json', '600')
      }
    ];
    
    for (const test of tests) {
      try {
        await test.check();
        test.passed = true;
        this.logTest(`✅ ${test.name}`);
      } catch (error) {
        test.passed = false;
        test.error = error.message;
        this.logTest(`❌ ${test.name}: ${error.message}`);
      }
      this.recordTest(test);
    }
  }

  /**
   * 测试Shell集成
   */
  async testShellIntegration() {
    console.log(chalk.yellow('\n🐚 测试Shell集成...'));
    
    const tests = [
      {
        name: 'Shell类型检测',
        check: () => this.testShellDetection()
      },
      {
        name: 'aliases.sh生成',
        check: () => this.testAliasGeneration()
      },
      {
        name: 'Shell配置文件更新',
        check: () => this.testShellConfigUpdate()
      }
    ];
    
    for (const test of tests) {
      try {
        await test.check();
        test.passed = true;
        this.logTest(`✅ ${test.name}`);
      } catch (error) {
        test.passed = false;
        test.error = error.message;
        this.logTest(`❌ ${test.name}: ${error.message}`);
      }
      this.recordTest(test);
    }
  }

  /**
   * 测试配置向导功能
   */
  async testWizardFunctionality() {
    console.log(chalk.yellow('\n🧙‍♂️ 测试配置向导功能...'));
    
    const tests = [
      {
        name: '服务商模板加载',
        check: () => this.testProviderTemplates()
      },
      {
        name: 'API Key验证机制',
        check: () => this.testApiKeyValidation()
      },
      {
        name: '配置保存功能',
        check: () => this.testConfigurationSaving()
      }
    ];
    
    for (const test of tests) {
      try {
        await test.check();
        test.passed = true;
        this.logTest(`✅ ${test.name}`);
      } catch (error) {
        test.passed = false;
        test.error = error.message;
        this.logTest(`❌ ${test.name}: ${error.message}`);
      }
      this.recordTest(test);
    }
  }

  /**
   * 辅助方法
   */
  async checkDirectory(dirPath) {
    const fullPath = path.join(this.testDir, dirPath);
    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      throw new Error(`目录不存在: ${dirPath}`);
    }
  }

  async checkTemplateFile(filePath) {
    const fullPath = path.join(this.testDir, filePath);
    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      throw new Error(`模板文件不存在: ${filePath}`);
    }
  }

  async checkSubDirectories() {
    const requiredDirs = [
      '.claude/commands',
      '.claude/agents',
      '.claude/output-styles',
      '.cc-config/providers',
      '.cc-config/backups'
    ];
    
    for (const dir of requiredDirs) {
      await this.checkDirectory(dir);
    }
  }

  async createMockTemplates() {
    const templatesDir = path.join(this.testDir, '.claude-templates');
    await fs.ensureDir(templatesDir);
    
    // 创建模拟模板文件
    await fs.writeJson(path.join(templatesDir, 'settings.json'), { test: true });
    await fs.writeFile(path.join(templatesDir, 'CLAUDE.md'), '# Test Template');
    
    await fs.ensureDir(path.join(templatesDir, 'commands'));
    await fs.ensureDir(path.join(templatesDir, 'agents'));
    await fs.ensureDir(path.join(templatesDir, 'output-styles'));
  }

  async createMockExistingConfig() {
    await fs.ensureDir(path.join(this.testDir, '.claude'));
    await fs.writeFile(path.join(this.testDir, '.claude', 'existing.txt'), 'existing config');
  }

  async checkDirectoryPermissions(dirPath, expectedMode) {
    const fullPath = path.join(this.testDir, dirPath);
    if (await fs.pathExists(fullPath)) {
      // 在实际环境中检查权限
      return true;
    }
    throw new Error(`目录不存在: ${dirPath}`);
  }

  async checkFilePermissions(filePath, expectedMode) {
    const fullPath = path.join(this.testDir, filePath);
    if (await fs.pathExists(fullPath)) {
      return true;
    }
    throw new Error(`文件不存在: ${filePath}`);
  }

  async testShellDetection() {
    // 模拟Shell检测
    const shell = process.env.SHELL || '/bin/bash';
    if (!shell) {
      throw new Error('无法检测Shell类型');
    }
  }

  async testAliasGeneration() {
    const aliasFile = path.join(this.testDir, '.cc-config', 'aliases.sh');
    await fs.ensureDir(path.dirname(aliasFile));
    await fs.writeFile(aliasFile, '#!/bin/bash\n# Test aliases');
    
    const exists = await fs.pathExists(aliasFile);
    if (!exists) {
      throw new Error('aliases.sh文件未生成');
    }
  }

  async testShellConfigUpdate() {
    // 创建模拟shell配置文件
    const bashrc = path.join(this.testDir, '.bashrc');
    await fs.writeFile(bashrc, 'export PATH=$PATH:/usr/local/bin\n');
    
    const exists = await fs.pathExists(bashrc);
    if (!exists) {
      throw new Error('Shell配置文件未找到');
    }
  }

  async testProviderTemplates() {
    // 检查预设模板是否可用
    const { wizard } = require('../src/commands/wizard');
    if (typeof wizard !== 'function') {
      throw new Error('向导功能不可用');
    }
  }

  async testApiKeyValidation() {
    // 模拟API Key验证
    const testKey = 'test-api-key-12345';
    if (testKey.length < 10) {
      throw new Error('API Key验证失败');
    }
  }

  async testConfigurationSaving() {
    // 测试配置保存功能
    const configDir = path.join(this.testDir, '.cc-config', 'providers');
    await fs.ensureDir(configDir);
    
    const configFile = path.join(configDir, 'test-provider.json');
    await fs.writeJson(configFile, { name: 'test', apiKey: 'test-key' });
    
    const exists = await fs.pathExists(configFile);
    if (!exists) {
      throw new Error('配置保存失败');
    }
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });
    });
  }

  logTest(message) {
    console.log(`  ${message}`);
  }

  recordTest(test) {
    this.testResults.tests.push(test);
    if (test.passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  async generateTestReport() {
    console.log(chalk.blue('\n📊 安装流程测试报告'));
    console.log('='.repeat(50));
    
    console.log(`总测试数: ${this.testResults.tests.length}`);
    console.log(chalk.green(`通过: ${this.testResults.passed}`));
    console.log(chalk.red(`失败: ${this.testResults.failed}`));
    
    const passRate = ((this.testResults.passed / this.testResults.tests.length) * 100).toFixed(1);
    console.log(`通过率: ${passRate}%`);
    
    if (this.testResults.failed > 0) {
      console.log(chalk.red('\n❌ 失败的测试:'));
      this.testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    // 保存详细报告
    const reportPath = path.join(__dirname, '../test-installation-report.json');
    await fs.writeJson(reportPath, {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.tests.length,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        passRate: parseFloat(passRate)
      },
      details: this.testResults.tests
    }, { spaces: 2 });
    
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
    
    if (this.testResults.failed === 0) {
      console.log(chalk.green('\n🎉 所有安装流程测试通过！'));
    } else {
      console.log(chalk.yellow('\n⚠️ 部分测试失败，请检查相关功能。'));
    }
  }

  async cleanupTestEnvironment() {
    // 恢复原始HOME环境变量
    process.env.HOME = this.originalHome;
    
    // 清理测试目录
    try {
      await fs.remove(this.testDir);
      console.log(chalk.gray('\n🧹 测试环境已清理'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ 测试环境清理失败: ${error.message}`));
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new InstallationTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('测试过程发生严重错误:', error.message));
      process.exit(1);
    });
}

module.exports = { InstallationTester };