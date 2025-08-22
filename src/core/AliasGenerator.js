const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const chalk = require('chalk');

class AliasGenerator {
  constructor(configStorage) {
    this.configStorage = configStorage;
    const homeDir = os.homedir();
    this.aliasesFile = path.join(homeDir, '.cc-config', 'aliases.sh');
    this.profileFiles = {
      bash: path.join(homeDir, '.bashrc'),
      zsh: path.join(homeDir, '.zshrc'),
      fish: path.join(homeDir, '.config', 'fish', 'config.fish'),
    };
    this.sourceCommand = 'source ~/.cc-config/aliases.sh';
  }

  /**
   * 生成别名脚本
   */
  async generateAliases() {
    try {
      await this.configStorage.initialize();
      const providers = await this.configStorage.listProviders({
        includeMetadata: false,
      });

      const enabledProviders = Object.entries(providers).filter(
        ([_, config]) => config.enabled
      );

      if (enabledProviders.length === 0) {
        // 创建空的别名文件但包含基本框架
        const script = this.generateEmptyScript();
        await this.writeAliasFile(script);
        return script;
      }

      const header = this.generateHeader();
      const helperFunction = this.generateHelperFunction();
      const aliases = this.generateAliasCommands(enabledProviders);
      const footer = this.generateFooter();

      const script = [header, helperFunction, aliases, footer].join('\n\n');

      await this.writeAliasFile(script);
      return script;
    } catch (error) {
      throw new Error(`生成别名失败: ${error.message}`);
    }
  }

  /**
   * 生成脚本头部注释
   */
  generateHeader() {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return `#!/bin/bash
# Claude Code Kit - 自动生成的别名配置
# 此文件由 cc-config 自动生成，请勿手动编辑
# 生成时间: ${timestamp}
# 版本: ${require('../../package.json').version || '1.0.0'}
#
# 使用方法：
# 1. 在 shell 配置文件中添加: source ~/.cc-config/aliases.sh
# 2. 重新加载 shell 配置: source ~/.zshrc (或 ~/.bashrc)
# 3. 使用别名命令: <alias> "你的问题"
#
# 管理命令：
# - cc-providers: 查看所有服务商
# - cc-add: 添加新服务商
# - cc-reload: 重新加载别名配置`;
  }

  /**
   * 生成配置加载辅助函数
   */
  generateHelperFunction() {
    return `# 配置加载辅助函数
_cc_load_config() {
    local provider_name="$1"
    local config_file="$HOME/.cc-config/providers/\${provider_name}.json"
    
    if [ ! -f "$config_file" ]; then
        echo "❌ 错误: 配置文件不存在: $config_file" >&2
        echo "💡 提示: 运行 'cc-config provider add' 添加服务商配置" >&2
        return 1
    fi
    
    # 检查 cc-config 命令是否可用
    if ! command -v cc-config >/dev/null 2>&1; then
        echo "❌ 错误: cc-config 命令不可用" >&2
        echo "💡 提示: 请确保 cc-config 已正确安装并在 PATH 中" >&2
        return 1
    fi
    
    # 使用 cc-config 命令解密并读取配置
    local config_json
    if ! config_json=$(cc-config provider get "$provider_name" --json 2>/dev/null); then
        echo "❌ 错误: 无法读取服务商配置: $provider_name" >&2
        echo "💡 提示: 运行 'cc-config provider test $provider_name' 检查配置" >&2
        return 1
    fi
    
    # 解析配置并设置环境变量
    if command -v jq >/dev/null 2>&1; then
        export ANTHROPIC_AUTH_TOKEN=$(echo "$config_json" | jq -r ".apiKey // empty")
        export ANTHROPIC_BASE_URL=$(echo "$config_json" | jq -r ".baseURL // empty")
        export API_TIMEOUT_MS=$(echo "$config_json" | jq -r ".timeout // 30000")
        export CC_PROVIDER_ALIAS=$(echo "$config_json" | jq -r ".alias // empty")
    else
        echo "⚠️  警告: 建议安装 jq 工具以获得更好的体验" >&2
        echo "💡 安装方法: brew install jq (macOS) 或 apt-get install jq (Ubuntu)" >&2
        # 简单的字符串解析作为备用方案
        export ANTHROPIC_AUTH_TOKEN=$(echo "$config_json" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
        export ANTHROPIC_BASE_URL=$(echo "$config_json" | grep -o '"baseURL":"[^"]*"' | cut -d'"' -f4)
        export API_TIMEOUT_MS="30000"
        export CC_PROVIDER_ALIAS=$(echo "$config_json" | grep -o '"alias":"[^"]*"' | cut -d'"' -f4)
    fi
    
    # 验证关键配置
    if [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
        echo "❌ 错误: 未找到有效的 API 密钥" >&2
        return 1
    fi
    
    if [ -z "$ANTHROPIC_BASE_URL" ]; then
        echo "❌ 错误: 未找到有效的 Base URL" >&2
        return 1
    fi
    
    return 0
}

# 显示当前配置信息
_cc_show_config() {
    local provider_name="$1"
    echo "🔧 当前配置: $provider_name ($CC_PROVIDER_ALIAS)"
    echo "🌐 API 端点: $ANTHROPIC_BASE_URL"
    echo "⏱️  超时设置: $API_TIMEOUT_MS ms"
    echo "🔑 API 密钥: \${ANTHROPIC_AUTH_TOKEN:0:12}..."
}

# 测试配置连接
_cc_test_config() {
    local provider_name="$1"
    echo "🔍 测试服务商配置: $provider_name"
    cc-config provider test "$provider_name"
}

# 重新加载别名配置
_cc_reload_aliases() {
    echo "🔄 重新生成别名配置..."
    if cc-config provider regenerate-aliases; then
        echo "✅ 别名配置已更新"
        echo "💡 请运行 'source ~/.cc-config/aliases.sh' 重新加载"
    else
        echo "❌ 别名配置更新失败"
        return 1
    fi
}`;
  }

