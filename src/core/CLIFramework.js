const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const { Command } = require('commander');
const pkg = require('../../package.json');

/**
 * CLI 框架核心类
 * 管理配置目录、日志、错误处理和命令注册
 */
class CLIFramework {
  constructor(options = {}) {
    this.name = options.name || 'cc-config';
    this.description = options.description || 'Claude Code 配置工具集';
    this.version = pkg.version;
    
    // 初始化 Commander 程序
    this.program = new Command();
    this.setupProgram();
    
    // 配置路径
    this.configDir = path.join(os.homedir(), '.cc-config');
    this.logDir = path.join(this.configDir, 'logs');
    this.cacheDir = path.join(this.configDir, 'cache');
    
    // 日志配置
    this.logLevel = options.logLevel || 'info';
    this.enableFileLogging = options.enableFileLogging !== false;
    
    // 初始化标志
    this.initialized = false;
  }

  /**
   * 设置主程序配置
   */
  setupProgram() {
    this.program
      .name(this.name)
      .description(this.description)
      .version(this.version, '-v, --version', '显示版本号')
      .option('-q, --quiet', '静默模式，减少输出')
      .option('-V, --verbose', '详细模式，显示更多信息')
      .option('--debug', '调试模式，显示调试信息')
      .option('--no-color', '禁用彩色输出')
      .option('--config-dir <path>', '指定配置目录路径', this.configDir);

    // 设置全局选项处理
    this.program.hook('preAction', (thisCommand, actionCommand) => {
      this.processGlobalOptions(actionCommand.opts());
    });
  }

  /**
   * 处理全局选项
   */
  processGlobalOptions(options) {
    // 设置日志级别
    if (options.quiet) {
      this.logLevel = 'error';
    } else if (options.verbose) {
      this.logLevel = 'debug';
    } else if (options.debug) {
      this.logLevel = 'debug';
      process.env.DEBUG = 'cc-config:*';
    }

    // 设置配置目录
    if (options.configDir) {
      this.configDir = path.resolve(options.configDir);
      this.logDir = path.join(this.configDir, 'logs');
      this.cacheDir = path.join(this.configDir, 'cache');
    }

    // 设置彩色输出
    if (options.noColor) {
      chalk.level = 0;
    }
  }

  /**
   * 初始化 CLI 环境
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建必要的目录
      await this.ensureDirectories();
      
      // 初始化日志系统
      if (this.enableFileLogging) {
        await this.initializeLogging();
      }
      
      // 设置进程信号处理
      this.setupSignalHandlers();
      
      this.initialized = true;
      this.log('debug', `CLI Framework initialized: ${this.configDir}`);
      
    } catch (error) {
      this.log('error', `Failed to initialize CLI: ${error.message}`);
      throw error;
    }
  }

  /**
   * 确保必要的目录存在
   */
  async ensureDirectories() {
    const directories = [
      this.configDir,
      this.logDir,
      this.cacheDir,
      path.join(this.configDir, 'providers'),
      path.join(this.configDir, 'backups'),
      path.join(this.configDir, 'templates'),
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
      await fs.chmod(dir, 0o700); // 仅用户可访问
    }
  }

  /**
   * 初始化日志系统
   */
  async initializeLogging() {
    this.logFile = path.join(this.logDir, 'cc-config.log');
    
    // 日志轮转：保留最近7天的日志
    await this.rotateLogFiles();
  }

