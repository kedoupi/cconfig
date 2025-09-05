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
const os = require('os');
const { execSync } = require('child_process');
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
      'memory': {
        name: 'memory',
        displayName: 'Memory Bank MCP',
        description: '为 Claude 提供持久化记忆存储',
        package: '@modelcontextprotocol/server-memory',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @modelcontextprotocol/server-memory',
        addCommand: 'claude mcp add memory npx -- -y @modelcontextprotocol/server-memory',
        scope: 'user',
        needsConfig: true,
        configFields: [
          {
            name: 'MEMORY_STORE_PATH',
            message: '记忆存储路径',
            type: 'input',
            default: path.join(os.homedir(), '.claude', 'memory'),
            validate: (input) => {
              if (!input) return '存储路径不能为空';
              return true;
            }
          }
        ]
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
        package: '@upstash/context7-mcp@latest',
        transport: 'stdio',
        recommended: true,
        installCommand: 'npm install -g @upstash/context7-mcp@latest',
        addCommand: 'claude mcp add context7 npx -- -y @upstash/context7-mcp@latest',
        scope: 'user',
        needsConfig: false
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
      const output = execSync('claude mcp list', { encoding: 'utf-8' });
      console.log(output);
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

    // 询问安装作用域
    const { scope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'scope',
        message: '选择安装作用域：',
        choices: [
          { name: '用户级别 (User) - 所有项目可用', value: 'user' },
          { name: '项目级别 (Project) - 仅当前项目，可共享给团队', value: 'project' },
          { name: '本地级别 (Local) - 仅当前项目，私有配置', value: 'local' }
        ],
        default: 'user'
      }
    ]);

    for (const serviceName of services) {
      await this.installService(serviceName, scope);
    }

    console.log(chalk.green.bold('\n✅ 安装完成！'));
    console.log(chalk.yellow('💡 使用 \'claude mcp list\' 查看已安装的服务'));
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
  async installService(name, scope = 'user') {
    const mcp = this.registry[name];
    if (!mcp) {
      throw new Error(`未知的 MCP 服务: ${name}`);
    }

    console.log(chalk.blue(`\n📦 安装 ${mcp.displayName} 到 ${scope} 作用域...`));

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
          execSync('uvx --version', { stdio: 'ignore' });
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
          execSync(mcp.installCommand, { stdio: 'ignore' });
          spinner.succeed(`${mcp.package} 安装成功`);
        } catch (error) {
          spinner.fail(`${mcp.package} 安装失败`);
          console.log(chalk.red(error.message));
          return;
        }
      }
    }

    // 2. 构建 claude mcp add 命令
    let addCommand = mcp.addCommand;
    
    // 添加作用域参数 (使用 --scope 参数)
    if (scope === 'project') {
      addCommand = addCommand.replace('claude mcp add', 'claude mcp add --scope project');
    } else if (scope === 'user') {
      addCommand = addCommand.replace('claude mcp add', 'claude mcp add --scope user');
    } else {
      // local 是默认值，但为了明确，也可以指定
      addCommand = addCommand.replace('claude mcp add', 'claude mcp add --scope local');
    }

    // 3. 处理环境变量配置
    if (mcp.needsConfig && mcp.configFields) {
      console.log(chalk.yellow('需要配置以下信息：'));
      
      const envVars = [];
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
          // 使用 -e 参数格式
          envVars.push(`-e ${field.name}="${value}"`);
        }
      }
      
      // 将环境变量添加到命令中
      if (envVars.length > 0) {
        addCommand += ' ' + envVars.join(' ');
      }
    }

    // 4. 执行添加命令
    console.log(chalk.gray(`执行: ${addCommand}`));
    try {
      const output = execSync(addCommand, { encoding: 'utf-8' });
      console.log(chalk.green(`✅ ${mcp.displayName} 已添加到 Claude Code`));
      if (output) {
        console.log(chalk.gray(output));
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
      const output = execSync('claude mcp list', { encoding: 'utf-8' });
      
      // 从输出中提取服务名称
      const services = [];
      const lines = output.split('\n');
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

      for (const serviceName of selected) {
        await this.uninstallService(serviceName);
      }

      console.log(chalk.green.bold('\n✅ 移除完成！'));
      
    } catch (error) {
      console.log(chalk.red('❌ 无法获取服务列表'));
      console.log(chalk.gray(error.message));
    }
  }

  /**
   * 卸载单个MCP服务
   * 
   * @param {string} name - 服务名称
   * @returns {Promise<void>}
   * 
   * @example
   * await mcpManager.uninstallService('filesystem');
   * // 从Claude Code中移除filesystem服务
   */
  async uninstallService(name) {
    const mcp = this.registry[name];
    const displayName = mcp ? mcp.displayName : name;
    
    console.log(chalk.blue(`\n🗑️  从 Claude Code 移除 ${displayName}...`));

    try {
      execSync(`claude mcp remove ${name}`, { encoding: 'utf-8' });
      console.log(chalk.green(`✅ ${displayName} 已移除`));
    } catch (error) {
      console.log(chalk.red(`❌ 移除失败: ${error.message}`));
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
      const version = execSync('claude --version', { encoding: 'utf-8' }).trim();
      checks.push({
        name: 'Claude Code',
        status: true,
        message: version
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
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
      checks.push({
        name: 'Node.js',
        status: true,
        message: nodeVersion
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
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
      checks.push({
        name: 'npm',
        status: true,
        message: npmVersion
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
        const output = execSync('claude mcp list', { encoding: 'utf-8' });
        const serviceCount = (output.match(/\n/g) || []).length;
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