  /**
   * 生成别名命令
   */
  generateAliasCommands(providers) {
    const aliases = [];

    aliases.push('# ===========================================');
    aliases.push('# 服务商别名命令');
    aliases.push('# ===========================================');
    aliases.push('');

    for (const [name, config] of providers) {
      const description = config.description || `${config.baseURL} 服务商`;
      const safeAlias = this.sanitizeAlias(config.alias);

      aliases.push(`# ${description}`);
      aliases.push(`# 服务商: ${name} | 别名: ${safeAlias}`);

      // 主要命令别名
      aliases.push(
        `alias ${safeAlias}='_cc_load_config "${name}" && claude "\$@"'`
      );

      // 信息查看别名
      aliases.push(
        `alias ${safeAlias}-info='_cc_load_config "${name}" && _cc_show_config "${name}"'`
      );

      // 连接测试别名
      aliases.push(`alias ${safeAlias}-test='_cc_test_config "${name}"'`);

      aliases.push('');
    }

    aliases.push('# ===========================================');
    aliases.push('# 管理命令别名');
    aliases.push('# ===========================================');
    aliases.push('alias cc-providers="cc-config provider list"');
    aliases.push(
      'alias cc-providers-detail="cc-config provider list --detail"'
    );
    aliases.push('alias cc-add="cc-config provider add"');
    aliases.push('alias cc-edit="cc-config provider edit"');
    aliases.push('alias cc-remove="cc-config provider remove"');
    aliases.push('alias cc-test="cc-config provider test"');
    aliases.push('alias cc-stats="cc-config provider stats"');
    aliases.push('alias cc-reload="_cc_reload_aliases"');
    aliases.push('alias cc-shell="cc-config provider install-shell"');
    aliases.push('');

    aliases.push('# ===========================================');
    aliases.push('# 便捷功能别名');
    aliases.push('# ===========================================');
    aliases.push(
      'alias cc-which="echo \\"当前活跃的服务商: $CC_PROVIDER_ALIAS\\""'
    );
    aliases.push(
      'alias cc-help="echo \\"可用命令: cc-providers, cc-add, cc-edit, cc-remove, cc-test, cc-stats, cc-reload\\""'
    );

    return aliases.join('\n');
  }

  /**
   * 生成空脚本（当没有启用的服务商时）
   */
  generateEmptyScript() {
    const header = this.generateHeader();
    const footer = this.generateFooter();

    return [
      header,
      '',
      '# 暂无启用的服务商配置',
      '# 请运行 "cc-config provider add" 添加服务商',
      '',
      'echo "⚠️  暂无可用的服务商别名"',
      'echo "💡 请运行 \\"cc-config provider add\\" 添加服务商配置"',
      '',
      footer,
    ].join('\n');
  }

