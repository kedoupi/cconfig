const inquirer = require('inquirer');
const chalk = require('chalk');
const axios = require('axios');
const ProviderManager = require('../core/ProviderManager');
const AliasGenerator = require('../core/AliasGenerator');
const { handleError, handleSuccess, handleInfo, handleWarning } = require('../utils/errorHandler');

const providerManager = new ProviderManager();

/**
 * 预设服务商配置模板
 */
const PROVIDER_TEMPLATES = {
  anthropic: {
    name: 'Anthropic Claude',
    alias: 'claude',
    baseURL: 'https://api.anthropic.com',
    headers: { 'anthropic-version': '2023-06-01' },
    testEndpoint: '/v1/messages',
    description: '官方 Anthropic Claude API',
  },
  'anthropic-vertex': {
    name: 'Anthropic Claude (Vertex AI)',
    alias: 'claude-vertex',
    baseURL: 'https://api.vertex.ai/anthropic',
    headers: {},
    testEndpoint: '/v1/messages',
    description: 'Google Cloud Vertex AI 上的 Claude API',
  },
  openai: {
    name: 'OpenAI Compatible',
    alias: 'openai',
    baseURL: 'https://api.openai.com',
    headers: {},
    testEndpoint: '/v1/models',
    description: 'OpenAI 兼容的 API 服务',
  },
  custom: {
    name: '自定义服务商',
    alias: 'custom',
    baseURL: '',
    headers: {},
    testEndpoint: '/',
    description: '自定义 API 服务商',
  },
};

/**
 * 服务商配置向导主入口
 */
async function wizard(options = {}) {
  try {
    console.log(chalk.blue('🧙‍♂️ Claude Code 服务商配置向导\n'));
    
    // 显示欢迎信息
    console.log(chalk.gray('此向导将帮助您配置 AI 服务商，包括 API 密钥验证和连接测试。\n'));

    // 选择配置模式
    const mode = await selectConfigurationMode(options);
    
    if (mode === 'quick') {
      await quickSetup(options);
    } else if (mode === 'advanced') {
      await advancedSetup(options);
    } else if (mode === 'template') {
      await templateSetup(options);
    }

  } catch (error) {
    handleError(error);
  }
}

/**
 * 选择配置模式
 */
async function selectConfigurationMode(options) {
  if (options.mode) {
    return options.mode;
  }

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: '请选择配置模式:',
      choices: [
        {
          name: '🚀 快速配置 - 使用预设模板快速开始',
          value: 'template',
        },
        {
          name: '⚡ 标准配置 - 交互式配置所有选项',
          value: 'quick',
        },
        {
          name: '🔧 高级配置 - 自定义所有详细设置',
          value: 'advanced',
        },
      ],
      default: 'template',
    },
  ]);

  return mode;
}

/**
 * 模板配置模式
 */
async function templateSetup(options) {
  console.log(chalk.blue('📋 选择服务商模板\n'));

  const templateChoices = Object.entries(PROVIDER_TEMPLATES).map(([key, template]) => ({
    name: `${template.name} - ${template.description}`,
    value: key,
  }));

  const { templateKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateKey',
      message: '选择服务商模板:',
      choices: templateChoices,
    },
  ]);

  const template = PROVIDER_TEMPLATES[templateKey];
  
  // 显示模板信息
  console.log(chalk.yellow('\n📄 模板信息:'));
  console.log(`  名称: ${template.name}`);
  console.log(`  建议别名: ${template.alias}`);
  console.log(`  API URL: ${template.baseURL || '需要配置'}`);
  console.log(`  描述: ${template.description}\n`);

  // 配置必要字段
  const config = await configureFromTemplate(template, options);
  
  // 验证配置
  await validateAndSaveConfig(template.name.toLowerCase().replace(/\s+/g, '-'), config);
}

/**
 * 从模板配置服务商
 */
async function configureFromTemplate(template, options) {
  const questions = [];

  // 服务商名称
  questions.push({
    type: 'input',
    name: 'name',
    message: '服务商标识 (用作内部ID):',
    default: template.name.toLowerCase().replace(/\s+/g, '-'),
    validate: validateProviderName,
  });

  // 别名
  questions.push({
    type: 'input',
    name: 'alias',
    message: '命令别名:',
    default: template.alias,
    validate: validateAlias,
  });

  // API 基础 URL (如果模板中为空)
  if (!template.baseURL) {
    questions.push({
      type: 'input',
      name: 'baseURL',
      message: 'API 基础 URL:',
      validate: validateURL,
    });
  }

  // API 密钥
  questions.push({
    type: 'password',
    name: 'apiKey',
    message: 'API 密钥:',
    validate: validateApiKey,
  });

  const answers = await inquirer.prompt(questions);

  return {
    alias: answers.alias,
    baseURL: answers.baseURL || template.baseURL,
    apiKey: answers.apiKey,
    timeout: 30000,
    description: template.description,
    enabled: true,
    headers: template.headers,
    testEndpoint: template.testEndpoint,
    name: answers.name,
  };
}

