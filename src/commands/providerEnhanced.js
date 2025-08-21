const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const axios = require('axios');
const ProviderManager = require('../core/ProviderManager');
const AliasGenerator = require('../core/AliasGenerator');
const {
  handleError,
  handleSuccess,
  handleInfo,
  handleWarning,
} = require('../utils/errorHandler');

const providerManager = new ProviderManager();

/**
 * 增强的 Provider 命令集合
 */
class ProviderCommandsEnhanced {
  /**
   * 添加服务商 - 支持批量导入
   */
  static async add(options) {
    try {
      if (options.file) {
        return await this.importFromFile(options.file, options);
      }
      
      if (options.batch) {
        return await this.batchAdd(options);
      }
      
      return await this.addSingle(options);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  }

  /**
   * 添加单个服务商
   */
  static async addSingle(options) {
    const configStorage = providerManager.configStorage;
    const aliasGenerator = new AliasGenerator(configStorage);

    console.log(chalk.blue('🔧 添加新的服务商配置\n'));

    // 交互式配置
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '服务商标识 (唯一ID):',
        default: options.name,
        validate: async input => {
          if (!input.trim()) return '请输入服务商标识';
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
            return '标识只能包含字母、数字、下划线和连字符，且必须以字母开头';
          }
          
          // 检查是否已存在
          try {
            await providerManager.getProvider(input);
            return `服务商 "${input}" 已存在`;
          } catch {
            return true; // 不存在，可以使用
          }
        },
      },
      {
        type: 'input',
        name: 'alias',
        message: '别名 (用于Shell命令):',
        default: answers => options.alias || answers.name,
        validate: async (input, _answers) => {
          if (!input.trim()) return '请输入别名';
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
            return '别名只能包含字母、数字、下划线和连字符，且必须以字母开头';
          }

          // 检查别名是否已被使用
          const isAvailable = await providerManager.isAliasAvailable(input);
          if (!isAvailable) {
            const suggested = await providerManager.suggestAlias(input);
            return `别名 "${input}" 已被使用，建议使用: ${suggested}`;
          }

          return true;
        },
      },
      {
        type: 'input',
        name: 'baseURL',
        message: 'API 基础 URL:',
        default: options.url,
        validate: input => {
          if (!input.trim()) return '请输入API基础URL';
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的URL';
          }
        },
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API 密钥:',
        default: options.key || '',
        validate: input => {
          if (!input.trim()) return '请输入API密钥';
          if (input.length < 10) return 'API密钥长度至少10个字符';
          return true;
        },
      },
      {
        type: 'input',
        name: 'timeout',
        message: '请求超时时间 (秒):',
        default: options.timeout || '30',
        validate: input => {
          const num = parseInt(input);
          if (isNaN(num) || num <= 0 || num > 300) {
            return '请输入有效的超时时间 (1-300秒)';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: '描述信息 (可选):',
        default: '',
      },
      {
        type: 'confirm',
        name: 'enabled',
        message: '启用此服务商?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'testConnection',
        message: '是否测试API连接?',
        default: true,
      },
    ]);

    const config = {
      alias: answers.alias,
      baseURL: answers.baseURL,
      apiKey: answers.apiKey,
      timeout: parseInt(answers.timeout) * 1000, // 转换为毫秒
      description: answers.description,
      enabled: answers.enabled,
    };

    // 测试连接
    if (answers.testConnection) {
      const testResult = await this.testConnection(config);
      if (!testResult.success) {
        const { continueAnyway } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueAnyway',
            message: '连接测试失败，是否继续保存配置?',
            default: true,
          },
        ]);

        if (!continueAnyway) {
          console.log(chalk.yellow('❌ 操作已取消'));
          return;
        }
      }
    }

    // 确认配置
    await this.confirmAndSave(answers.name, config, aliasGenerator);
  }

  /**
   * 批量添加服务商
   */
  static async batchAdd(options) {
    console.log(chalk.blue('📦 批量添加服务商配置\n'));

    const providers = [];
    let addMore = true;

    while (addMore) {
      console.log(chalk.cyan(`\n📝 配置第 ${providers.length + 1} 个服务商:`));
      
      const provider = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '服务商标识:',
          validate: input => input.trim() ? true : '请输入服务商标识',
        },
        {
          type: 'input',
          name: 'alias',
          message: '别名:',
          validate: input => input.trim() ? true : '请输入别名',
        },
        {
          type: 'input',
          name: 'baseURL',
          message: 'API URL:',
          validate: input => {
            try {
              new URL(input);
              return true;
            } catch {
              return '请输入有效的URL';
            }
          },
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API 密钥:',
          validate: input => input.length >= 10 ? true : 'API密钥长度至少10个字符',
        },
      ]);

      providers.push({
        ...provider,
        timeout: 30000,
        description: `批量导入的服务商: ${provider.name}`,
        enabled: true,
      });

      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: '继续添加更多服务商?',
          default: true,
        },
      ]);

      addMore = continueAdding;
    }

    // 确认批量保存
    console.log(chalk.yellow('\n📋 待添加的服务商:'));
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.name} (${provider.alias})`);
    });

    const { confirmBatch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmBatch',
        message: `确认添加这 ${providers.length} 个服务商?`,
        default: true,
      },
    ]);

    if (!confirmBatch) {
      console.log(chalk.yellow('❌ 批量操作已取消'));
      return;
    }

    // 执行批量保存
    const results = [];
    for (const provider of providers) {
      try {
        await providerManager.addProvider(provider.name, {
          alias: provider.alias,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          timeout: provider.timeout,
          description: provider.description,
          enabled: provider.enabled,
        });
        results.push({ name: provider.name, success: true });
        handleSuccess(`服务商 "${provider.name}" 添加成功`);
      } catch (error) {
        results.push({ name: provider.name, success: false, error: error.message });
        handleError(`服务商 "${provider.name}" 添加失败: ${error.message}`);
      }
    }

    // 显示结果汇总
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.blue(`\n📊 批量添加结果:`));
    console.log(`成功: ${successful}`);
    console.log(`失败: ${failed}`);

    if (successful > 0) {
      // 重新生成别名
      try {
        const configStorage = providerManager.configStorage;
        const aliasGenerator = new AliasGenerator(configStorage);
        await aliasGenerator.generateAliases();
        handleInfo('别名配置已更新');
      } catch (error) {
        handleWarning(`别名生成失败: ${error.message}`);
      }
    }
  }

  /**
   * 从文件导入服务商配置
   */
  static async importFromFile(filePath, options) {
    console.log(chalk.blue(`📂 从文件导入服务商配置: ${filePath}\n`));

    try {
      const data = await fs.readJson(filePath);
      
      if (!Array.isArray(data) && typeof data === 'object') {
        // 单个配置对象，转换为数组
        const singleData = data;
        data = [singleData];
      }

      if (!Array.isArray(data)) {
        throw new Error('配置文件格式错误，应为对象或对象数组');
      }

      console.log(chalk.blue(`发现 ${data.length} 个服务商配置`));

      // 验证配置格式
      const validConfigs = [];
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const config = data[i];
        try {
          this.validateImportConfig(config);
          validConfigs.push(config);
        } catch (error) {
          errors.push(`配置 ${i + 1}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.log(chalk.red('❌ 配置验证错误:'));
        errors.forEach(error => console.log(`  - ${error}`));
        
        if (validConfigs.length === 0) {
          throw new Error('没有有效的配置可以导入');
        }

        const { continueWithValid } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueWithValid',
            message: `是否继续导入 ${validConfigs.length} 个有效配置?`,
            default: true,
          },
        ]);

        if (!continueWithValid) {
          console.log(chalk.yellow('❌ 导入已取消'));
          return;
        }
      }

      // 执行导入
      const results = [];
      for (const config of validConfigs) {
        try {
          await providerManager.addProvider(config.name, {
            alias: config.alias,
            baseURL: config.baseURL,
            apiKey: config.apiKey,
            timeout: (config.timeout || 30) * 1000,
            description: config.description || `从 ${filePath} 导入`,
            enabled: config.enabled !== false,
          });
          results.push({ name: config.name, success: true });
          handleSuccess(`导入服务商 "${config.name}" 成功`);
        } catch (error) {
          results.push({ name: config.name, success: false, error: error.message });
          handleError(`导入服务商 "${config.name}" 失败: ${error.message}`);
        }
      }

      // 显示导入结果
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(chalk.blue(`\n📊 导入结果:`));
      console.log(`成功: ${successful}`);
      console.log(`失败: ${failed}`);

      if (successful > 0) {
        // 重新生成别名
        const configStorage = providerManager.configStorage;
        const aliasGenerator = new AliasGenerator(configStorage);
        await aliasGenerator.generateAliases();
        handleInfo('别名配置已更新');
      }

    } catch (error) {
      throw new Error(`文件导入失败: ${error.message}`);
    }
  }

  /**
   * 导出服务商配置到文件
   */
  static async export(options) {
    try {
      console.log(chalk.blue('📤 导出服务商配置\n'));

      const providers = await providerManager.getProviders();
      
      if (Object.keys(providers).length === 0) {
        console.log(chalk.yellow('📝 暂无服务商配置可导出'));
        return;
      }

      // 选择导出的服务商
      let selectedProviders = providers;
      
      if (!options.all) {
        const choices = Object.keys(providers).map(name => ({
          name: `${name} (${providers[name].alias})`,
          value: name,
          checked: true,
        }));

        const { selected } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selected',
            message: '选择要导出的服务商:',
            choices,
            validate: input => input.length > 0 ? true : '至少选择一个服务商',
          },
        ]);

        selectedProviders = {};
        selected.forEach(name => {
          selectedProviders[name] = providers[name];
        });
      }

      // 处理敏感数据
      const exportData = Object.entries(selectedProviders).map(([name, config]) => ({
        name,
        alias: config.alias,
        baseURL: config.baseURL,
        apiKey: options.includeSensitive ? config.apiKey : '[REDACTED]',
        timeout: config.timeout / 1000, // 转换回秒
        description: config.description,
        enabled: config.enabled,
      }));

      // 确定输出路径
      const outputPath = options.output || `providers-export-${Date.now()}.json`;
      
      // 写入文件
      await fs.writeJson(outputPath, exportData, { spaces: 2 });
      
      handleSuccess(`配置已导出到: ${outputPath}`);
      console.log(chalk.info(`导出了 ${exportData.length} 个服务商配置`));
      
      if (!options.includeSensitive) {
        handleWarning('API密钥已脱敏，导入时需要重新设置');
      }

    } catch (error) {
      handleError(error);
    }
  }

  /**
   * 测试连接
   */
  static async testConnection(config) {
    console.log(chalk.blue('🔍 测试 API 连接...'));

    try {
      const headers = {
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': 'Claude-Code-Kit/1.0.0',
      };

      // 尝试简单的GET请求
      const response = await axios.get(config.baseURL, {
        headers,
        timeout: config.timeout || 30000,
        validateStatus: (status) => status < 500, // 允许 4xx 状态码
      });

      if (response.status < 400) {
        handleSuccess('API 连接测试通过');
        return { success: true, status: response.status };
      } else {
        handleWarning(`API 可达但返回 ${response.status} 状态码`);
        return { success: false, status: response.status, message: 'HTTP error' };
      }

    } catch (error) {
      let message = '连接测试失败';
      
      if (error.code === 'ENOTFOUND') {
        message = '域名无法解析';
      } else if (error.code === 'ECONNREFUSED') {
        message = '连接被拒绝';
      } else if (error.code === 'ETIMEDOUT') {
        message = '连接超时';
      } else if (error.response) {
        message = `HTTP ${error.response.status}`;
      }

      handleWarning(`${message}: ${error.message}`);
      return { success: false, error: error.message, message };
    }
  }

  /**
   * 确认并保存配置
   */
  static async confirmAndSave(name, config, aliasGenerator) {
    // 显示配置预览
    console.log(chalk.yellow('\n📋 配置预览:'));
    console.log(`  标识: ${name}`);
    console.log(`  别名: ${config.alias}`);
    console.log(`  URL: ${config.baseURL}`);
    console.log(`  API密钥: ${config.apiKey ? '***已设置***' : '未设置'}`);
    console.log(`  超时: ${config.timeout / 1000}秒`);
    console.log(`  描述: ${config.description || '无'}`);
    console.log(`  状态: ${config.enabled ? '启用' : '禁用'}`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认添加此配置?',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('❌ 操作已取消'));
      return;
    }

    // 添加服务商
    await providerManager.addProvider(name, config);
    handleSuccess(`服务商 "${name}" 添加成功`);

    // 重新生成别名
    try {
      await aliasGenerator.generateAliases();
      handleInfo('别名配置已更新');
    } catch (aliasError) {
      handleWarning(`别名生成失败: ${aliasError.message}`);
    }

    // 询问是否安装别名到Shell配置
    const { installAlias } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installAlias',
        message: '是否将别名安装到Shell配置文件?',
        default: false,
      },
    ]);

    if (installAlias) {
      try {
        const result = await aliasGenerator.updateShellConfig();
        if (result.updated) {
          handleSuccess(result.message);
          handleInfo('请重新加载Shell配置: source ~/.zshrc 或 source ~/.bashrc');
        } else {
          handleInfo(result.message);
        }
      } catch (shellError) {
        handleWarning(`Shell配置更新失败: ${shellError.message}`);
      }
    }
  }

  /**
   * 验证导入配置格式
   */
  static validateImportConfig(config) {
    const required = ['name', 'alias', 'baseURL', 'apiKey'];
    
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    }

    // 验证URL格式
    try {
      new URL(config.baseURL);
    } catch {
      throw new Error(`无效的URL: ${config.baseURL}`);
    }

    // 验证别名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.alias)) {
      throw new Error(`无效的别名格式: ${config.alias}`);
    }

    // 验证API密钥长度
    if (config.apiKey.length < 10) {
      throw new Error('API密钥长度不足');
    }
  }
}

module.exports = ProviderCommandsEnhanced;