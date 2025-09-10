/**
 * MCP (Model Context Protocol) Manager for Claude Code
 * Manages MCP services specifically for Claude Code (not Claude Desktop)
 * 
 * @class
 * @example
 * const MCPManager = require('./MCPManager');
 * const mcpManager = new MCPManager('/path/to/config');
 * 
 * // List available MCP services
 * const services = await mcpManager.listServices();
 * console.log('Available services:', services);
 * 
 * // Install a service
 * await mcpManager.installService('filesystem');
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const inquirer = require('inquirer');
const ora = require('ora');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * @typedef {Object} MCPServiceConfig
 * @property {string} name - Service name
 * @property {string} displayName - Display name for the service
 * @property {string} description - Service description
 * @property {string} package - NPM package name
 * @property {string} transport - Transport type (stdio, sse)
 * @property {boolean} recommended - Whether this service is recommended
 * @property {string} installCommand - Installation command
 * @property {string} addCommand - Command to add service to Claude
 * @property {string} scope - Installation scope (user, global)
 * @property {boolean} needsConfig - Whether service needs additional configuration
 * @property {Object[]} [configFields] - Configuration fields if needed
 */

/**
 * @typedef {Object} MCPServiceStatus
 * @property {string} name - Service name
 * @property {boolean} installed - Whether service is installed
 * @property {boolean} configured - Whether service is configured
 * @property {string} version - Installed version
 * @property {string} location - Installation location
 * @property {Object} [config] - Service configuration
 */

/**
 * @typedef {Object} MCPRegistry
 * @property {Object.<string, MCPServiceConfig>} services - Available services registry
 */

class MCPManager {
  /**
   * Create a new MCPManager instance
   * 
   * @param {string} configDir - Configuration directory path
   * @throws {Error} If configDir is not provided
   * 
   * @example
   * const mcpManager = new MCPManager('/home/user/.claude/ccvm');
   */
  constructor(configDir) {
    this.configDir = configDir;
    this.mcpDir = path.join(configDir, 'mcp');
    this.configFile = path.join(this.mcpDir, 'config.json');
    
    // 预置的推荐 MCP 服务配置
    this.registry = {
      'filesystem': {
        name: 'filesystem',
        displayName: 'Filesystem MCP',
        description: '让 Claude 读写本地文件和目录',
        package: '@modelcontextprotocol/server-filesystem',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @modelcontextprotocol/server-filesystem',
        addCommand: 'claude mcp add filesystem npx -- -y @modelcontextprotocol/server-filesystem',
        scope: 'user', // 推荐安装到用户级别
        needsConfig: false
      },
      'sequential-thinking': {
        name: 'sequential-thinking',
        displayName: 'Sequential Thinking MCP',
        description: '帮助 Claude 进行结构化思考和推理',
        package: '@modelcontextprotocol/server-sequential-thinking',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @modelcontextprotocol/server-sequential-thinking',
        addCommand: 'claude mcp add sequential-thinking npx -- -y @modelcontextprotocol/server-sequential-thinking',
        scope: 'user',
        needsConfig: false
      },
      'docker': {
        name: 'docker',
        displayName: 'Docker MCP',
        description: '管理 Docker 容器和镜像',
        package: 'docker-mcp',
        transport: 'stdio',
        recommended: true,
        installCommand: 'pip install docker-mcp || uvx docker-mcp',
        addCommand: 'claude mcp add docker uvx -- docker-mcp',
        scope: 'user',
        needsConfig: false,
        requiresPython: true,
        note: '需要 Python 3.12+ 和 UV 包管理器'
      },
      'context7': {
        name: 'context7',
        displayName: 'Context7 MCP',
        description: 'Upstash Context7 MCP 服务，提供上下文管理功能',
        package: '@upstash/context7-mcp',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @upstash/context7-mcp@latest',
        addCommand: 'claude mcp add context7 npx -- -y @upstash/context7-mcp@latest',
        scope: 'user',
        needsConfig: false
      },
      'figma': {
        name: 'figma',
        displayName: 'Figma Dev Mode MCP',
        description: '连接到Figma开发者模式，获取设计文件和原型数据',
        package: null, // 外部服务，不需要安装包
        transport: 'sse',
        recommended: true,
        installCommand: null, // 不需要安装命令
        addCommand: 'claude mcp add --transport sse figma-dev-mode-mcp-server {url}',
        scope: 'user',
        needsConfig: true,
        configFields: [
          {
            name: 'url',
            message: '请输入Figma MCP服务URL:',
            default: 'http://127.0.0.1:3845/sse',
            validate: (value) => {
              try {
                new URL(value);
                // 检查协议
                const url = new URL(value);
                if (!['http:', 'https:'].includes(url.protocol)) {
                  return '请输入有效的HTTP或HTTPS URL';
                }
                return true;
              } catch {
                return '请输入有效的URL格式';
              }
            }
          }
        ]
      },
      'chrome-browser': {
        name: 'chrome-browser',
        displayName: 'Chrome Browser MCP',
        description: '将Chrome浏览器转为AI自动化工具，支持20+浏览器管理功能',
        package: 'mcp-chrome-bridge',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g mcp-chrome-bridge',
        addCommand: 'claude mcp add chrome-browser node -- {installPath}',
        scope: 'user',
        needsConfig: true,
        requiresManualSetup: true, // 需要手动安装扩展
        setupInstructions: [
          '1. 从GitHub下载Chrome扩展: https://github.com/hangwin/mcp-chrome/releases',
          '2. 打开 chrome://extensions/ 启用开发者模式',
          '3. 点击"加载已解压的扩展程序"选择下载的扩展文件夹',
          '4. 全局安装 mcp-chrome-bridge: npm install -g mcp-chrome-bridge',
          '5. 查找安装路径: npm list -g mcp-chrome-bridge'
        ],
        configFields: [
          {
            name: 'installPath',
            message: '请输入mcp-server-stdio.js的完整路径:',
            default: '',
            validate: (value) => {
              if (!value || value.trim() === '') {
                return '请输入有效的文件路径';
              }
              if (!value.includes('mcp-server-stdio.js')) {
                return '路径应指向 mcp-server-stdio.js 文件';
              }
              return true;
            }
          }
        ],
        note: '需要Chrome或Chromium浏览器，stdio方式更稳定可靠'
      },
      'wecombot': {
        name: 'wecombot',
        displayName: 'WeComBot MCP',
        description: '向企业微信群发送消息，支持文本、markdown、图片等多种消息类型',
        package: '@kedoupi/wecombot-mcp',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @kedoupi/wecombot-mcp',
        addCommand: 'claude mcp add --scope user wecombot npx -- -y @kedoupi/wecombot-mcp',
        scope: 'user',
        needsConfig: true,
        requiresEnvVar: true, // 需要环境变量
        configFields: [
          {
            name: 'webhook_url',
            message: '请输入企业微信机器人Webhook URL:',
            default: '',
            envVar: 'WECOM_WEBHOOK_URL', // 对应的环境变量名
            validate: (value) => {
              if (!value || value.trim() === '') {
                return '请输入有效的Webhook URL';
              }
              if (!value.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
                return '请输入有效的企业微信机器人Webhook URL';
              }
              return true;
            }
          }
        ],
        setupInstructions: [
          '1. 在企业微信群中添加机器人',
          '2. 获取机器人Webhook URL',
          '3. 配置URL作为环境变量WECOM_WEBHOOK_URL',
          '4. 重启Claude Code以加载新的环境变量'
        ],
        note: '支持文本、markdown、图片、新闻卡片等多种消息类型，需要设置WECOM_WEBHOOK_URL环境变量'
      }
    };
  }