/**
 * 快速配置模式
 */
async function quickSetup(options) {
  console.log(chalk.blue('⚡ 快速配置模式\n'));

  const config = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '服务商名称:',
      validate: validateProviderName,
    },
    {
      type: 'input',
      name: 'alias',
      message: '命令别名:',
      default: (answers) => answers.name.toLowerCase().replace(/\s+/g, ''),
      validate: validateAlias,
    },
    {
      type: 'input',
      name: 'baseURL',
      message: 'API 基础 URL:',
      validate: validateURL,
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API 密钥:',
      validate: validateApiKey,
    },
  ]);

  const fullConfig = {
    ...config,
    timeout: 30000,
    description: `${config.name} API 服务`,
    enabled: true,
    headers: {},
    testEndpoint: '/',
  };

  await validateAndSaveConfig(config.name, fullConfig);
}

/**
 * 高级配置模式
 */
async function advancedSetup(options) {
  console.log(chalk.blue('🔧 高级配置模式\n'));

  const config = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '服务商标识:',
      validate: validateProviderName,
    },
    {
      type: 'input',
      name: 'alias',
      message: '命令别名:',
      validate: validateAlias,
    },
    {
      type: 'input',
      name: 'baseURL',
      message: 'API 基础 URL:',
      validate: validateURL,
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API 密钥:',
      validate: validateApiKey,
    },
    {
      type: 'input',
      name: 'timeout',
      message: '请求超时时间 (秒):',
      default: '30',
      validate: validateTimeout,
    },
    {
      type: 'input',
      name: 'description',
      message: '描述信息:',
      default: (answers) => `${answers.name} API 服务`,
    },
    {
      type: 'input',
      name: 'testEndpoint',
      message: '健康检查端点 (用于连接测试):',
      default: '/',
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: '启用此服务商?',
      default: true,
    },
  ]);

  // 配置自定义请求头
  const { addHeaders } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addHeaders',
      message: '是否添加自定义请求头?',
      default: false,
    },
  ]);

  let headers = {};
  if (addHeaders) {
    headers = await configureCustomHeaders();
  }

  const fullConfig = {
    ...config,
    timeout: parseInt(config.timeout) * 1000,
    headers,
  };

  await validateAndSaveConfig(config.name, fullConfig);
}

/**
 * 配置自定义请求头
 */
async function configureCustomHeaders() {
  const headers = {};
  let addMore = true;

  console.log(chalk.yellow('\n📋 配置自定义请求头:'));

  while (addMore) {
    const { headerName, headerValue } = await inquirer.prompt([
      {
        type: 'input',
        name: 'headerName',
        message: '请求头名称:',
        validate: (input) => input.trim() ? true : '请输入请求头名称',
      },
      {
        type: 'input',
        name: 'headerValue',
        message: '请求头值:',
        validate: (input) => input.trim() ? true : '请输入请求头值',
      },
    ]);

    headers[headerName] = headerValue;

    const { continueAdding } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAdding',
        message: '继续添加更多请求头?',
        default: false,
      },
    ]);

    addMore = continueAdding;
  }

  return headers;
}

/**
 * 验证配置并保存
 */
async function validateAndSaveConfig(name, config) {
  // 显示配置预览
  console.log(chalk.yellow('\n📋 配置预览:'));
  console.log(`  名称: ${name}`);
  console.log(`  别名: ${config.alias}`);
  console.log(`  URL: ${config.baseURL}`);
  console.log(`  密钥: ${config.apiKey ? '***已设置***' : '未设置'}`);
  console.log(`  超时: ${(config.timeout || 30000) / 1000}秒`);
  console.log(`  描述: ${config.description || '无'}`);
  console.log(`  状态: ${config.enabled ? '启用' : '禁用'}`);
  if (Object.keys(config.headers || {}).length > 0) {
    console.log(`  请求头: ${Object.keys(config.headers).join(', ')}`);
  }

  // 确认配置
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认此配置?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('❌ 配置已取消'));
    return;
  }

  // 测试连接
  const shouldTest = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'test',
      message: '是否测试 API 连接?',
      default: true,
    },
  ]);

  if (shouldTest.test) {
    await testApiConnection(config);
  }

  // 保存配置
  try {
    await providerManager.addProvider(name, config);
    handleSuccess(`服务商 "${name}" 配置成功`);

    // 生成别名
    await updateAliases();

    // 询问是否设为默认
    await askSetDefault(name);

    // 显示使用提示
    showUsageInstructions(config.alias);

  } catch (error) {
    handleError(error, '保存配置失败');
  }
}