  /**
   * 日志轮转
   */
  async rotateLogFiles() {
    try {
      const logFiles = await fs.readdir(this.logDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

      for (const file of logFiles) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.remove(filePath);
            this.log('debug', `Rotated old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      // 忽略日志轮转错误，不影响主要功能
    }
  }

  /**
   * 日志记录
   */
  log(level, message, data = null) {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex > currentLevelIndex) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // 控制台输出
    this.outputToConsole(level, message, data);
    
    // 文件日志
    if (this.enableFileLogging && this.logFile) {
      const fileMessage = data 
        ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
        : `${logMessage}\n`;
      
      fs.appendFile(this.logFile, fileMessage).catch(() => {
        // 忽略文件写入错误
      });
    }
  }

  /**
   * 控制台输出
   */
  outputToConsole(level, message, data) {
    let coloredMessage;
    
    switch (level) {
      case 'error':
        coloredMessage = chalk.red(`❌ ${message}`);
        break;
      case 'warn':
        coloredMessage = chalk.yellow(`⚠️  ${message}`);
        break;
      case 'info':
        coloredMessage = chalk.blue(`ℹ️  ${message}`);
        break;
      case 'debug':
        coloredMessage = chalk.gray(`🐛 ${message}`);
        break;
      default:
        coloredMessage = message;
    }

    console.log(coloredMessage);
    
    if (data && this.logLevel === 'debug') {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  /**
   * 设置进程信号处理
   */
  setupSignalHandlers() {
    const cleanup = () => {
      this.log('info', 'Shutting down gracefully...');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.log('error', 'Uncaught Exception', { 
        message: error.message,
        stack: error.stack 
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.log('error', 'Unhandled Promise Rejection', {
        reason: reason.toString(),
        promise: promise.toString()
      });
      process.exit(1);
    });
  }

  /**
   * 注册命令
   */
  command(name) {
    return this.program.command(name);
  }

  /**
   * 注册命令组
   */
  commandGroup(name, description) {
    const cmd = this.program
      .command(name)
      .description(description);
    
    // 为命令组添加通用选项
    cmd.option('-f, --force', '强制执行，跳过确认');
    cmd.option('-y, --yes', '对所有询问回答是');
    
    return cmd;
  }

  /**
   * 添加帮助信息
   */
  addHelpText(position, text) {
    this.program.addHelpText(position, text);
  }

  /**
   * 设置帮助配置
   */
  configureHelp(configuration) {
    this.program.configureHelp(configuration);
  }

  /**
   * 添加全局错误处理
   */
  addErrorHandler(handler) {
    this.program.exitOverride();
    
    const originalParse = this.program.parse;
    this.program.parse = async (...args) => {
      try {
        await this.initialize();
        return originalParse.apply(this.program, args);
      } catch (error) {
        if (handler) {
          handler(error);
        } else {
          this.log('error', `Command failed: ${error.message}`, {
            stack: error.stack
          });
          process.exit(1);
        }
      }
    };
  }

  /**
   * 解析命令行参数
   */
  async parse(argv) {
    await this.initialize();
    return this.program.parse(argv);
  }

  /**
   * 解析命令行参数（异步）
   */
  async parseAsync(argv) {
    await this.initialize();
    return this.program.parseAsync(argv);
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      name: this.name,
      version: this.version,
      configDir: this.configDir,
      logDir: this.logDir,
      cacheDir: this.cacheDir,
      logLevel: this.logLevel,
      enableFileLogging: this.enableFileLogging,
    };
  }

  /**
   * 检查配置目录状态
   */
  async getStatus() {
    const status = {
      initialized: this.initialized,
      configExists: await fs.pathExists(this.configDir),
      logDirExists: await fs.pathExists(this.logDir),
      cacheDirExists: await fs.pathExists(this.cacheDir),
    };

    if (status.configExists) {
      const configStat = await fs.stat(this.configDir);
      status.configDirSize = await this.getDirectorySize(this.configDir);
      status.configDirModified = configStat.mtime;
    }

    return status;
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }
    
    return totalSize;
  }

  /**
   * 清理缓存和临时文件
   */
  async cleanup() {
    this.log('info', 'Cleaning up cache and temporary files...');
    
    try {
      // 清理缓存目录
      if (await fs.pathExists(this.cacheDir)) {
        await fs.emptyDir(this.cacheDir);
      }
      
      // 清理旧日志
      await this.rotateLogFiles();
      
      this.log('info', 'Cleanup completed');
      return true;
    } catch (error) {
      this.log('error', `Cleanup failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = CLIFramework;