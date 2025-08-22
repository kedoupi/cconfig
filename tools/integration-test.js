#!/usr/bin/env node

/**
 * 集成测试 - 测试核心安装系统功能
 * 使用真实的命令和模块进行测试
 */

const { deploy } = require('../src/commands/deploy');
const ConfigManager = require('../src/core/ConfigManager');
const AliasGenerator = require('../src/core/AliasGenerator');
const ConfigStorage = require('../src/core/ConfigStorage');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class IntegrationTester {
  constructor() {
    this.testDir = path.join(__dirname, '../tmp-integration-test');
    this.originalHome = process.env.HOME;
    this.results = [];
  }

  async runTests() {
    console.log(chalk.blue('🔬 Phase 2 集成测试 - 核心安装系统\n'));
    
    try {
      await this.setupTestEnvironment();
      
      // 测试核心安装系统功能
      await this.testConfigManagerInit();
      await this.testConfigStorage();
      await this.testAliasGeneration();
      await this.testDeployFunction();
      await this.testTemplateSystem();
      
      this.printResults();
      
    } catch (error) {
      console.error(chalk.red(`集成测试失败: ${error.message}`));
      return false;
    } finally {
      await this.cleanup();
    }
    
    return this.results.every(r => r.passed);
  }

  async setupTestEnvironment() {
    console.log(chalk.yellow('🔧 设置测试环境...'));
    
    await fs.ensureDir(this.testDir);
    process.env.HOME = this.testDir;
    
    console.log(chalk.green('✅ 测试环境设置完成\n'));
  }

  async testConfigManagerInit() {
    console.log(chalk.cyan('📋 测试 ConfigManager 初始化...'));
    
    try {
      const configManager = new ConfigManager();
      await configManager.initialize();
      
      const paths = configManager.getPaths();
      
      // 验证路径配置
      this.assert(
        '配置路径设置正确',
        paths.configDir && paths.providersDir && paths.backupDir
      );
      
      // 验证目录创建
      this.assert(
        '.cc-config目录已创建',
        await fs.pathExists(paths.configDir)
      );
      
      this.assert(
        'providers目录已创建',
        await fs.pathExists(paths.providersDir)
      );
      
      console.log(chalk.green('✅ ConfigManager 测试通过\n'));
      
    } catch (error) {
      this.recordTest('ConfigManager初始化', false, error.message);
    }
  }

  async testConfigStorage() {
    console.log(chalk.cyan('💾 测试 ConfigStorage 功能...'));
    
    try {
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      
      // 测试服务商配置
      const testConfig = {
        name: 'Test Provider',
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key-12345',
        enabled: true
      };
      
      // 保存配置
      await configStorage.writeProvider('test', testConfig);
      
      // 读取配置
      const savedConfig = await configStorage.readProvider('test');
      
      this.assert(
        '服务商配置保存和读取',
        savedConfig && savedConfig.name === testConfig.name
      );
      
      // 测试列表功能
      const providers = await configStorage.listProviders();
      
      this.assert(
        '服务商列表功能',
        providers && providers.test
      );
      
      console.log(chalk.green('✅ ConfigStorage 测试通过\n'));
      
    } catch (error) {
      this.recordTest('ConfigStorage功能', false, error.message);
    }
  }

  async testAliasGeneration() {
    console.log(chalk.cyan('⚡ 测试别名生成功能...'));
    
    try {
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      
      // 添加测试配置
      await configStorage.writeProvider('test', {
        name: 'Test Provider',
        alias: 'test',
        baseURL: 'https://api.test.com',
        apiKey: 'test-key',
        enabled: true
      });
      
      const aliasGenerator = new AliasGenerator(configStorage);
      
      // 生成别名脚本
      const script = await aliasGenerator.generateAliases();
      
      this.assert(
        '别名脚本生成',
        script && script.includes('#!/bin/bash')
      );
      
      this.assert(
        '别名脚本包含服务商',
        script.includes('test')
      );
      
      // 测试Shell检测
      const shell = aliasGenerator.detectShell();
      
      this.assert(
        'Shell类型检测',
        ['bash', 'zsh', 'fish'].includes(shell)
      );
      
      console.log(chalk.green('✅ 别名生成测试通过\n'));
      
    } catch (error) {
      this.recordTest('别名生成功能', false, error.message);
    }
  }

  async testDeployFunction() {
    console.log(chalk.cyan('🚀 测试部署功能...'));
    
    try {
      // 模拟已安装的目录结构
      const installDir = path.join(this.testDir, '.cc-config');
      const templatesDir = path.join(installDir, '.claude-templates');
      
      await fs.ensureDir(templatesDir);
      
      // 复制真实模板
      const sourceTemplates = path.join(__dirname, '../.claude-templates');
      if (await fs.pathExists(sourceTemplates)) {
        await fs.copy(sourceTemplates, templatesDir);
      }
      
      // 测试部署功能 (使用内置模板)
      await deploy({ 
        template: 'minimal', 
        force: true, 
        overwrite: true 
      });
      
      // 验证部署结果
      const claudeDir = path.join(this.testDir, '.claude');
      
      this.assert(
        '.claude目录已创建',
        await fs.pathExists(claudeDir)
      );
      
      console.log(chalk.green('✅ 部署功能测试通过\n'));
      
    } catch (error) {
      this.recordTest('部署功能', false, error.message);
    }
  }

  async testTemplateSystem() {
    console.log(chalk.cyan('🎨 测试模板系统...'));
    
    try {
      const templatesDir = path.join(__dirname, '../.claude-templates');
      
      // 验证模板文件存在
      this.assert(
        'settings.json模板存在',
        await fs.pathExists(path.join(templatesDir, 'settings.json'))
      );
      
      this.assert(
        'CLAUDE.md模板存在',
        await fs.pathExists(path.join(templatesDir, 'CLAUDE.md'))
      );
      
      this.assert(
        'commands目录存在',
        await fs.pathExists(path.join(templatesDir, 'commands'))
      );
      
      this.assert(
        'agents目录存在',
        await fs.pathExists(path.join(templatesDir, 'agents'))
      );
      
      this.assert(
        'output-styles目录存在',
        await fs.pathExists(path.join(templatesDir, 'output-styles'))
      );
      
      // 验证模板内容
      const settingsTemplate = await fs.readJson(path.join(templatesDir, 'settings.json'));
      
      this.assert(
        'settings.json模板格式正确',
        settingsTemplate && settingsTemplate.providers !== undefined
      );
      
      console.log(chalk.green('✅ 模板系统测试通过\n'));
      
    } catch (error) {
      this.recordTest('模板系统', false, error.message);
    }
  }

  assert(description, condition) {
    this.recordTest(description, condition);
    if (condition) {
      console.log(chalk.green(`  ✅ ${description}`));
    } else {
      console.log(chalk.red(`  ❌ ${description}`));
    }
  }

  recordTest(name, passed, error = null) {
    this.results.push({ name, passed, error });
  }

  printResults() {
    console.log(chalk.blue('📊 集成测试结果汇总'));
    console.log('='.repeat(50));
    
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    
    console.log(`总测试数: ${total}`);
    console.log(chalk.green(`通过: ${passed}`));
    console.log(chalk.red(`失败: ${failed}`));
    
    const passRate = ((passed / total) * 100).toFixed(1);
    console.log(`通过率: ${passRate}%`);
    
    if (failed > 0) {
      console.log(chalk.red('\n❌ 失败的测试:'));
      this.results
        .filter(r => !r.passed)
        .forEach(test => {
          console.log(`  - ${test.name}${test.error ? ': ' + test.error : ''}`);
        });
    }
    
    console.log();
    
    if (failed === 0) {
      console.log(chalk.green('🎉 所有集成测试通过！Phase 2 核心安装系统功能正常。'));
    } else {
      console.log(chalk.yellow('⚠️ 部分测试失败，请检查相关功能。'));
    }
  }

  async cleanup() {
    process.env.HOME = this.originalHome;
    
    try {
      await fs.remove(this.testDir);
      console.log(chalk.gray('🧹 测试环境已清理'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ 清理失败: ${error.message}`));
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('集成测试异常:', error.message));
      process.exit(1);
    });
}

module.exports = { IntegrationTester };