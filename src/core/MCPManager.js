/**
 * MCP (Model Context Protocol) Manager
 * Manages MCP services for Claude Desktop
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const Table = require('cli-table3');
const inquirer = require('inquirer');

class MCPManager {
  constructor(configDir) {
    this.configDir = configDir;
    this.claudeConfigPath = this.getClaudeConfigPath();
    
    // 内置 MCP 服务注册表
    this.registry = {
      'filesystem': {
        name: 'filesystem',
        displayName: 'Filesystem MCP',
        description: '让 Claude 读写本地文件和目录',
        package: '@modelcontextprotocol/server-filesystem',
        recommended: true,
        needsConfig: false,
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem']
        }
      },
      'sequential-thinking': {
        name: 'sequential-thinking',
        displayName: 'Sequential Thinking MCP',
        description: '帮助 Claude 进行结构化思考和推理',
        package: '@modelcontextprotocol/server-sequential-thinking',
        recommended: true,
        needsConfig: false,
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
        }
      },
      'memory': {
        name: 'memory',
        displayName: 'Memory Bank MCP',
        description: '为 Claude 提供持久化记忆存储',
        package: '@modelcontextprotocol/server-memory',
        recommended: true,
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
        ],
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory']
        }
      },
      'docker': {
        name: 'docker',
        displayName: 'Docker MCP',
        description: '管理 Docker 容器和镜像',
        package: '@modelcontextprotocol/server-docker',
        recommended: true,
        needsConfig: true,
        configFields: [
          {
            name: 'DOCKER_HOST',
            message: 'Docker Host (留空使用默认)',
            type: 'input',
            default: '',
            required: false
          }
        ],
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-docker']
        }
      }
    };
  }

  /**
   * 获取 Claude Desktop 配置文件路径
   */
  getClaudeConfigPath() {
    const platform = os.platform();
    switch (platform) {
      case 'darwin': // macOS
        return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'win32': // Windows
        return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      case 'linux': // Linux
        return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * 读取 Claude Desktop 配置
   */
  async readClaudeConfig() {
    try {
      if (await fs.pathExists(this.claudeConfigPath)) {
        return await fs.readJson(this.claudeConfigPath);
      }
      return { mcpServers: {} };
    } catch (error) {
      console.error(chalk.red('读取 Claude Desktop 配置失败:'), error.message);
      return { mcpServers: {} };
    }
  }

  /**
   * 写入 Claude Desktop 配置
   */
  async writeClaudeConfig(config) {
    try {
      await fs.ensureDir(path.dirname(this.claudeConfigPath));
      await fs.writeJson(this.claudeConfigPath, config, { spaces: 2 });
    } catch (error) {
      throw new Error(`写入 Claude Desktop 配置失败: ${error.message}`);
    }
  }

  /**
   * 获取已安装的 MCP 服务
   */
  async getInstalledMCPs() {
    const config = await this.readClaudeConfig();
    const mcpServers = config.mcpServers || {};
    
    const installed = new Map();
    for (const [name, serverConfig] of Object.entries(mcpServers)) {
      installed.set(name, {
        ...serverConfig,
        enabled: true // 如果在配置中，就认为是启用的
      });
    }
    
    return installed;
  }

  /**
   * 显示 MCP 服务列表
   */
  async showList() {
    const table = new Table({
      head: [
        chalk.cyan('Service'),
        chalk.cyan('Description'),
        chalk.cyan('Installed'),
        chalk.cyan('Config Needed')
      ],
      colWidths: [25, 35, 12, 15],
      wordWrap: true
    });

    const installed = await this.getInstalledMCPs();
    
    // 添加所有注册的服务到表格
    for (const [key, mcp] of Object.entries(this.registry)) {
      const isInstalled = installed.has(key);
      
      table.push([
        mcp.displayName + (mcp.recommended ? ' ⭐' : ''),
        mcp.description,
        isInstalled ? chalk.green('✅ Yes') : chalk.gray('❌ No'),
        mcp.needsConfig ? chalk.yellow('Yes') : chalk.gray('No')
      ]);
    }

    console.log(chalk.blue.bold('\n📦 MCP Services Status\n'));
    console.log(table.toString());
    console.log(chalk.gray('\n💡 使用 \'ccvm mcp\' 进入交互式管理界面'));
  }

  /**
   * 显示主菜单
   */
  async showMainMenu() {
    console.log(chalk.blue.bold('\n📦 MCP Service Manager\n'));
    console.log('MCP (Model Context Protocol) 让 Claude Desktop 连接到各种数据源和工具。\n');
    
    const choices = [
      { name: '📋 查看所有 MCP 服务状态', value: 'list' },
      { name: '➕ 安装 MCP 服务', value: 'install' },
      { name: '➖ 卸载 MCP 服务', value: 'uninstall' },
      { name: '⚙️  配置 MCP 服务', value: 'config' },
      { name: '🔧 检查 MCP 配置', value: 'doctor' },
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
      case 'config':
        await this.interactiveConfig();
        break;
      case 'doctor':
        await this.doctor();
        break;
      case 'exit':
        process.exit(0);
    }
  }

  /**
   * 交互式安装
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
      console.log(chalk.yellow('\n✅ 所有 MCP 服务都已安装！'));
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

    for (const serviceName of services) {
      await this.installService(serviceName);
    }

    console.log(chalk.green.bold('\n✅ 安装完成！'));
    console.log(chalk.yellow('💡 请重启 Claude Desktop 以应用更改'));
  }

  /**
   * 安装单个服务
   */
  async installService(name) {
    const mcp = this.registry[name];
    if (!mcp) {
      throw new Error(`未知的 MCP 服务: ${name}`);
    }

    console.log(chalk.blue(`\n📦 安装 ${mcp.displayName}...`));

    let config = { ...mcp.config };

    // 如果需要配置，收集配置信息
    if (mcp.needsConfig && mcp.configFields) {
      console.log(chalk.yellow('需要配置以下信息：'));
      
      const env = {};
      for (const field of mcp.configFields) {
        // 如果字段不是必需的且用户留空，则跳过
        if (!field.required) {
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
            env[field.name] = value;
          }
        } else {
          const { value } = await inquirer.prompt([
            {
              type: field.type || 'input',
              name: 'value',
              message: field.message,
              default: field.default || '',
              mask: field.type === 'password' ? '*' : undefined,
              validate: field.validate || ((input) => {
                if (!input || input.trim() === '') {
                  return '此字段为必填项';
                }
                return true;
              })
            }
          ]);
          env[field.name] = value;
        }
      }
      
      if (Object.keys(env).length > 0) {
        config.env = env;
      }
    }

    // 更新 Claude Desktop 配置
    await this.updateClaudeConfig(name, config);
    
    console.log(chalk.green(`✅ ${mcp.displayName} 安装成功！`));
  }

  /**
   * 更新 Claude Desktop 配置
   */
  async updateClaudeConfig(name, serverConfig) {
    const config = await this.readClaudeConfig();
    
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    config.mcpServers[name] = serverConfig;
    
    await this.writeClaudeConfig(config);
  }

  /**
   * 交互式卸载
   */
  async interactiveUninstall() {
    const installed = await this.getInstalledMCPs();
    
    if (installed.size === 0) {
      console.log(chalk.yellow('\n没有已安装的 MCP 服务'));
      return;
    }

    const choices = Array.from(installed.keys()).map(name => {
      const mcp = this.registry[name];
      if (mcp) {
        return {
          name: `${mcp.displayName} - ${mcp.description}`,
          value: name
        };
      }
      return {
        name: `${name} (未知服务)`,
        value: name
      };
    });

    const { services } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'services',
        message: '选择要卸载的 MCP 服务（空格选择，回车确认）：',
        choices
      }
    ]);

    if (services.length === 0) {
      console.log(chalk.gray('未选择任何服务'));
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确定要卸载 ${services.length} 个服务吗？`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('已取消'));
      return;
    }

    for (const serviceName of services) {
      await this.uninstallService(serviceName);
    }

    console.log(chalk.green.bold('\n✅ 卸载完成！'));
    console.log(chalk.yellow('💡 请重启 Claude Desktop 以应用更改'));
  }

  /**
   * 卸载单个服务
   */
  async uninstallService(name) {
    const mcp = this.registry[name];
    const displayName = mcp ? mcp.displayName : name;
    
    console.log(chalk.blue(`\n🗑️  卸载 ${displayName}...`));

    const config = await this.readClaudeConfig();
    
    if (config.mcpServers && config.mcpServers[name]) {
      delete config.mcpServers[name];
      await this.writeClaudeConfig(config);
      console.log(chalk.green(`✅ ${displayName} 卸载成功！`));
    } else {
      console.log(chalk.yellow(`⚠️  ${displayName} 未安装`));
    }
  }

  /**
   * 交互式配置
   */
  async interactiveConfig() {
    const installed = await this.getInstalledMCPs();
    const configurable = Array.from(installed.keys())
      .filter(name => this.registry[name]?.needsConfig)
      .map(name => ({
        name: `${this.registry[name].displayName} - ${this.registry[name].description}`,
        value: name
      }));

    if (configurable.length === 0) {
      console.log(chalk.yellow('\n没有需要配置的 MCP 服务'));
      return;
    }

    const { service } = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: '选择要重新配置的 MCP 服务：',
        choices: configurable
      }
    ]);

    await this.configureService(service);
    
    console.log(chalk.green.bold('\n✅ 配置完成！'));
    console.log(chalk.yellow('💡 请重启 Claude Desktop 以应用更改'));
  }

  /**
   * 配置单个服务
   */
  async configureService(name) {
    const mcp = this.registry[name];
    if (!mcp || !mcp.needsConfig) {
      console.log(chalk.yellow(`${name} 不需要配置`));
      return;
    }

    console.log(chalk.blue(`\n⚙️  配置 ${mcp.displayName}...`));

    const config = await this.readClaudeConfig();
    const currentConfig = config.mcpServers?.[name] || { ...mcp.config };

    if (mcp.configFields) {
      const env = {};
      
      for (const field of mcp.configFields) {
        const currentValue = currentConfig.env?.[field.name] || '';
        
        const { value } = await inquirer.prompt([
          {
            type: field.type || 'input',
            name: 'value',
            message: field.message,
            default: currentValue || field.default || '',
            mask: field.type === 'password' ? '*' : undefined,
            validate: field.validate || (() => true)
          }
        ]);
        
        if (value && value.trim() !== '') {
          env[field.name] = value;
        }
      }
      
      if (Object.keys(env).length > 0) {
        currentConfig.env = env;
      }
    }

    await this.updateClaudeConfig(name, currentConfig);
    console.log(chalk.green(`✅ ${mcp.displayName} 配置更新成功！`));
  }

  /**
   * 检查 MCP 配置
   */
  async doctor() {
    console.log(chalk.blue.bold('\n🔍 检查 MCP 配置...\n'));

    const checks = [];
    
    // 检查 Claude Desktop 是否安装
    const platform = os.platform();
    let claudeInstalled = false;
    
    if (platform === 'darwin') {
      claudeInstalled = await fs.pathExists('/Applications/Claude.app');
    } else if (platform === 'win32') {
      // Windows 检查逻辑
      claudeInstalled = await fs.pathExists(path.join(process.env.LOCALAPPDATA || '', 'Claude'));
    }
    
    checks.push({
      name: 'Claude Desktop',
      status: claudeInstalled,
      message: claudeInstalled ? '已安装' : '未安装'
    });

    // 检查配置文件
    const configExists = await fs.pathExists(this.claudeConfigPath);
    checks.push({
      name: '配置文件',
      status: configExists,
      message: configExists ? this.claudeConfigPath : '不存在'
    });

    // 检查 Node.js
    try {
      const { execSync } = require('child_process');
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
      checks.push({
        name: 'Node.js',
        status: true,
        message: nodeVersion
      });
    } catch (error) {
      checks.push({
        name: 'Node.js',
        status: false,
        message: '未安装'
      });
    }

    // 检查已安装的 MCP 服务
    const installed = await this.getInstalledMCPs();
    checks.push({
      name: 'MCP 服务',
      status: installed.size > 0,
      message: `已安装 ${installed.size} 个服务`
    });

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

    if (installed.size > 0) {
      console.log(chalk.blue.bold('\n已安装的 MCP 服务：'));
      for (const [name, config] of installed.entries()) {
        const mcp = this.registry[name];
        console.log(chalk.gray(`  • ${mcp ? mcp.displayName : name}`));
      }
    }

    // 提供修复建议
    const hasIssues = checks.some(c => !c.status);
    if (hasIssues) {
      console.log(chalk.yellow.bold('\n💡 修复建议：'));
      
      if (!claudeInstalled) {
        console.log(chalk.yellow('  • 请先安装 Claude Desktop: https://claude.ai/download'));
      }
      
      if (!configExists && claudeInstalled) {
        console.log(chalk.yellow('  • 运行 Claude Desktop 一次以创建配置文件'));
      }
      
      if (!checks.find(c => c.name === 'Node.js')?.status) {
        console.log(chalk.yellow('  • 安装 Node.js: https://nodejs.org/'));
      }
    } else {
      console.log(chalk.green.bold('\n✅ 所有检查通过！'));
    }
  }
}

module.exports = MCPManager;