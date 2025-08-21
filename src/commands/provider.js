const inquirer = require('inquirer');
const chalk = require('chalk');
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
 * 添加服务商配置
 */
async function add(options) {
  try {
    let config = {};
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
        validate: input => {
          if (!input.trim()) return '请输入服务商标识';
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
            return '标识只能包含字母、数字、下划线和连字符，且必须以字母开头';
          }
          return true;
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
    ]);

    config = {
      alias: answers.alias,
      baseURL: answers.baseURL,
      apiKey: answers.apiKey,
      timeout: parseInt(answers.timeout) * 1000, // 转换为毫秒
      description: answers.description,
      enabled: answers.enabled,
    };

    // 确认配置
    console.log(chalk.yellow('\n📋 配置预览:'));
    console.log(`  标识: ${answers.name}`);
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
    await providerManager.addProvider(answers.name, config);
    handleSuccess(`服务商 "${answers.name}" 添加成功`);

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
          handleInfo(
            '请重新加载Shell配置: source ~/.zshrc 或 source ~/.bashrc'
          );
        } else {
          handleInfo(result.message);
        }
      } catch (shellError) {
        handleWarning(`Shell配置更新失败: ${shellError.message}`);
      }
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 列出所有服务商
 */
async function list(options) {
  try {
    const providers = await providerManager.getProviders();
    const stats = await providerManager.getStats();

    if (Object.keys(providers).length === 0) {
      console.log(chalk.yellow('📝 尚未配置任何服务商'));
      console.log(
        chalk.blue('💡 使用 "cc-config provider add" 添加新的服务商')
      );
      return;
    }

    console.log(chalk.blue('🌐 服务商配置列表\n'));

    // 显示统计信息
    console.log(
      chalk.gray(
        `总计: ${stats.total} | 启用: ${stats.enabled} | 禁用: ${stats.disabled}\n`
      )
    );

    for (const [key, provider] of Object.entries(providers)) {
      const statusIcon = provider.enabled ? '🟢' : '🔴';

      console.log(`${statusIcon} ${chalk.bold(key)}`);
      console.log(`   别名: ${chalk.cyan(provider.alias)}`);

      if (options.detail) {
        console.log(`   URL: ${provider.baseURL}`);
        console.log(`   密钥: ${provider.apiKey ? '***已设置***' : '未设置'}`);
        console.log(`   超时: ${provider.timeout / 1000}秒`);
        if (provider.description) {
          console.log(`   说明: ${provider.description}`);
        }
      }

      console.log();
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 编辑服务商配置
 */
async function edit(name) {
  try {
    const provider = await providerManager.getProvider(name);
    const configStorage = providerManager.configStorage;
    const aliasGenerator = new AliasGenerator(configStorage);

    console.log(chalk.blue(`🔧 编辑服务商配置: ${name}\n`));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'alias',
        message: '别名:',
        default: provider.alias,
        validate: async input => {
          if (!input.trim()) return '请输入别名';
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
            return '别名只能包含字母、数字、下划线和连字符，且必须以字母开头';
          }

          // 如果别名没有改变，直接通过
          if (input === provider.alias) return true;

          // 检查新别名是否可用
          const isAvailable = await providerManager.isAliasAvailable(input);
          if (!isAvailable) {
            return `别名 "${input}" 已被使用`;
          }

          return true;
        },
      },
      {
        type: 'input',
        name: 'baseURL',
        message: 'API 基础 URL:',
        default: provider.baseURL,
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
        message: 'API 密钥 (留空保持不变):',
        default: '',
      },
      {
        type: 'input',
        name: 'timeout',
        message: '请求超时时间 (秒):',
        default: (provider.timeout / 1000).toString(),
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
        message: '描述信息:',
        default: provider.description || '',
      },
      {
        type: 'confirm',
        name: 'enabled',
        message: '启用此服务商:',
        default: provider.enabled,
      },
    ]);

    const updates = {
      alias: answers.alias,
      baseURL: answers.baseURL,
      timeout: parseInt(answers.timeout) * 1000,
      description: answers.description,
      enabled: answers.enabled,
    };

    // 只在用户输入了新密钥时才更新
    if (answers.apiKey.trim()) {
      updates.apiKey = answers.apiKey;
    }

    await providerManager.updateProvider(name, updates);
    handleSuccess(`服务商 "${name}" 更新成功`);

    // 重新生成别名
    try {
      await aliasGenerator.generateAliases();
      handleInfo('别名配置已更新');
    } catch (aliasError) {
      handleWarning(`别名生成失败: ${aliasError.message}`);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 删除服务商配置
 */
async function remove(name, options) {
  try {
    const provider = await providerManager.getProvider(name);
    const configStorage = providerManager.configStorage;
    const aliasGenerator = new AliasGenerator(configStorage);

    if (!options.force) {
      console.log(chalk.yellow(`⚠️  即将删除服务商: ${name}`));
      console.log(`   别名: ${provider.alias}`);
      console.log(`   URL: ${provider.baseURL}`);

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确认删除此服务商配置?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('❌ 操作已取消'));
        return;
      }
    }

    await providerManager.removeProvider(name);
    handleSuccess(`服务商 "${name}" 删除成功`);

    // 重新生成别名
    try {
      await aliasGenerator.generateAliases();
      handleInfo('别名配置已更新');
    } catch (aliasError) {
      handleWarning(`别名生成失败: ${aliasError.message}`);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 测试服务商配置
 */
async function test(name) {
  try {
    console.log(chalk.blue(`🔍 测试服务商配置: ${name}`));

    const result = await providerManager.testProvider(name);

    if (result.success) {
      handleSuccess(result.message);
      if (result.details) {
        console.log(chalk.gray('配置详情:'));
        console.log(`   别名: ${result.details.alias}`);
        console.log(`   端点: ${result.details.baseURL}`);
        console.log(`   超时: ${result.details.timeout / 1000}秒`);
        console.log(
          `   密钥: ${result.details.hasApiKey ? '已配置' : '未配置'}`
        );
        console.log(`   状态: ${result.details.enabled ? '启用' : '禁用'}`);
      }
    } else {
      handleError(new Error(result.message));
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 显示服务商统计信息
 */
async function stats() {
  try {
    const stats = await providerManager.getStats();
    const configStorage = providerManager.configStorage;
    const aliasGenerator = new AliasGenerator(configStorage);

    console.log(chalk.blue('📊 服务商统计信息\n'));

    console.log(chalk.green('总体统计:'));
    console.log(`   总数量: ${stats.total}`);
    console.log(`   已启用: ${chalk.green(stats.enabled)}`);
    console.log(`   已禁用: ${chalk.red(stats.disabled)}`);
    console.log(`   已配置密钥: ${chalk.blue(stats.withApiKey)}`);
    console.log();

    if (stats.aliases.length > 0) {
      console.log(chalk.green('可用别名:'));
      stats.aliases.forEach(alias => {
        console.log(`   ${chalk.cyan(alias)}`);
      });
      console.log();
    }

    // 验证别名配置
    try {
      const validation = await aliasGenerator.validateAliases();
      console.log(chalk.green('配置验证:'));
      if (validation.valid) {
        console.log(`   状态: ${chalk.green('✅ 通过')}`);
      } else {
        console.log(`   状态: ${chalk.red('❌ 有问题')}`);
        validation.issues.forEach(issue => {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          console.log(`   ${icon} ${issue.message}`);
        });
      }
    } catch (validationError) {
      console.log(`   验证失败: ${validationError.message}`);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

module.exports = {
  add,
  list,
  edit,
  remove,
  test,
  stats,
};