  /**
   * 安全执行命令的辅助方法
   * 避免阻塞事件循环，提供更好的错误处理
   * 
   * @param {string} command - 要执行的命令
   * @param {Object} [options={}] - 执行选项
   * @param {number} [options.timeout=10000] - 命令超时时间（毫秒）
   * @param {string} [options.encoding='utf-8'] - 输出编码
   * @returns {Promise<{stdout: string, stderr: string}>} 命令执行结果
   * @throws {Error} 当命令执行失败时抛出错误
   * @private
   */
  async #execCommand(command, options = {}) {
    const { timeout = 10000, encoding = 'utf-8' } = options;
    
    try {
      const result = await execAsync(command, { 
        timeout,
        encoding,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return result;
    } catch (error) {
      // 对于某些命令，我们可能希望静默失败
      if (options.silent) {
        return { stdout: '', stderr: error.message };
      }
      throw error;
    }
  }

  /**
   * Check if Claude Code CLI is available
   * 
   * @returns {Promise<boolean>} True if Claude Code CLI is available
   * 
   * @example
   * const isAvailable = await mcpManager.checkClaudeCode();
   * if (isAvailable) {
   *   console.log('Claude Code CLI is available');
   * }
   */
  async checkClaudeCode() {
    try {
      await this.#execCommand('claude --version', { timeout: 5000, silent: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取已安装的 MCP 服务（通过 claude mcp list）
   * 
   * @returns {Promise<Map<string, Object>>} 已安装服务的映射，key为服务名，value为服务信息
   * 
   * @example
   * const installed = await mcpManager.getInstalledMCPs();
   * console.log(`已安装 ${installed.size} 个服务`);
   * for (const [name, info] of installed) {
   *   console.log(`${name}:`, info);
   * }
   */
  async getInstalledMCPs() {
    try {
      // 首先尝试 JSON 输出
      try {
        const result = await this.#execCommand('claude mcp list --json', { timeout: 10000, silent: true });
        const data = JSON.parse(result.stdout);
        return new Map(Object.entries(data.servers || {}));
      } catch {
        // 如果 JSON 失败，尝试文本输出
        const result = await this.#execCommand('claude mcp list', { timeout: 10000, silent: true });
        const installed = new Map();
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          // 尝试从文本输出中提取服务名称
          for (const [key, service] of Object.entries(this.registry)) {
            if (line.includes(key) || line.includes(service.displayName)) {
              installed.set(key, { installed: true });
            }
          }
        }
        return installed;
      }
    } catch (error) {
      // Claude Code 可能未安装或 mcp 命令不可用
      return new Map();
    }
  }

  /**
   * 显示 MCP 服务列表
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.showList();
   * // 输出格式化的服务列表表格
   */
  async showList() {
    const table = new Table({
      head: [
        chalk.cyan('服务名称'),
        chalk.cyan('描述'),
        chalk.cyan('安装状态'),
        chalk.cyan('作用域'),
        chalk.cyan('需要配置')
      ],
      colWidths: [25, 35, 12, 10, 10],
      wordWrap: true
    });

    const installed = await this.getInstalledMCPs();
    
    // 添加所有注册的服务到表格
    for (const [key, mcp] of Object.entries(this.registry)) {
      const isInstalled = installed.has(key);
      
      table.push([
        mcp.displayName + (mcp.recommended ? ' ⭐' : ''),
        mcp.description,
        isInstalled ? chalk.green('✅ 已安装') : chalk.gray('❌ 未安装'),
        chalk.blue(mcp.scope === 'user' ? '用户' : mcp.scope),
        mcp.needsConfig ? chalk.yellow('需要') : chalk.gray('不需要')
      ]);
    }

    console.log(chalk.blue.bold('\n📦 Claude Code MCP 推荐服务\n'));
    console.log(table.toString());
    console.log(chalk.gray('\n💡 已安装的服务可通过 \'claude mcp list\' 查看详情'));
  }

  /**
   * 显示主菜单
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.showMainMenu();
   * // 显示交互式主菜单，用户可以选择各种操作
   */
  async showMainMenu() {
    // 检查 Claude Code 是否安装
    const claudeInstalled = await this.checkClaudeCode();
    if (!claudeInstalled) {
      console.log(chalk.red('\n❌ Claude Code 未安装或不在 PATH 中'));
      console.log(chalk.yellow('💡 请先安装 Claude Code: npm install -g @anthropic/claude-code'));
      return;
    }

    console.log(chalk.blue.bold('\n📦 Claude Code MCP Service Manager\n'));
    console.log('MCP (Model Context Protocol) 让 Claude Code 连接到各种数据源和工具。\n');
    
    const choices = [
      { name: '📋 查看推荐 MCP 服务', value: 'list' },
      { name: '➕ 安装 MCP 服务到 Claude Code', value: 'install' },
      { name: '➖ 从 Claude Code 移除 MCP 服务', value: 'uninstall' },
      { name: '🔍 查看已安装的 MCP 服务', value: 'installed' },
      { name: '🔧 检查环境配置', value: 'doctor' },
      { name: '❌ 退出', value: 'exit' }
    ];
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作：',
        choices
      }
    ]);
    
