const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const os = require('os');

const ConfigManager = require('../core/ConfigManager');
const { handleError } = require('../utils/errorHandler');

/**
 * 配置模板定义
 */
const CONFIG_TEMPLATES = {
  claude: {
    name: 'Claude (官方)',
    description: '标准的 Claude 配置模板，包含基本设置',
    files: {
      'settings.json': {
        anthropic: {
          api_key: '',
          base_url: 'https://api.anthropic.com',
          max_tokens: 4096,
          temperature: 0.7,
        },
        editor: {
          word_wrap: 'on',
          minimap: { enabled: false },
          format_on_save: true,
        },
        ui: {
          theme: 'dark',
          font_size: 14,
        },
      },
      'CLAUDE.md': `# Claude Code 项目配置

## 项目信息
此项目使用 Claude Code Kit 进行配置管理。

## 使用方法
1. 设置API密钥: \`cc-config provider add\`
2. 生成别名: \`cc-config alias generate\`
3. 安装别名: \`cc-config alias install\`

## 自定义配置
可以通过编辑 .claude/settings.json 来自定义配置。
`,
    },
  },
  minimal: {
    name: '最小配置',
    description: '最简化的配置模板，仅包含必要设置',
    files: {
      'settings.json': {
        anthropic: {
          api_key: '',
          base_url: 'https://api.anthropic.com',
        },
      },
    },
  },
  development: {
    name: '开发环境',
    description: '适合开发者的配置模板，包含开发相关设置',
    files: {
      'settings.json': {
        anthropic: {
          api_key: '',
          base_url: 'https://api.anthropic.com',
          max_tokens: 8192,
          temperature: 0.1,
        },
        editor: {
          word_wrap: 'on',
          minimap: { enabled: false },
          format_on_save: true,
          auto_save: true,
        },
        ui: {
          theme: 'dark',
          font_size: 14,
          show_line_numbers: true,
        },
        development: {
          verbose_logging: true,
          auto_backup: true,
          backup_interval: '1h',
        },
      },
      'CLAUDE.md': `# Claude Code 开发环境配置

## 开发配置
此配置针对开发环境进行了优化。

## 特性
- 自动保存
- 详细日志
- 自动备份
- 低温度设置以获得更确定性的输出

## 环境变量
可以设置以下环境变量来覆盖配置：
- \`ANTHROPIC_API_KEY\`: API密钥
- \`ANTHROPIC_BASE_URL\`: API基础URL
`,
      'output-styles/development.json': {
        name: 'Development',
        description: '开发环境输出样式',
        template: `## 开发输出

**文件**: {{file}}
**时间**: {{timestamp}}

### 代码
\`\`\`{{language}}
{{code}}
\`\`\`

### 说明
{{explanation}}
`,
      },
    },
  },
};

/**
 * 部署配置模板
 */
async function deploy(options = {}) {
  try {
    console.log(chalk.blue('🚀 Claude Code 配置部署工具\n'));

    const configManager = new ConfigManager();
    
    // 检查现有配置
    const hasExisting = await checkExistingConfig(configManager);
    
    if (hasExisting && !options.force) {
      const { shouldContinue } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldContinue',
          message: '检测到现有配置，是否继续？这将备份现有配置',
          default: false,
        },
      ]);

      if (!shouldContinue) {
        console.log(chalk.yellow('✋ 部署已取消'));
        return;
      }

      // 创建备份
      await createBackupBeforeDeploy(configManager);
    }

    // 选择模板
    const template = await selectTemplate(options);
    
    // 部署模板
    await deployTemplate(configManager, template, options);
    
    // 设置权限
    await setPermissions(configManager);
    
    // 验证部署
    await verifyDeployment(configManager);
    
    console.log(chalk.green('\n🎉 配置部署完成！'));
    showNextSteps();

  } catch (error) {
    handleError(error, '配置部署失败');
  }
}

/**
 * 检查现有配置
 */
async function checkExistingConfig(configManager) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const ccConfigDir = configManager.configDir;
  
  return (await fs.pathExists(claudeDir)) || (await fs.pathExists(ccConfigDir));
}

/**
 * 部署前创建备份
 */
async function createBackupBeforeDeploy(configManager) {
  console.log(chalk.yellow('📦 创建现有配置备份...'));
  
  try {
    const timestamp = await configManager.createBackup('部署前自动备份');
    console.log(chalk.green(`✅ 备份已创建: ${timestamp}`));
  } catch (error) {
    console.log(chalk.yellow('⚠️  备份创建失败，继续部署...'));
  }
}

/**
 * 选择配置模板
 */
async function selectTemplate(options) {
  if (options.template && CONFIG_TEMPLATES[options.template]) {
    return CONFIG_TEMPLATES[options.template];
  }

  const choices = Object.keys(CONFIG_TEMPLATES).map(key => ({
    name: `${CONFIG_TEMPLATES[key].name} - ${CONFIG_TEMPLATES[key].description}`,
    value: key,
  }));

  const { templateKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateKey',
      message: '选择配置模板:',
      choices,
    },
  ]);

  return CONFIG_TEMPLATES[templateKey];
}

