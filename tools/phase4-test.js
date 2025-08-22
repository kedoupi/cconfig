#!/usr/bin/env node

/**
 * Phase 4 配置更新系统测试
 * 测试版本管理、更新命令和安全机制
 */

const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class Phase4Tester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log(chalk.blue('🧪 Phase 4 配置更新系统测试\n'));
    
    try {
      // 版本管理测试
      await this.testVersionManagement();
      
      // Update命令测试
      await this.testUpdateCommands();
      
      // 安全机制测试
      await this.testSecurityMechanisms();
      
      // 集成测试
      await this.testSystemIntegration();
      
      await this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red(`测试过程发生错误: ${error.message}`));
      return false;
    }
    
    return this.testResults.failed === 0;
  }

  /**
   * 测试版本管理
   */
  async testVersionManagement() {
    console.log(chalk.yellow('📋 测试版本管理...'));
    
    const tests = [
      {
        name: 'VersionManager类实例化',
        check: async () => {
          const VersionManager = require('../src/core/VersionManager');
          const versionManager = new VersionManager();
          return versionManager instanceof VersionManager;
        }
      },
      {
        name: 'VersionManager初始化',
        check: async () => {
          const VersionManager = require('../src/core/VersionManager');
          const versionManager = new VersionManager();
          await versionManager.initialize();
          return true;
        }
      },
      {
        name: '版本比较功能',
        check: async () => {
          const VersionManager = require('../src/core/VersionManager');
          const versionManager = new VersionManager();
          
          // 测试版本比较逻辑
          const result1 = versionManager.compareVersions('1.1.0', '1.0.0');
          const result2 = versionManager.compareVersions('1.0.0', '1.1.0');
          const result3 = versionManager.compareVersions('1.0.0', '1.0.0');
          
          return result1 > 0 && result2 < 0 && result3 === 0;
        }
      },
      {
        name: '版本状态获取',
        check: async () => {
          const VersionManager = require('../src/core/VersionManager');
          const versionManager = new VersionManager();
          await versionManager.initialize();
          
          const status = await versionManager.getVersionStatus();
          return status && status.currentVersion && status.lastCheck;
        }
      }
    ];
    
    for (const test of tests) {
      try {
        const passed = await test.check();
        this.recordTest(test.name, passed);
        this.logTest(passed ? '✅' : '❌', test.name);
      } catch (error) {
        this.recordTest(test.name, false, error.message);
        this.logTest('❌', test.name, error.message);
      }
    }
  }

  /**
   * 测试Update命令
   */
  async testUpdateCommands() {
    console.log(chalk.yellow('\n🔄 测试Update命令...'));
    
    const tests = [
      {
        name: 'Update命令帮助信息',
        command: ['update', '--help'],
        check: output => output.includes('检查和下载配置更新')
      },
      {
        name: 'Version命令功能',
        command: ['version'],
        check: output => output.includes('Claude Code Kit 版本信息')
      },
      {
        name: 'Update检查参数',
        command: ['update', '--help'],
        check: output => {
          return output.includes('--check') && 
                 output.includes('--force') && 
                 output.includes('--dry-run');
        }
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
   * 测试安全机制
   */
  async testSecurityMechanisms() {
    console.log(chalk.yellow('\n🔒 测试安全机制...'));
    
    const tests = [
      {
        name: 'SecurityManager类实例化',
        check: async () => {
          const SecurityManager = require('../src/core/SecurityManager');
          const securityManager = new SecurityManager();
          return securityManager instanceof SecurityManager;
        }
      },
      {
        name: 'SecurityManager初始化',
        check: async () => {
          const SecurityManager = require('../src/core/SecurityManager');
          const securityManager = new SecurityManager();
          await securityManager.initialize();
          return true;
        }
      },
      {
        name: 'URL安全验证',
        check: async () => {
          const SecurityManager = require('../src/core/SecurityManager');
          const securityManager = new SecurityManager();
          
          const validResult = await securityManager.verifyDownloadUrl('https://raw.githubusercontent.com/test/repo/main/file.json');
          const invalidResult = await securityManager.verifyDownloadUrl('http://malicious.com/file.json');
          
          return validResult.valid && !invalidResult.valid;
        }
      },
      {
        name: '文件校验和计算',
        check: async () => {
          const SecurityManager = require('../src/core/SecurityManager');
          const securityManager = new SecurityManager();
          
          // 创建测试文件
          const testFile = path.join(__dirname, '../tmp-test-checksum.txt');
          await fs.writeFile(testFile, 'test content');
          
          const checksum = await securityManager.calculateFileChecksum(testFile);
          
          // 清理测试文件
          await fs.remove(testFile);
          
          return typeof checksum === 'string' && checksum.length === 64; // SHA256 hex
        }
      },
      {
        name: '回滚点创建',
        check: async () => {
          const SecurityManager = require('../src/core/SecurityManager');
          const securityManager = new SecurityManager();
          await securityManager.initialize();
          
          const rollback = await securityManager.createRollbackPoint('测试回滚点');
          return rollback && rollback.timestamp && rollback.path;
        }
      }
    ];
    
    for (const test of tests) {
      try {
        const passed = await test.check();
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
        name: '配置目录结构完整性',
        check: async () => {
          const homeDir = require('os').homedir();
          const configDir = path.join(homeDir, '.cc-config');
          
          const requiredDirs = [
            configDir,
            path.join(configDir, 'providers'),
            path.join(configDir, 'backups')
          ];
          
          for (const dir of requiredDirs) {
            if (!await fs.pathExists(dir)) {
              return false;
            }
          }
          
          return true;
        }
      },
      {
        name: '核心模块互操作性',
        check: async () => {
          const VersionManager = require('../src/core/VersionManager');
          const SecurityManager = require('../src/core/SecurityManager');
          const BackupManager = require('../src/core/BackupManager');
          
          const versionManager = new VersionManager();
          const securityManager = new SecurityManager();
          const backupManager = new BackupManager();
          
          await versionManager.initialize();
          await securityManager.initialize();
          
          return true;
        }
      },
      {
        name: '命令行界面完整性',
        command: ['--help'],
        check: output => {
          const expectedCommands = [
            'provider', 'alias', 'backup', 'deploy', 
            'init', 'wizard', 'status', 'update', 'version', 'history'
          ];
          
          return expectedCommands.every(cmd => output.includes(cmd));
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
    console.log(chalk.blue('\n📊 Phase 4 测试报告'));
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
    const reportPath = path.join(__dirname, '../phase4-test-report.json');
    await fs.writeJson(reportPath, {
      timestamp: new Date().toISOString(),
      phase: 'Phase 4 - 配置更新系统',
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
      console.log(chalk.green('\n🎉 Phase 4 所有测试通过！配置更新系统功能完整。'));
    } else {
      console.log(chalk.yellow('\n⚠️ 部分测试失败，请检查相关功能。'));
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new Phase4Tester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Phase 4测试异常:', error.message));
      process.exit(1);
    });
}

module.exports = { Phase4Tester };