    switch (action) {
      case 'list':
        await this.showList();
        break;
      case 'install':
        await this.interactiveInstall();
        break;
      case 'uninstall':
        await this.interactiveUninstall();
        break;
      case 'installed':
        await this.showInstalledServices();
        break;
      case 'doctor':
        await this.doctor();
        break;
      case 'exit':
        process.exit(0);
        break;
      default:
        // 未知操作，忽略
        break;
    }
  }

  /**
   * 显示已安装的服务
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.showInstalledServices();
   * // 输出当前已安装的MCP服务列表
   */
  async showInstalledServices() {
    console.log(chalk.blue.bold('\n🔍 查询已安装的 MCP 服务...\n'));
    try {
      const result = await this.#execCommand('claude mcp list');
      console.log(result.stdout);
    } catch (error) {
      console.log(chalk.red('❌ 无法获取已安装的服务列表'));
      console.log(chalk.gray(error.message));
    }
  }

  /**
   * 交互式安装MCP服务
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.interactiveInstall();
   * // 通过交互式界面选择并安装MCP服务
   */
  async interactiveInstall() {
    const installed = await this.getInstalledMCPs();
    const availableServices = Object.entries(this.registry)
      .filter(([name]) => !installed.has(name))
      .map(([name, mcp]) => ({
        name: `${mcp.displayName} - ${mcp.description}${mcp.recommended ? ' ⭐' : ''}`,
        value: name
      }));

    if (availableServices.length === 0) {
      console.log(chalk.yellow('\n✅ 所有推荐的 MCP 服务都已安装！'));
      return;
    }

    const { services } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'services',
        message: '选择要安装的 MCP 服务（空格选择，回车确认）：',
        choices: availableServices
      }
    ]);

    if (services.length === 0) {
      console.log(chalk.gray('未选择任何服务'));
      return;
    }

    // 使用用户级别作为默认作用域

    for (const serviceName of services) {
      await this.installService(serviceName);
    }

    console.log(chalk.green.bold('\n✅ 安装完成！'));
    console.log(chalk.yellow('💡 使用 \'claude mcp list\' 查看已安装的服务'));
  }

  /**
   * 安装Chrome MCP服务的特殊处理
   * 
   * @param {MCPServiceConfig} mcp - Chrome MCP服务配置
   * @returns {Promise<void>}
   * @private
   */
  async installChromeMCP(mcp) {
    console.log(chalk.yellow.bold('\n🔧 Chrome MCP 需要额外步骤\n'));
    
    // 显示安装说明
    console.log(chalk.blue('📋 完整安装步骤：'));
    for (const instruction of mcp.setupInstructions) {
      console.log(chalk.gray(`   ${instruction}`));
    }
    console.log('');
    
    // 步骤1: 检查npm包是否已安装
    console.log(chalk.blue('步骤 1/5: 检查npm全局包...'));
    try {
      await this.#execCommand('mcp-chrome-bridge --version', { silent: true });
      console.log(chalk.green('✅ mcp-chrome-bridge 已安装'));
    } catch {
      console.log(chalk.yellow('⚠️  mcp-chrome-bridge 未安装'));
      
      const { shouldInstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInstall',
          message: '是否现在安装 mcp-chrome-bridge？',
          default: true
        }
      ]);
      
      if (shouldInstall) {
        const spinner = ora('安装 mcp-chrome-bridge...').start();
        try {
          await this.#execCommand(mcp.installCommand, { silent: true });
          spinner.succeed('mcp-chrome-bridge 安装成功');
        } catch (error) {
          spinner.fail('mcp-chrome-bridge 安装失败');
          console.log(chalk.red(error.message));
          return;
        }
      } else {
        console.log(chalk.yellow('请手动安装后再继续：npm install -g mcp-chrome-bridge'));
        return;
      }
    }
    
    // 步骤2: 确认Chrome扩展安装
    console.log(chalk.blue('\n步骤 2/5: Chrome扩展安装确认...'));
    const { extensionReady } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'extensionReady',
        message: '是否已完成Chrome扩展安装并启动了MCP服务？',
        default: false
      }
    ]);
    
    if (!extensionReady) {
      console.log(chalk.yellow('\n请按照以下步骤安装Chrome扩展：'));
      for (const instruction of mcp.setupInstructions) {
        console.log(chalk.gray(`   ${instruction}`));
      }
      console.log(chalk.yellow('\n安装完成后请重新运行此命令'));
      return;
    }
    
    // 步骤3: 查找mcp-server-stdio.js路径
    console.log(chalk.blue('\n步骤 3/5: 查找安装路径...'));
    let mcpServerPath = '';
    
    try {
      // 方法1: 使用 npm list -g 获取准确路径
      const npmResult = await this.#execCommand('npm list -g mcp-chrome-bridge --depth=0', { silent: true });
      
      if (npmResult.stdout.includes('mcp-chrome-bridge@')) {
        // 从第一行提取npm全局目录
        const firstLine = npmResult.stdout.split('\n')[0];
        if (firstLine && firstLine.includes('/')) {
          // 构建可能的路径
          const npmGlobalDir = firstLine.trim();
          const possiblePaths = [
            `${npmGlobalDir}/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js`,
            // 处理 nvm 等环境管理器的路径结构
            `${npmGlobalDir}/lib/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js`
          ];
          
          // 检查哪个路径存在
          for (const testPath of possiblePaths) {
            try {
              const result = await this.#execCommand(`test -f "${testPath}"`, { silent: true });
              if (result.stderr === '') { // 文件存在
                mcpServerPath = testPath;
                console.log(chalk.green(`✅ 找到安装路径: ${mcpServerPath}`));
                break;
              }
            } catch {
              continue;
            }
          }
        }
      }
      
      // 方法2: 如果方法1失败，使用 find 命令搜索
      if (!mcpServerPath) {
        const findResult = await this.#execCommand('find $(npm prefix -g) -name "mcp-server-stdio.js" 2>/dev/null | head -1', { silent: true });
        if (findResult.stdout && findResult.stdout.trim()) {
          mcpServerPath = findResult.stdout.trim();
          console.log(chalk.green(`✅ 通过搜索找到路径: ${mcpServerPath}`));
        }
      }
      
    } catch (error) {
      console.log(chalk.yellow('⚠️  自动检测路径失败，将手动输入'));
    }
    
    // 方法3: 如果仍然没找到，提供常见路径选择
    if (!mcpServerPath) {
      const npmPrefix = await this.#execCommand('npm prefix -g', { silent: true }).catch(() => ({ stdout: '' }));
      if (npmPrefix.stdout.trim()) {
        const globalPath = npmPrefix.stdout.trim();
        const commonPaths = [
          `${globalPath}/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js`,
          `${globalPath}/lib/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js`
        ];
        
        console.log(chalk.yellow('常见安装路径:'));
        for (let i = 0; i < commonPaths.length; i++) {
          console.log(chalk.gray(`  ${i + 1}. ${commonPaths[i]}`));
        }
      }
    }
    
    // 步骤4: 获取或确认安装路径
    console.log(chalk.blue('\n步骤 4/5: 配置安装路径...'));
    let installPath = mcpServerPath;
    
    if (!installPath) {
      // 如果没有找到路径，询问用户手动输入
      const { manualPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualPath',
          message: '请输入mcp-server-stdio.js的完整路径:',
          validate: (value) => {
            if (!value || value.trim() === '') {
              return '请输入有效的文件路径';
            }
            if (!value.includes('mcp-server-stdio.js')) {
              return '路径应指向 mcp-server-stdio.js 文件';
            }
            return true;
          }
        }
      ]);
      installPath = manualPath;
    } else {
      // 确认自动检测的路径
      const { useAutoPath } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useAutoPath',
          message: `使用自动检测的路径？\n${installPath}`,
          default: true
        }
      ]);
      
      if (!useAutoPath) {
        const { customPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customPath',
            message: '请输入自定义路径:',
            default: installPath,
            validate: (value) => {
              if (!value || value.trim() === '') {
                return '请输入有效的文件路径';
              }
              if (!value.includes('mcp-server-stdio.js')) {
                return '路径应指向 mcp-server-stdio.js 文件';
              }
              return true;
            }
          }
        ]);
        installPath = customPath;
      }
    }
    
    // 步骤5: 添加到Claude Code
    console.log(chalk.blue('\n步骤 5/5: 添加到Claude Code...'));
    const addCommand = mcp.addCommand.replace('{installPath}', installPath).replace('claude mcp add', 'claude mcp add --scope user');
    
    console.log(chalk.gray(`执行: ${addCommand}`));
    try {
      const result = await this.#execCommand(addCommand);
      console.log(chalk.green(`✅ ${mcp.displayName} 已添加到 Claude Code`));
      if (result.stdout) {
        console.log(chalk.gray(result.stdout));
      }
      
      // 显示使用说明
      console.log(chalk.green.bold('\n🎉 Chrome MCP 配置完成！'));
      console.log(chalk.yellow('\n💡 使用示例：'));
      console.log(chalk.gray('  • claude "截图当前网页"'));
      console.log(chalk.gray('  • claude "分析这个页面的主要内容"'));
      console.log(chalk.gray('  • claude "帮我填写这个表单"'));
      console.log(chalk.gray('  • claude "关闭所有标签页"'));
      
    } catch (error) {
      console.log(chalk.red(`❌ 添加失败: ${error.message}`));
    }
  }

  /**
   * 安装WeComBot MCP服务的特殊处理
   * 
   * @param {MCPServiceConfig} mcp - WeComBot MCP服务配置
   * @returns {Promise<void>}
   * @private
   */
  async installWeComBotMCP(mcp) {
    console.log(chalk.yellow.bold('\n🔧 WeComBot MCP 需要环境变量配置\n'));
    
    // 显示安装说明
    console.log(chalk.blue('📋 配置步骤：'));
    for (const instruction of mcp.setupInstructions) {
      console.log(chalk.gray(`   ${instruction}`));
    }
    console.log('');
    
    // 步骤1: 安装npm包
    console.log(chalk.blue('步骤 1/3: 安装npm包...'));
    try {
      await this.#execCommand('npm list -g @kedoupi/wecombot-mcp', { silent: true });
      console.log(chalk.green('✅ @kedoupi/wecombot-mcp 已安装'));
    } catch {
      console.log(chalk.yellow('⚠️  @kedoupi/wecombot-mcp 未安装'));
      
      const { shouldInstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInstall',
          message: '是否现在安装 @kedoupi/wecombot-mcp？',
          default: true
        }
      ]);
      
      if (shouldInstall) {
        const spinner = ora('安装 @kedoupi/wecombot-mcp...').start();
        try {
          await this.#execCommand(mcp.installCommand, { silent: true });
          spinner.succeed('@kedoupi/wecombot-mcp 安装成功');
        } catch (error) {
          spinner.fail('@kedoupi/wecombot-mcp 安装失败');
          console.log(chalk.red(`错误: ${error.message}`));
          return;
        }
      } else {
        console.log(chalk.yellow('请手动安装后再继续：npm install -g @kedoupi/wecombot-mcp'));
        return;
      }
    }

    // 步骤2: 获取Webhook URL
    console.log(chalk.blue('\n步骤 2/3: 配置企业微信Webhook URL...'));
    const configField = mcp.configFields[0];
    const { webhook_url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'webhook_url',
        message: configField.message,
        default: configField.default,
        validate: configField.validate
      }
    ]);

    // 步骤3: 添加到Claude Code
    console.log(chalk.blue('\n步骤 3/3: 添加到Claude Code...'));
    const addCommand = `claude mcp add --scope user wecombot --env WECOM_WEBHOOK_URL="${webhook_url}" -- npx -y @kedoupi/wecombot-mcp`;
    
    console.log(chalk.gray(`执行: ${addCommand}`));
    try {
      const result = await this.#execCommand(addCommand);
      console.log(chalk.green(`✅ ${mcp.displayName} 已添加到 Claude Code`));
      if (result.stdout) {
        console.log(chalk.gray(result.stdout));
      }
      
      // 显示使用说明
      console.log(chalk.green.bold('\n🎉 WeComBot MCP 配置完成！'));
      console.log(chalk.yellow('\n💡 使用示例：'));
      console.log(chalk.gray('  • claude "发送消息到企业微信：项目部署完成"'));
      console.log(chalk.gray('  • claude "发送markdown格式的状态报告到企业微信"'));
      console.log(chalk.gray('  • claude "向企业微信群发送图片消息"'));
      
      console.log(chalk.blue('\n📝 环境变量说明：'));
      console.log(chalk.gray(`  • WECOM_WEBHOOK_URL=${webhook_url}`));
      console.log(chalk.gray('  • 重启Claude Code后生效'));
      
    } catch (error) {
      console.log(chalk.red(`❌ 添加失败: ${error.message}`));
    }
  }
  
  /**
   * 测试MCP服务连接
   * 
   * @param {string} url - MCP服务URL
   * @returns {Promise<{success: boolean, error?: string}>}
   * @private
   */
  async testMCPConnection(url) {
    // 尝试多个可能的端点
    const testUrls = [
      url,
      url.replace('/mcp', ''),
      'http://127.0.0.1:12306',
      'http://127.0.0.1:12306/mcp',
      'http://127.0.0.1:12306/sse'
    ];
    
    for (const testUrl of testUrls) {
      try {
        console.log(chalk.gray(`  尝试连接: ${testUrl}`));
        const result = await this.#execCommand(`curl -s --connect-timeout 3 -I "${testUrl}"`, { 
          timeout: 5000, 
          silent: true 
        });
        
        // 检查HTTP状态码
        if (result.stdout.includes('200') || result.stdout.includes('HTTP')) {
          console.log(chalk.green(`  ✅ 连接成功: ${testUrl}`));
          return { success: true, workingUrl: testUrl };
        }
      } catch (error) {
        console.log(chalk.gray(`  ❌ 连接失败: ${testUrl}`));
        continue;
      }
    }
    
    // 最后尝试使用telnet测试端口可达性
    try {
      console.log(chalk.gray('  尝试端口连通性测试...'));
      await this.#execCommand('nc -z 127.0.0.1 12306', { 
        timeout: 3000, 
        silent: true 
      });
      console.log(chalk.yellow('  ⚠️  端口12306可达，但HTTP服务可能未就绪'));
      return { 
        success: false, 
        error: '端口可达但HTTP服务响应异常，请检查Chrome扩展是否正确启动MCP服务'
      };
    } catch {
      return { 
        success: false, 
        error: '无法连接到端口12306，请确认Chrome扩展已启动MCP服务器'
      };
    }
  }

  /**
   * 安装单个MCP服务
   * 
   * @param {string} name - 服务名称
   * @param {string} [scope='user'] - 安装作用域 ('user', 'project', 'local')
   * @returns {Promise<void>}
   * @throws {Error} 如果服务不存在或安装失败
   * 
   * @example
   * await mcpManager.installService('filesystem', 'user');
   * // 安装filesystem服务到用户作用域
   */
  async installService(name) {
    const mcp = this.registry[name];
    if (!mcp) {
      throw new Error(`未知的 MCP 服务: ${name}`);
    }

    // 特殊处理Chrome MCP
    if (name === 'chrome-browser' && mcp.requiresManualSetup) {
      return await this.installChromeMCP(mcp);
    }

    // 特殊处理WeComBot MCP
    if (name === 'wecombot' && mcp.requiresEnvVar) {
      return await this.installWeComBotMCP(mcp);
    }

    console.log(chalk.blue(`\n📦 配置 ${mcp.displayName} 到用户作用域...`));

    // 1. 先安装包（根据不同的包管理器）
    if (mcp.installCommand) {
      // 特殊处理 Python 包
      if (mcp.requiresPython) {
        console.log(chalk.yellow(`\n注意：${mcp.displayName} 需要 Python 环境`));
        if (mcp.note) {
          console.log(chalk.gray(mcp.note));
        }
        
        // 检查是否安装了 uvx
        try {
          await this.#execCommand('uvx --version', { silent: true });
          console.log(chalk.green('✅ 检测到 UV 包管理器'));
        } catch {
          console.log(chalk.yellow('⚠️  未检测到 UV 包管理器'));
          console.log(chalk.gray('安装 UV: curl -LsSf https://astral.sh/uv/install.sh | sh'));
          
          const { continueAnyway } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueAnyway',
              message: '是否继续配置（稍后手动安装依赖）？',
              default: true
            }
          ]);
          
          if (!continueAnyway) {
            console.log(chalk.gray('已取消'));
            return;
          }
        }
      } else {
        // Node.js 包的安装
        const spinner = ora(`安装 ${mcp.package}...`).start();
        try {
          await this.#execCommand(mcp.installCommand, { silent: true });
          spinner.succeed(`${mcp.package} 安装成功`);
        } catch (error) {
          spinner.fail(`${mcp.package} 安装失败`);
          console.log(chalk.red(error.message));
          return;
        }
      }
    } else if (mcp.package === null) {
      // 外部服务，不需要包安装
      console.log(chalk.blue('这是外部服务，跳过包安装步骤...'));
    }

    // 2. 构建 claude mcp add 命令（硬编码为用户级别）
    let addCommand = mcp.addCommand.replace('claude mcp add', 'claude mcp add --scope user');

    // 3. 处理配置字段（环境变量或URL参数）
    if (mcp.needsConfig && mcp.configFields) {
      console.log(chalk.yellow('需要配置以下信息：'));
      
      const envVars = [];
      const urlReplacements = {};
      
      for (const field of mcp.configFields) {
        const { value } = await inquirer.prompt([
          {
            type: field.type || 'input',
            name: 'value',
            message: field.message,
            default: field.default || '',
            mask: field.type === 'password' ? '*' : undefined,
            validate: field.validate || (() => true)
          }
        ]);
        
        if (value && value.trim() !== '') {
          // 检查是否是URL参数（用于命令替换）
          if (field.name === 'url' && addCommand.includes('{url}')) {
            urlReplacements.url = value;
          } else {
            // 使用 -e 参数格式的环境变量
            envVars.push(`-e ${field.name}="${value}"`);
          }
        }
      }
      
      // 处理URL替换
      for (const [key, value] of Object.entries(urlReplacements)) {
        addCommand = addCommand.replace(`{${key}}`, value);
      }
      
      // 将环境变量添加到命令中
      if (envVars.length > 0) {
        addCommand += ' ' + envVars.join(' ');
      }
    }

    // 3.5. 处理预设的环境变量（如 memory-bank 的固定路径）
    if (mcp.envVars) {
      console.log(chalk.blue('配置预设环境变量...'));
      const presetEnvVars = [];
      
      for (const [key, value] of Object.entries(mcp.envVars)) {
        // 如果是路径类型的环境变量，确保目录存在
        if (key.includes('ROOT') || key.includes('PATH') || key.includes('DIR')) {
          try {
            await fs.ensureDir(value);
            console.log(chalk.green(`✅ 创建目录: ${value}`));
          } catch (error) {
            console.log(chalk.yellow(`⚠️  目录创建失败: ${value} - ${error.message}`));
          }
        }
        
        presetEnvVars.push(`-e ${key}="${value}"`);
        console.log(chalk.gray(`  ${key}=${value}`));
      }
      
      if (presetEnvVars.length > 0) {
        addCommand += ' ' + presetEnvVars.join(' ');
      }
    }

    // 4. 执行添加命令
    console.log(chalk.gray(`执行: ${addCommand}`));
    try {
      const result = await this.#execCommand(addCommand);
      console.log(chalk.green(`✅ ${mcp.displayName} 已添加到 Claude Code`));
      if (result.stdout) {
        console.log(chalk.gray(result.stdout));
      }
    } catch (error) {
      console.log(chalk.red(`❌ 添加失败: ${error.message}`));
    }
  }

  /**
   * 交互式卸载MCP服务
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.interactiveUninstall();
   * // 通过交互式界面选择并卸载已安装的MCP服务
   */
  async interactiveUninstall() {
    console.log(chalk.blue.bold('\n🔍 获取已安装的服务...\n'));
    
    try {
      // 获取 Claude Code 中的服务列表
      const result = await this.#execCommand('claude mcp list');
      
      // 从输出中提取服务名称
      const services = [];
      const lines = result.stdout.split('\n');
      for (const line of lines) {
        // 匹配我们注册表中的服务
        for (const [key, service] of Object.entries(this.registry)) {
          if (line.includes(key)) {
            services.push({
              name: `${service.displayName} - ${service.description}`,
              value: key
            });
            break;
          }
        }
      }
      
      if (services.length === 0) {
        console.log(chalk.yellow('没有找到已安装的推荐服务'));
        return;
      }

      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: '选择要移除的 MCP 服务：',
          choices: services
        }
      ]);

      if (selected.length === 0) {
        console.log(chalk.gray('未选择任何服务'));
        return;
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `确定要移除 ${selected.length} 个服务吗？`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.gray('已取消'));
        return;
      }

      let successCount = 0;
      for (const serviceName of selected) {
        const success = await this.uninstallService(serviceName);
        if (success) {
          successCount++;
        }
      }

      if (successCount === selected.length) {
        console.log(chalk.green.bold('\n✅ 移除完成！'));
      } else if (successCount > 0) {
        console.log(chalk.yellow.bold(`\n⚠️  部分完成：${successCount}/${selected.length} 个服务移除成功`));
      } else {
        console.log(chalk.red.bold('\n❌ 移除失败：没有服务被成功移除'));
      }
      
    } catch (error) {
      console.log(chalk.red('❌ 无法获取服务列表'));
      console.log(chalk.gray(error.message));
    }
  }

  /**
   * 卸载单个MCP服务
   * 
   * @param {string} name - 服务名称
   * @returns {Promise<boolean>} 返回移除是否成功
   * 
   * @example
   * const success = await mcpManager.uninstallService('filesystem');
   * // 从Claude Code中移除filesystem服务
   */
  async uninstallService(name) {
    const mcp = this.registry[name];
    const displayName = mcp ? mcp.displayName : name;
    
    // 确定要移除的服务名称：优先使用 removeServiceName，否则使用 name
    const removeServiceName = mcp?.removeServiceName || name;
    
    console.log(chalk.blue(`\n🗑️  从 Claude Code 移除 ${displayName}...`));

    try {
      const result = await this.#execCommand(`claude mcp remove ${removeServiceName}`);
      console.log(chalk.green(`✅ ${displayName} 已移除`));
      if (result.stdout && result.stdout.trim()) {
        console.log(chalk.gray(result.stdout));
      }
      return true;
    } catch (error) {
      console.log(chalk.red(`❌ 移除失败: ${error.message}`));
      // 输出更详细的错误信息
      if (error.stderr) {
        console.log(chalk.gray(error.stderr));
      }
      return false;
    }
  }

  /**
   * 检查环境配置和系统状态
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.doctor();
   * // 输出系统环境检查结果和建议
   */
  async doctor() {
    console.log(chalk.blue.bold('\n🔍 检查环境配置...\n'));

    const checks = [];
    
    // 检查 Claude Code
    const claudeInstalled = await this.checkClaudeCode();
    try {
      const result = await this.#execCommand('claude --version');
      checks.push({
        name: 'Claude Code',
        status: true,
        message: result.stdout.trim()
      });
    } catch {
      checks.push({
        name: 'Claude Code',
        status: false,
        message: '未安装'
      });
    }

    // 检查 Node.js
    try {
      const result = await this.#execCommand('node --version');
      checks.push({
        name: 'Node.js',
        status: true,
        message: result.stdout.trim()
      });
    } catch {
      checks.push({
        name: 'Node.js',
        status: false,
        message: '未安装'
      });
    }

    // 检查 npm
    try {
      const result = await this.#execCommand('npm --version');
      checks.push({
        name: 'npm',
        status: true,
        message: result.stdout.trim()
      });
    } catch {
      checks.push({
        name: 'npm',
        status: false,
        message: '未安装'
      });
    }

    // 检查已安装的 MCP 服务
    if (claudeInstalled) {
      try {
        const result = await this.#execCommand('claude mcp list');
        const serviceCount = (result.stdout.match(/\n/g) || []).length;
        checks.push({
          name: 'MCP 服务',
          status: serviceCount > 0,
          message: serviceCount > 0 ? `已安装 ${serviceCount} 个服务` : '未安装任何服务'
        });
      } catch {
        checks.push({
          name: 'MCP 服务',
          status: false,
          message: '无法获取'
        });
      }
    }

    // 显示检查结果
    const table = new Table({
      head: [chalk.cyan('检查项'), chalk.cyan('状态'), chalk.cyan('详情')],
      colWidths: [20, 10, 45]
    });

    for (const check of checks) {
      table.push([
        check.name,
        check.status ? chalk.green('✅') : chalk.red('❌'),
        check.message
      ]);
    }

    console.log(table.toString());

    // 提供修复建议
    const hasIssues = checks.some(c => !c.status);
    if (hasIssues) {
      console.log(chalk.yellow.bold('\n💡 修复建议：'));
      
      if (!claudeInstalled) {
        console.log(chalk.yellow('  • 安装 Claude Code: npm install -g @anthropic/claude-code'));
      }
      
      if (!checks.find(c => c.name === 'Node.js')?.status) {
        console.log(chalk.yellow('  • 安装 Node.js: https://nodejs.org/'));
      }
      
      if (!checks.find(c => c.name === 'npm')?.status) {
        console.log(chalk.yellow('  • npm 通常随 Node.js 一起安装'));
      }
    } else {
      console.log(chalk.green.bold('\n✅ 所有检查通过！'));
      console.log(chalk.gray('\n可以使用以下命令管理 MCP 服务：'));
      console.log(chalk.gray('  • ccvm mcp - 交互式管理'));
      console.log(chalk.gray('  • ccvm mcp list - 查看推荐服务'));
      console.log(chalk.gray('  • claude mcp list - 查看已安装服务'));
    }
  }
}

module.exports = MCPManager;