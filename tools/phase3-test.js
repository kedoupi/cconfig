#!/usr/bin/env node

/**
 * Phase 3 配置管理CLI测试
 * 测试完整的CLI功能和用户体验
 */

const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class Phase3Tester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log(chalk.blue('🧪 Phase 3 配置管理CLI测试\n'));
    
    try {
      // CLI框架测试
      await this.testCLIFramework();
      
      // Provider命令测试
      await this.testProviderCommands();
      
      // 配置存储测试
      await this.testConfigStorage();
      
      // 别名生成测试
      await this.testAliasGeneration();
      
      // 交互式配置测试
      await this.testInteractiveConfig();
      
      // 整体集成测试
      await this.testSystemIntegration();
      
      await this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red(`测试过程发生错误: ${error.message}`));
      return false;
    }
    
    return this.testResults.failed === 0;
  }

  /**
   * 测试CLI框架
   */
  async testCLIFramework() {
    console.log(chalk.yellow('🔧 测试CLI框架...'));
    
    const tests = [
      {
        name: 'CLI帮助信息',
        command: ['--help'],
        check: output => output.includes('Claude Code 配置工具集')
      },
      {
        name: 'CLI版本信息',
        command: ['--version'],
        check: output => /\d+\.\d+\.\d+/.test(output)
      },
      {
        name: 'Provider子命令',
        command: ['provider', '--help'],
        check: output => output.includes('服务商配置管理')
      },
      {
        name: 'Alias子命令',
        command: ['alias', '--help'],
        check: output => output.includes('别名配置管理')
      },
      {
        name: 'Status命令',
        command: ['status'],
        check: output => output.includes('Claude Code Kit 状态信息')
      }
    ];
    
    for (const test of tests) {
      try {
        const output = await this.runCommand(test.command);
        const passed = test.check(output);
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试Provider命令
   */
  async testProviderCommands() {
    console.log(chalk.yellow('\n📦 测试Provider命令...'));
    
    const tests = [
      {
        name: 'Provider列表命令',
        command: ['provider', 'list'],
        check: output => output.includes('服务商配置列表') || output.includes('尚未配置任何服务商')
      },
      {
        name: 'Provider统计命令',
        command: ['provider', 'stats'],
        check: output => output.includes('服务商统计信息')
      },
      {
        name: 'Provider别名重新生成',
        command: ['provider', 'regenerate-aliases'],
        check: output => output.includes('重新生成别名配置')
      }
    ];
    
    for (const test of tests) {
      try {
        const output = await this.runCommand(test.command);
        const passed = test.check(output);
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试配置存储
   */
  async testConfigStorage() {
    console.log(chalk.yellow('\n💾 测试配置存储...'));
    
    const tests = [
      {
        name: '配置目录初始化',
        command: ['init'],
        check: output => output.includes('配置初始化成功')
      },
      {
        name: '配置目录结构',
        check: async () => {
          const homeDir = require('os').homedir();
          const configDir = path.join(homeDir, '.cc-config');
          const providersDir = path.join(configDir, 'providers');
          
          return await fs.pathExists(configDir) && 
                 await fs.pathExists(providersDir);
        }
      }
    ];
    
    for (const test of tests) {
      try {
        let passed;
        if (test.command) {
          const output = await this.runCommand(test.command);
          passed = test.check(output);
        } else {
          passed = await test.check();
        }
        
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试别名生成
   */
  async testAliasGeneration() {
    console.log(chalk.yellow('\n⚡ 测试别名生成...'));
    
    const tests = [
      {
        name: '别名文件生成',
        command: ['alias', 'generate'],
        check: output => output.includes('别名配置生成成功')
      },
      {
        name: '别名统计信息',
        command: ['alias', 'stats'],
        check: output => output.includes('别名配置统计')
      },
      {
        name: '别名配置验证',
        command: ['alias', 'validate'],
        check: output => output.includes('验证别名配置')
      },
      {
        name: '别名文件存在',
        check: async () => {
          const homeDir = require('os').homedir();
          const aliasFile = path.join(homeDir, '.cc-config', 'aliases.sh');
          return await fs.pathExists(aliasFile);
        }
      }
    ];
    
    for (const test of tests) {
      try {
        let passed;
        if (test.command) {
          const output = await this.runCommand(test.command);
          passed = test.check(output);
        } else {
          passed = await test.check();
        }
        
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试交互式配置
   */
  async testInteractiveConfig() {
    console.log(chalk.yellow('\n🧙‍♂️ 测试交互式配置...'));
    
    const tests = [
      {
        name: '配置向导帮助',
        command: ['wizard', '--help'],
        check: output => output.includes('启动配置向导')
      },
      {
        name: 'Provider添加帮助',
        command: ['provider', 'add', '--help'],
        check: output => output.includes('添加新的服务商配置')
      },
      {
        name: 'Provider编辑帮助',
        command: ['provider', 'edit', '--help'],
        check: output => output.includes('编辑指定服务商配置')
      }
    ];
    
    for (const test of tests) {
      try {
        const output = await this.runCommand(test.command);
        const passed = test.check(output);
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试系统集成
   */
  async testSystemIntegration() {
    console.log(chalk.yellow('\n🔗 测试系统集成...'));
    
    const tests = [
      {
        name: '整体状态查看',
        command: ['status'],
        check: output => {
          return output.includes('配置目录') && 
                 output.includes('服务商统计') && 
                 output.includes('别名信息');
        }
      },
      {
        name: '备份命令可用',
        command: ['backup', '--help'],
        check: output => output.includes('配置备份管理')
      },
      {
        name: '部署命令可用', 
        command: ['deploy', '--help'],
        check: output => output.includes('配置模板部署管理')
      }
    ];
    
    for (const test of tests) {
      try {
        const output = await this.runCommand(test.command);
        const passed = test.check(output);
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 运行CLI命令
   */
  async runCommand(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['bin/cc-config.js', ...args], {
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
        if (code === 0 || output.length > 0) {
          resolve(output + error);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });
    });
  }

  logTest(icon, message, error = null) {
    console.log(`  ${icon} ${message}${error ? `: ${error}` : ''}`);
  }

  recordTest(name, passed, error = null) {
    this.testResults.tests.push({ name, passed, error });
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  async generateTestReport() {
    console.log(chalk.blue('\n📊 Phase 3 测试报告'));
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
          console.log(`  - ${test.name}: ${test.error || '检查失败'}`);
        });
    }
    
    // 保存详细报告
    const reportPath = path.join(__dirname, '../phase3-test-report.json');
    await fs.writeJson(reportPath, {
      timestamp: new Date().toISOString(),
      phase: 'Phase 3 - 配置管理CLI',
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
      console.log(chalk.green('\n🎉 Phase 3 所有测试通过！配置管理CLI功能完整。'));
    } else {
      console.log(chalk.yellow('\n⚠️ 部分测试失败，请检查相关功能。'));
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new Phase3Tester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Phase 3测试异常:', error.message));
      process.exit(1);
    });
}

module.exports = { Phase3Tester };