  /**
   * 生成脚本尾部
   */
  generateFooter() {
    return `# ===========================================
# 脚本完成标记
# ===========================================

# 显示加载成功信息
if [ "\${CC_ALIASES_LOADED:-}" != "true" ]; then
    export CC_ALIASES_LOADED="true"
    echo "✅ Claude Code Kit 别名已加载"
    echo "💡 运行 'cc-help' 查看可用命令"
fi`;
  }

  /**
   * 清理别名名称，确保安全
   */
  sanitizeAlias(alias) {
    // 只允许字母、数字、下划线和连字符
    return alias.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /**
   * 写入别名文件
   */
  async writeAliasFile(content) {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(this.aliasesFile));

      // 写入文件
      await fs.writeFile(this.aliasesFile, content, 'utf8');
      await fs.chmod(this.aliasesFile, 0o755); // 可执行权限

      return true;
    } catch (error) {
      throw new Error(`写入别名文件失败: ${error.message}`);
    }
  }

  /**
   * 检测用户的 Shell 类型
   */
  detectShell() {
    const shell = process.env.SHELL || '';

    if (shell.includes('zsh')) {
      return 'zsh';
    } else if (shell.includes('bash')) {
      return 'bash';
    } else if (shell.includes('fish')) {
      return 'fish';
    } else {
      return 'bash'; // 默认假设是 bash
    }
  }

  /**
   * 获取 Shell 配置文件路径
   */
  getShellConfigFile(shell = null) {
    const shellType = shell || this.detectShell();
    return this.profileFiles[shellType] || this.profileFiles.bash;
  }

  /**
   * 获取所有可能的 Shell 配置文件
   */
  getAllShellConfigFiles() {
    const files = [];

    for (const [shell, filePath] of Object.entries(this.profileFiles)) {
      if (fs.existsSync(filePath)) {
        files.push({ shell, filePath });
      }
    }

    return files;
  }

  /**
   * 更新 Shell 配置文件
   */
  async updateShellConfig(options = {}) {
    try {
      const { force = false, allShells = false } = options;
      const results = [];

      if (allShells) {
        // 更新所有发现的 Shell 配置文件
        const allFiles = this.getAllShellConfigFiles();

        for (const { shell, filePath } of allFiles) {
          const result = await this.updateSingleShellConfig(
            shell,
            filePath,
            force
          );
          results.push({ shell, ...result });
        }

        return {
          updated: results.some(r => r.updated),
          results,
          message: `更新了 ${results.filter(r => r.updated).length} 个 Shell 配置文件`,
        };
      } else {
        // 只更新当前 Shell
        const shell = this.detectShell();
        const configFile = this.getShellConfigFile(shell);
        const result = await this.updateSingleShellConfig(
          shell,
          configFile,
          force
        );

        return {
          shell,
          configFile,
          ...result,
        };
      }
    } catch (error) {
      throw new Error(`更新 Shell 配置失败: ${error.message}`);
    }
  }

  /**
   * 更新单个 Shell 配置文件
   */
  async updateSingleShellConfig(shell, configFile, force = false) {
    try {
      // 确保配置文件存在
      if (!(await fs.pathExists(configFile))) {
        await fs.ensureFile(configFile);
      }

      // 读取当前配置文件内容
      const content = await fs.readFile(configFile, 'utf8');

      // 检查是否已经添加了 source 命令
      const marker = '# Claude Code Kit 别名配置';
      const hasExisting =
        content.includes(marker) || content.includes(this.sourceCommand);

      if (hasExisting && !force) {
        return {
          updated: false,
          message: `${shell} 配置已存在`,
          filePath: configFile,
        };
      }

      // 移除旧的配置（如果存在）
      let newContent = content;
      if (hasExisting) {
        const lines = content.split('\n');
        const filteredLines = lines.filter(
          line => !line.includes(this.sourceCommand) && !line.includes(marker)
        );
        newContent = filteredLines.join('\n');
      }

      // 添加新的配置
      const configBlock = `

# Claude Code Kit 别名配置
# 自动生成于: ${new Date().toLocaleString()}
${this.sourceCommand}
`;

      newContent = newContent.trimEnd() + configBlock;
      await fs.writeFile(configFile, newContent, 'utf8');

      return {
        updated: true,
        message: `已更新 ${shell} 配置文件`,
        filePath: configFile,
      };
    } catch (error) {
      throw new Error(`更新 ${shell} 配置失败: ${error.message}`);
    }
  }

  /**
   * 移除 Shell 配置
   */
  async removeShellConfig(options = {}) {
    try {
      const { allShells = false } = options;
      const results = [];

      if (allShells) {
        // 从所有发现的 Shell 配置文件中移除
        const allFiles = this.getAllShellConfigFiles();

        for (const { shell, filePath } of allFiles) {
          const result = await this.removeSingleShellConfig(shell, filePath);
          results.push({ shell, ...result });
        }

        return {
          removed: results.some(r => r.removed),
          results,
          message: `从 ${results.filter(r => r.removed).length} 个 Shell 配置文件中移除了配置`,
        };
      } else {
        // 只从当前 Shell 移除
        const shell = this.detectShell();
        const configFile = this.getShellConfigFile(shell);
        const result = await this.removeSingleShellConfig(shell, configFile);

        return {
          shell,
          configFile,
          ...result,
        };
      }
    } catch (error) {
      throw new Error(`移除 Shell 配置失败: ${error.message}`);
    }
  }

  /**
   * 从单个 Shell 配置文件中移除配置
   */
  async removeSingleShellConfig(shell, configFile) {
    try {
      if (!(await fs.pathExists(configFile))) {
        return {
          removed: false,
          message: `${shell} 配置文件不存在`,
          filePath: configFile,
        };
      }

      // 读取当前配置文件内容
      const content = await fs.readFile(configFile, 'utf8');

      // 移除相关行
      const lines = content.split('\n');
      const filteredLines = lines.filter(
        line =>
          !line.includes(this.sourceCommand) &&
          !line.includes('Claude Code Kit 别名配置') &&
          !line.includes('# 自动生成于:')
      );

      if (filteredLines.length === lines.length) {
        return {
          removed: false,
          message: `${shell} 配置中未找到相关配置`,
          filePath: configFile,
        };
      }

      // 清理多余的空行
      const cleanedContent = filteredLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
      await fs.writeFile(configFile, cleanedContent, 'utf8');

      return {
        removed: true,
        message: `已从 ${shell} 配置文件中移除相关配置`,
        filePath: configFile,
      };
    } catch (error) {
      throw new Error(`从 ${shell} 配置移除失败: ${error.message}`);
    }
  }

  /**
   * 验证别名配置
   */
  async validateAliases() {
    try {
      await this.configStorage.initialize();
      const providers = await this.configStorage.listProviders({
        includeMetadata: false,
      });
      const issues = [];

      // 检查是否有重复的别名
      const aliases = Object.values(providers)
        .map(p => p.alias)
        .filter(Boolean);
      const duplicates = aliases.filter(
        (alias, index) => aliases.indexOf(alias) !== index
      );

      if (duplicates.length > 0) {
        issues.push({
          type: 'duplicate_alias',
          message: `发现重复的别名: ${[...new Set(duplicates)].join(', ')}`,
          severity: 'error',
        });
      }

      // 检查别名是否与系统命令冲突
      const systemCommands = [
        'ls',
        'cd',
        'pwd',
        'echo',
        'cat',
        'grep',
        'find',
        'git',
        'cp',
        'mv',
        'rm',
        'mkdir',
        'chmod',
        'chown',
        'ps',
        'kill',
        'curl',
        'wget',
        'ssh',
        'scp',
        'rsync',
        'tar',
        'zip',
        'unzip',
      ];
      const conflicts = aliases.filter(alias => systemCommands.includes(alias));

      if (conflicts.length > 0) {
        issues.push({
          type: 'system_conflict',
          message: `别名与系统命令冲突: ${conflicts.join(', ')}`,
          severity: 'warning',
        });
      }

      // 检查别名格式是否有效
      const invalidAliases = aliases.filter(
        alias => !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias)
      );

      if (invalidAliases.length > 0) {
        issues.push({
          type: 'invalid_format',
          message: `别名格式无效: ${invalidAliases.join(', ')}`,
          severity: 'error',
        });
      }

      // 检查别名文件是否存在
      if (!(await fs.pathExists(this.aliasesFile))) {
        issues.push({
          type: 'missing_alias_file',
          message: '别名文件不存在，请运行别名生成命令',
          severity: 'warning',
        });
      }

      // 检查 Shell 配置是否已安装
      const shell = this.detectShell();
      const configFile = this.getShellConfigFile(shell);

      if (await fs.pathExists(configFile)) {
        const content = await fs.readFile(configFile, 'utf8');
        if (!content.includes(this.sourceCommand)) {
          issues.push({
            type: 'shell_not_configured',
            message: `当前 ${shell} 配置文件中未找到别名加载配置`,
            severity: 'info',
          });
        }
      } else {
        issues.push({
          type: 'shell_config_missing',
          message: `${shell} 配置文件不存在`,
          severity: 'info',
        });
      }

      return {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        summary: {
          total: Object.keys(providers).length,
          enabled: Object.values(providers).filter(p => p.enabled).length,
          aliasCount: aliases.length,
          duplicates: duplicates.length,
          conflicts: conflicts.length,
        },
      };
    } catch (error) {
      throw new Error(`验证别名配置失败: ${error.message}`);
    }
  }

  /**
   * 获取别名使用统计
   */
  async getAliasStats() {
    try {
      await this.configStorage.initialize();
      const providers = await this.configStorage.listProviders({
        includeMetadata: true,
      });
      const validation = await this.validateAliases();

      const aliases = Object.values(providers).map(p => ({
        alias: p.alias,
        enabled: p.enabled,
        description: p.description || '',
        hasApiKey: p.hasApiKey,
        lastModified: p.lastModified,
      }));

      return {
        total: Object.keys(providers).length,
        enabled: Object.values(providers).filter(p => p.enabled).length,
        disabled: Object.values(providers).filter(p => !p.enabled).length,
        withApiKeys: Object.values(providers).filter(p => p.hasApiKey).length,
        aliases,
        validation: {
          valid: validation.valid,
          issueCount: validation.issues.length,
          errors: validation.issues.filter(i => i.severity === 'error').length,
          warnings: validation.issues.filter(i => i.severity === 'warning')
            .length,
        },
        shell: {
          current: this.detectShell(),
          aliasFile: this.aliasesFile,
          configFiles: this.getAllShellConfigFiles(),
        },
      };
    } catch (error) {
      throw new Error(`获取别名统计失败: ${error.message}`);
    }
  }

  /**
   * 清理别名配置
   */
  async cleanupAliases() {
    try {
      const results = {
        aliasFile: false,
        shellConfigs: [],
        errors: [],
      };

      // 删除别名文件
      try {
        if (await fs.pathExists(this.aliasesFile)) {
          await fs.remove(this.aliasesFile);
          results.aliasFile = true;
        }
      } catch (error) {
        results.errors.push(`删除别名文件失败: ${error.message}`);
      }

      // 从 Shell 配置中移除
      try {
        const removeResult = await this.removeShellConfig({ allShells: true });
        results.shellConfigs = removeResult.results || [];
      } catch (error) {
        results.errors.push(`移除 Shell 配置失败: ${error.message}`);
      }

      return {
        success: results.errors.length === 0,
        cleaned: results.aliasFile || results.shellConfigs.some(r => r.removed),
        details: results,
      };
    } catch (error) {
      throw new Error(`清理别名配置失败: ${error.message}`);
    }
  }

  /**
   * 获取别名安装状态
   */
  async getInstallStatus() {
    try {
      const status = {
        aliasFile: {
          exists: await fs.pathExists(this.aliasesFile),
          path: this.aliasesFile,
        },
        shells: [],
        recommendations: [],
      };

      // 检查所有 Shell 配置文件
      for (const [shell, filePath] of Object.entries(this.profileFiles)) {
        const exists = await fs.pathExists(filePath);
        let configured = false;

        if (exists) {
          const content = await fs.readFile(filePath, 'utf8');
          configured = content.includes(this.sourceCommand);
        }

        status.shells.push({
          shell,
          filePath,
          exists,
          configured,
        });
      }

      // 生成建议
      if (!status.aliasFile.exists) {
        status.recommendations.push({
          type: 'generate_aliases',
          message: '运行 "cc-config provider regenerate-aliases" 生成别名文件',
        });
      }

      const currentShell = this.detectShell();
      const currentShellConfig = status.shells.find(
        s => s.shell === currentShell
      );

      if (currentShellConfig && !currentShellConfig.configured) {
        status.recommendations.push({
          type: 'install_shell',
          message: `运行 "cc-config provider install-shell" 安装到 ${currentShell} 配置`,
        });
      }

      return status;
    } catch (error) {
      throw new Error(`获取安装状态失败: ${error.message}`);
    }
  }
}

module.exports = AliasGenerator;