/**
 * 部署模板文件
 */
async function deployTemplate(configManager, template, options) {
  console.log(chalk.blue(`📁 部署模板: ${template.name}`));
  
  // 确保配置目录存在
  await configManager.initialize();
  
  const claudeDir = path.join(os.homedir(), '.claude');
  await fs.ensureDir(claudeDir);
  
  // 部署模板文件
  for (const [filePath, content] of Object.entries(template.files)) {
    await deployTemplateFile(claudeDir, filePath, content, options);
  }
}

/**
 * 部署单个模板文件
 */
async function deployTemplateFile(baseDir, filePath, content, options) {
  const fullPath = path.join(baseDir, filePath);
  const dir = path.dirname(fullPath);
  
  // 确保目录存在
  await fs.ensureDir(dir);
  
  // 检查文件是否已存在
  if (await fs.pathExists(fullPath) && !options.overwrite) {
    const { shouldOverwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldOverwrite',
        message: `文件 ${filePath} 已存在，是否覆盖？`,
        default: false,
      },
    ]);

    if (!shouldOverwrite) {
      console.log(chalk.yellow(`⏭️  跳过: ${filePath}`));
      return;
    }
  }
  
  // 写入文件
  if (typeof content === 'object') {
    await fs.writeJson(fullPath, content, { spaces: 2 });
  } else {
    await fs.writeFile(fullPath, content, 'utf8');
  }
  
  console.log(chalk.green(`✅ 部署: ${filePath}`));
}

/**
 * 设置文件权限
 */
async function setPermissions(configManager) {
  console.log(chalk.blue('🔒 设置文件权限...'));
  
  const paths = configManager.getPaths();
  
  // 设置配置目录权限 (仅用户可读写)
  for (const [name, dirPath] of Object.entries(paths)) {
    if (name.includes('Dir') && await fs.pathExists(dirPath)) {
      await fs.chmod(dirPath, 0o700);
    }
  }
  
  // 设置 Claude 目录权限
  const claudeDir = path.join(os.homedir(), '.claude');
  if (await fs.pathExists(claudeDir)) {
    await fs.chmod(claudeDir, 0o700);
    
    // 设置敏感文件权限
    const sensitiveFiles = ['settings.json'];
    for (const file of sensitiveFiles) {
      const filePath = path.join(claudeDir, file);
      if (await fs.pathExists(filePath)) {
        await fs.chmod(filePath, 0o600);
      }
    }
  }
  
  console.log(chalk.green('✅ 权限设置完成'));
}

/**
 * 验证部署
 */
async function verifyDeployment(configManager) {
  console.log(chalk.blue('🔍 验证部署...'));
  
  const paths = configManager.getPaths();
  const errors = [];
  
  // 检查关键目录
  const requiredDirs = [
    paths.configDir,
    paths.providersDir,
    paths.backupDir,
    paths.claudeDir,
  ];
  
  for (const dir of requiredDirs) {
    if (!(await fs.pathExists(dir))) {
      errors.push(`缺少目录: ${dir}`);
    }
  }
  
  // 检查 Claude 配置文件
  const claudeSettings = path.join(paths.claudeDir, 'settings.json');
  if (await fs.pathExists(claudeSettings)) {
    try {
      await fs.readJson(claudeSettings);
      console.log(chalk.green('✅ Claude 配置文件有效'));
    } catch (error) {
      errors.push(`Claude 配置文件格式错误: ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log(chalk.red('❌ 验证失败:'));
    errors.forEach(error => console.log(`  - ${error}`));
    throw new Error('部署验证失败');
  }
  
  console.log(chalk.green('✅ 部署验证通过'));
}

/**
 * 显示后续步骤
 */
function showNextSteps() {
  console.log(chalk.yellow('\n📋 后续步骤:'));
  console.log('1. 配置API密钥: cc-config provider add');
  console.log('2. 生成Shell别名: cc-config alias generate');  
  console.log('3. 安装别名到Shell: cc-config alias install');
  console.log('4. 查看配置状态: cc-config status');
  console.log('\n📚 更多帮助: cc-config --help');
}

/**
 * 列出可用模板
 */
async function listTemplates() {
  console.log(chalk.blue('📝 可用配置模板:\n'));
  
  Object.entries(CONFIG_TEMPLATES).forEach(([key, template]) => {
    console.log(`${chalk.green(key)}: ${template.name}`);
    console.log(`  ${template.description}`);
    console.log();
  });
}

/**
 * 显示模板详情
 */
async function showTemplate(templateName) {
  const template = CONFIG_TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`未知模板: ${templateName}`);
  }
  
  console.log(chalk.blue(`📄 模板详情: ${template.name}\n`));
  console.log(`描述: ${template.description}\n`);
  console.log(chalk.yellow('包含文件:'));
  
  Object.keys(template.files).forEach(filePath => {
    console.log(`  - ${filePath}`);
  });
}

module.exports = {
  deploy,
  listTemplates,
  showTemplate,
};