/**
 * 测试 API 连接
 */
async function testApiConnection(config) {
  console.log(chalk.blue('🔍 测试 API 连接...'));

  try {
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'User-Agent': 'Claude-Code-Kit/1.0.0',
      ...config.headers,
    };

    const testUrl = `${config.baseURL}${config.testEndpoint || '/'}`;
    
    const response = await axios.get(testUrl, {
      headers,
      timeout: (config.timeout || 30000),
      validateStatus: (status) => status < 500, // 允许 4xx 状态码，主要是检查连接
    });

    if (response.status < 400) {
      handleSuccess('API 连接测试通过');
    } else if (response.status < 500) {
      handleWarning(`API 可达但返回 ${response.status} 状态码 - 请检查端点或密钥`);
    }

  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      handleWarning('域名无法解析 - 请检查 URL 是否正确');
    } else if (error.code === 'ECONNREFUSED') {
      handleWarning('连接被拒绝 - 请检查 URL 和网络设置');
    } else if (error.code === 'ETIMEDOUT') {
      handleWarning('连接超时 - 请检查网络或增加超时时间');
    } else {
      handleWarning(`连接测试失败: ${error.message}`);
    }
    
    const { continueAnyway } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: '是否继续保存配置?',
        default: true,
      },
    ]);

    if (!continueAnyway) {
      throw new Error('用户取消配置');
    }
  }
}

/**
 * 更新别名配置
 */
async function updateAliases() {
  try {
    const configManager = providerManager.configManager;
    const aliasGenerator = new AliasGenerator(configManager);
    await aliasGenerator.generateAliases();
    handleInfo('别名配置已更新');
  } catch (error) {
    handleWarning(`别名生成失败: ${error.message}`);
  }
}

/**
 * 询问是否设为默认服务商
 */
async function askSetDefault(providerName) {
  const { setAsDefault } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setAsDefault',
      message: '是否将此服务商设为默认?',
      default: false,
    },
  ]);

  if (setAsDefault) {
    try {
      await providerManager.setDefaultProvider(providerName);
      handleSuccess(`"${providerName}" 已设为默认服务商`);
    } catch (error) {
      handleWarning(`设置默认服务商失败: ${error.message}`);
    }
  }
}

/**
 * 显示使用说明
 */
function showUsageInstructions(alias) {
  console.log(chalk.cyan('\n🎉 配置完成！使用方式:'));
  console.log(`  • 查看所有服务商: cc-config provider list`);
  console.log(`  • 使用此服务商: ${alias} "你的问题"`);
  console.log(`  • 安装别名到Shell: cc-config alias install`);
  console.log(`  • 查看帮助: cc-config --help\n`);
}

// 验证函数
function validateProviderName(input) {
  if (!input.trim()) return '请输入服务商名称';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
    return '名称只能包含字母、数字、下划线和连字符，且必须以字母开头';
  }
  return true;
}

async function validateAlias(input) {
  if (!input.trim()) return '请输入别名';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input)) {
    return '别名只能包含字母、数字、下划线和连字符，且必须以字母开头';
  }
  
  const isAvailable = await providerManager.isAliasAvailable(input);
  if (!isAvailable) {
    const suggested = await providerManager.suggestAlias(input);
    return `别名 "${input}" 已被使用，建议使用: ${suggested}`;
  }
  
  return true;
}

function validateURL(input) {
  if (!input.trim()) return '请输入 URL';
  try {
    new URL(input);
    return true;
  } catch {
    return '请输入有效的 URL';
  }
}

function validateApiKey(input) {
  if (!input.trim()) return '请输入 API 密钥';
  if (input.length < 10) return 'API 密钥长度至少10个字符';
  return true;
}

function validateTimeout(input) {
  const num = parseInt(input);
  if (isNaN(num) || num <= 0 || num > 300) {
    return '请输入有效的超时时间 (1-300秒)';
  }
  return true;
}

module.exports = {
  wizard,
  PROVIDER_TEMPLATES,
};