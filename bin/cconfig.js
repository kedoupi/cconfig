#!/usr/bin/env node

/**
 * CConfig - Claude Configuration Manager
 * Simple and focused Claude API configuration management
 */

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Table = require('cli-table3');

// Disable chalk colors when stdout is not a TTY unless explicitly overridden
if (
  !process.stdout.isTTY &&
  process.env.CCONFIG_ALLOW_COLOR_IN_PIPES !== '1'
) {
  chalk.level = 0;
}

// Import package.json for version
const packageJson = require('../package.json');

// Configuration
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CONFIG_DIR = path.join(CLAUDE_DIR, 'cconfig');
const PROVIDERS_DIR = path.join(CONFIG_DIR, 'providers');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.ensureDir(CONFIG_DIR);
    await fs.ensureDir(PROVIDERS_DIR);
    if (!(await fs.pathExists(CONFIG_FILE))) {
      await fs.writeJson(CONFIG_FILE, { defaultProvider: null });
    }
  } catch (error) {
    console.error(chalk.red(`配置初始化失败: ${error.message}`));
    console.error(chalk.yellow(`请检查目录权限: ${CONFIG_DIR}`));
    process.exit(1);
  }
}

// Helpers
function isWindows() {
  return process.platform === 'win32';
}

function validateAlias(alias) {
  const ALIAS_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  if (!alias || !ALIAS_RE.test(alias)) {
    throw new Error('别名仅允许字母、数字、下划线、短横线，且长度<=64');
  }
}

function getProviderFile(alias) {
  validateAlias(alias);
  const file = path.join(PROVIDERS_DIR, `${alias}.json`);
  // Basic path safety (defense-in-depth after regex)
  const resolved = path.resolve(file);
  const providersRoot = path.resolve(PROVIDERS_DIR) + path.sep;
  if (!resolved.startsWith(providersRoot)) {
    throw new Error('非法的别名导致的路径问题');
  }
  return file;
}

// Note: Private hostname detection removed as HTTPS enforcement was dropped.

function validateApiUrlSecure(urlStr) {
  try {
    const url = new URL(urlStr);
    const protocol = url.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') {
      return '请输入有效的 HTTP 或 HTTPS URL';
    }
    return true;
  } catch {
    return '请输入有效的 URL 格式';
  }
}

function formatRelativeTime(isoStr) {
  try {
    const t = new Date(isoStr).getTime();
    if (Number.isNaN(t)) {
      return '-';
    }
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - t) / 1000));
    if (diffSec < 60) {
      return '刚刚';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `${diffMin} 分钟前`;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return `${diffHour} 小时前`;
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      return `${diffDay} 天前`;
    }
    return new Date(isoStr).toLocaleString();
  } catch {
    return '-';
  }
}

function truncateMiddle(str, maxLen) {
  if (typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLen) {
    return str;
  }
  if (maxLen <= 3) {
    return str.slice(0, maxLen);
  }
  const half = Math.floor((maxLen - 3) / 2);
  return (
    str.slice(0, half) + '...' + str.slice(str.length - (maxLen - 3 - half))
  );
}

// Simple provider operations
async function addProvider() {
  await ensureDirectories();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'alias',
      message: '配置别名（字母/数字/下划线/短横线）:',
      validate: async input => {
        try {
          validateAlias(input.trim());
        } catch (e) {
          return e.message;
        }
        // 重名检查
        try {
          const file = getProviderFile(input.trim());
          if (await fs.pathExists(file)) {
            return `别名已存在：${input.trim()}`;
          }
        } catch (e) {
          return e.message;
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL:',
      default: 'https://api.anthropic.com',
      validate: input => validateApiUrlSecure(input),
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API Key:',
      mask: '*',
      validate: input => (input.trim() ? true : 'API Key is required'),
    },
  ]);

  let providerFile;
  try {
    providerFile = getProviderFile(answers.alias);
  } catch (e) {
    console.error(chalk.red(e.message));
    process.exit(1);
  }
  try {
    const provider = {
      alias: answers.alias,
      apiUrl: answers.apiUrl,
      apiKey: answers.apiKey,
      createdAt: new Date().toISOString(),
    };

    await fs.writeJson(providerFile, provider);
    // Secure permissions (best-effort on non-Windows)
    if (!isWindows()) {
      try {
        await fs.chmod(providerFile, 0o600);
      } catch (e) {
        // 忽略权限设置失败（在非类 Unix 系统可能不支持）
      }
    }

    // If no default provider yet, set this as default
    try {
      const config = await fs.readJson(CONFIG_FILE);
      if (!config.defaultProvider) {
        config.defaultProvider = answers.alias;
        await fs.writeJson(CONFIG_FILE, config);
        // update lastUsed to now for the newly added default
        try {
          const p = await fs.readJson(providerFile);
          p.lastUsed = new Date().toISOString();
          await fs.writeJson(providerFile, p);
        } catch (e) {
          // 忽略 lastUsed 更新失败
        }
        console.log(
          chalk.green(`✓ Provider '${answers.alias}' added and set as default`)
        );
        return;
      }
    } catch (e) {
      // 忽略读取/写入默认配置失败
    }

    console.log(
      chalk.green(`✓ Provider '${answers.alias}' added successfully`)
    );
  } catch (error) {
    console.error(chalk.red(`添加 Provider 失败: ${error.message}`));
    console.error(chalk.yellow('请检查文件权限和磁盘空间'));
    process.exit(1);
  }
}

async function listProviders() {
  await ensureDirectories();

  let jsonFiles;
  try {
    const files = await fs.readdir(PROVIDERS_DIR);
    jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('📝 No providers configured');
      console.log('   Run: cconfig add');
      return;
    }
  } catch (error) {
    console.error(chalk.red(`读取 Provider 列表失败: ${error.message}`));
    console.error(chalk.yellow(`请检查目录权限: ${PROVIDERS_DIR}`));
    process.exit(1);
  }

  const config = await fs.readJson(CONFIG_FILE);

  // Dynamic table widths based on terminal width
  const termWidth =
    process.stdout && process.stdout.columns ? process.stdout.columns : 100;
  const aliasWidth = 16; // suitable for short aliases
  const statusWidth = 8; // "默认"/"可用"
  const lastWidth = 12; // relative time mostly short
  // Leave buffer for table borders and paddings (~10 chars)
  const urlWidth = Math.max(
    20,
    Math.min(80, termWidth - (aliasWidth + statusWidth + lastWidth + 10))
  );

  const table = new Table({
    head: ['别名', 'URL', '状态', '最后使用'],
    colWidths: [aliasWidth, urlWidth, statusWidth, lastWidth],
    colAligns: ['left', 'left', 'center', 'right'],
    style: { compact: true },
    wordWrap: false,
  });

  for (const file of jsonFiles) {
    const provider = await fs.readJson(path.join(PROVIDERS_DIR, file));
    const isDefault = provider.alias === config.defaultProvider;
    const lastUsed = provider.lastUsed
      ? formatRelativeTime(provider.lastUsed)
      : '-';
    const url = String(provider.apiUrl || '');
    const maxUrlLen = urlWidth - 2; // keep within cell
    const urlCell =
      url.length > maxUrlLen ? truncateMiddle(url, maxUrlLen) : url;
    table.push([
      provider.alias,
      urlCell,
      isDefault ? chalk.green('默认') : '可用',
      lastUsed,
    ]);
  }

  console.log(table.toString());
}

async function showProvider(alias) {
  await ensureDirectories();

  let providerFile;
  try {
    providerFile = getProviderFile(alias);
  } catch (e) {
    console.log(chalk.red(e.message));
    return;
  }
  if (!(await fs.pathExists(providerFile))) {
    console.log(chalk.red(`Provider '${alias}' not found`));
    return;
  }

  const provider = await fs.readJson(providerFile);
  console.log(`Provider: ${chalk.cyan(provider.alias)}`);
  console.log(`URL: ${provider.apiUrl}`);
  console.log(`Created: ${new Date(provider.createdAt).toLocaleString()}`);
}

async function editProvider(alias) {
  await ensureDirectories();

  let providerFile;
  try {
    providerFile = getProviderFile(alias);
  } catch (e) {
    console.log(chalk.red(e.message));
    return;
  }
  if (!(await fs.pathExists(providerFile))) {
    console.log(chalk.red(`Provider '${alias}' not found`));
    return;
  }

  const provider = await fs.readJson(providerFile);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL:',
      default: provider.apiUrl,
      validate: input => validateApiUrlSecure(input),
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API Key（留空则保持不变）:',
      mask: '*',
    },
  ]);

  provider.apiUrl = answers.apiUrl;
  if (typeof answers.apiKey === 'string' && answers.apiKey.trim()) {
    provider.apiKey = answers.apiKey;
  }
  provider.updatedAt = new Date().toISOString();

  await fs.writeJson(providerFile, provider);
  if (!isWindows()) {
    try {
      await fs.chmod(providerFile, 0o600);
    } catch (e) {
      // 忽略权限设置失败
    }
  }

  console.log(chalk.green(`✓ Provider '${alias}' updated`));
}

async function removeProvider(alias) {
  await ensureDirectories();

  let providerFile;
  try {
    providerFile = getProviderFile(alias);
  } catch (e) {
    console.log(chalk.red(e.message));
    return;
  }
  if (!(await fs.pathExists(providerFile))) {
    console.log(chalk.red(`Provider '${alias}' not found`));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete provider '${alias}'?`,
      default: false,
    },
  ]);

  if (confirm) {
    await fs.remove(providerFile);
    // 如果删除的是默认 provider，同步清空默认配置
    try {
      const config = await fs.readJson(CONFIG_FILE);
      if (config.defaultProvider === alias) {
        config.defaultProvider = null;
        await fs.writeJson(CONFIG_FILE, config);
        console.log(chalk.yellow('已清空默认配置'));
      }
    } catch (e) {
      // 忽略读取/写入配置失败
    }
    console.log(chalk.green(`✓ Provider '${alias}' deleted`));
  }
}

async function useProvider(alias) {
  await ensureDirectories();

  if (!alias) {
    // Interactive selection
    const files = await fs.readdir(PROVIDERS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('No providers configured');
      console.log('Run: cconfig add');
      return;
    }

    const providers = [];
    for (const file of jsonFiles) {
      const provider = await fs.readJson(path.join(PROVIDERS_DIR, file));
      providers.push(provider.alias);
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select default provider:',
        choices: providers,
      },
    ]);
    alias = selected;
  }

  let providerFile;
  try {
    providerFile = getProviderFile(alias);
  } catch (e) {
    console.log(chalk.red(e.message));
    return;
  }
  if (!(await fs.pathExists(providerFile))) {
    console.log(chalk.red(`Provider '${alias}' not found`));
    return;
  }

  const config = await fs.readJson(CONFIG_FILE);
  config.defaultProvider = alias;
  await fs.writeJson(CONFIG_FILE, config);

  // 更新 lastUsed 字段
  try {
    const provider = await fs.readJson(providerFile);
    provider.lastUsed = new Date().toISOString();
    await fs.writeJson(providerFile, provider);
  } catch (e) {
    // 忽略 lastUsed 更新失败
  }

  console.log(chalk.green(`✓ Default provider set to '${alias}'`));
}

async function outputEnv(options) {
  await ensureDirectories();

  const config = await fs.readJson(CONFIG_FILE);
  const alias = options.provider || config.defaultProvider;

  if (!alias) {
    console.error('# No default provider configured');
    console.error('# Run: cconfig add');
    console.error('# Then: cconfig use <alias>');
    process.exit(1);
  }

  let providerFile;
  try {
    providerFile = getProviderFile(alias);
  } catch (e) {
    console.error(`# ${e.message}`);
    process.exit(1);
  }
  if (!(await fs.pathExists(providerFile))) {
    console.error(`# Provider '${alias}' not found`);
    console.error('# Run: cconfig list');
    console.error('# Or: cconfig add');
    process.exit(1);
  }

  const provider = await fs.readJson(providerFile);
  const shell = options.shell || 'bash';

  if (shell === 'fish') {
    console.log(`set -x ANTHROPIC_AUTH_TOKEN "${provider.apiKey}"`);
    console.log(`set -x ANTHROPIC_BASE_URL "${provider.apiUrl}"`);
  } else {
    console.log(`export ANTHROPIC_AUTH_TOKEN="${provider.apiKey}"`);
    console.log(`export ANTHROPIC_BASE_URL="${provider.apiUrl}"`);
  }
}

async function statusCommand(options = {}) {
  await ensureDirectories();

  let jsonFiles = [];
  try {
    const files = await fs.readdir(PROVIDERS_DIR);
    jsonFiles = files.filter(f => f.endsWith('.json'));
  } catch (error) {
    console.error(chalk.red(`读取 Provider 列表失败: ${error.message}`));
    process.exit(1);
  }

  const config = await fs.readJson(CONFIG_FILE);
  const defaultAlias = config.defaultProvider || null;

  console.log(chalk.cyan('系统状态'));
  console.log(`配置目录: ${CONFIG_DIR}`);
  console.log(`配置数量: ${jsonFiles.length}`);
  console.log(`默认配置: ${defaultAlias ? defaultAlias : '无'}`);

  if (defaultAlias) {
    const defaultFile = path.join(PROVIDERS_DIR, `${defaultAlias}.json`);
    if (!(await fs.pathExists(defaultFile))) {
      console.log(chalk.yellow('警告: 默认配置文件不存在，请重新设置默认配置'));
    }
  }

  if (options.detailed) {
    console.log('\n详细信息:');
    for (const file of jsonFiles) {
      try {
        const provider = await fs.readJson(path.join(PROVIDERS_DIR, file));
        const last = provider.lastUsed
          ? formatRelativeTime(provider.lastUsed)
          : '-';
        const mark =
          provider.alias === defaultAlias ? chalk.green('[默认] ') : '';
        console.log(
          `- ${mark}${provider.alias} -> ${provider.apiUrl} (lastUsed: ${last})`
        );
      } catch (e) {
        console.log(chalk.yellow(`- 读取失败: ${file} (${e.message})`));
      }
    }
  }
}

// Main CLI program
const program = new Command();

program
  .name('cconfig')
  .description('Claude Configuration Manager - Claude API 配置管理工具')
  .version(packageJson.version, '-V, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息');

program.command('add').description('添加新的 API 配置').action(addProvider);

program
  .command('list')
  .description('列出所有已配置的 API 端点')
  .action(listProviders);

program
  .command('show')
  .argument('<alias>', 'Provider alias')
  .description('显示配置详情')
  .action(showProvider);

program
  .command('edit')
  .argument('<alias>', 'Provider alias')
  .description('编辑现有配置')
  .action(editProvider);

program
  .command('remove')
  .argument('<alias>', 'Provider alias')
  .description('删除配置')
  .action(removeProvider);

program
  .command('use')
  .argument('[alias]', 'Provider alias (interactive if not provided)')
  .description('切换到指定的 API 配置')
  .action(useProvider);

program
  .command('env')
  .description('输出指定或默认 Provider 的环境变量')
  .option('--provider <alias>', 'Specific provider to use')
  .option('--shell <shell>', 'Shell format (bash, zsh, fish)', 'bash')
  .action(outputEnv);

program
  .command('status')
  .description('显示系统状态信息')
  .option('--detailed', '显示详细状态信息')
  .action(statusCommand);

async function doctorCommand(options = {}) {
  await ensureDirectories();
  let ok = true;

  console.log(chalk.cyan('系统诊断'));

  // 1) 配置目录检查
  try {
    const exists = await fs.pathExists(CONFIG_DIR);
    console.log(`配置目录: ${exists ? chalk.green('OK') : chalk.red('缺失')}`);
    if (!exists) {
      ok = false;
    }
  } catch (e) {
    console.log(chalk.red(`配置目录检查失败: ${e.message}`));
    ok = false;
  }

  // 2) 默认配置有效性
  try {
    const config = await fs.readJson(CONFIG_FILE);
    const def = config.defaultProvider;
    if (!def) {
      console.log('默认配置: 未设置');
    } else {
      const file = path.join(PROVIDERS_DIR, `${def}.json`);
      if (await fs.pathExists(file)) {
        console.log(`默认配置: ${def} (${chalk.green('OK')})`);
      } else {
        console.log(chalk.yellow(`默认配置无效: ${def}（文件不存在）`));
        ok = false;
        if (options.fix) {
          config.defaultProvider = null;
          await fs.writeJson(CONFIG_FILE, config);
          console.log(chalk.green('已修复: 已清空默认配置'));
        }
      }
    }
  } catch (e) {
    console.log(chalk.red(`读取配置失败: ${e.message}`));
    ok = false;
  }

  // 3) 权限检查（类 Unix）
  if (!isWindows()) {
    try {
      const files = await fs.readdir(PROVIDERS_DIR);
      for (const f of files) {
        if (!f.endsWith('.json')) {
          continue;
        }
        const full = path.join(PROVIDERS_DIR, f);
        const st = await fs.stat(full);
        const mode = st.mode & parseInt('777', 8);
        if (mode !== 0o600) {
          console.log(
            chalk.yellow(
              `权限不安全: ${f} (当前: ${mode.toString(8)}, 期望: 600)`
            )
          );
          ok = false;
          if (options.fix) {
            try {
              await fs.chmod(full, 0o600);
              console.log(chalk.green(`已修复权限: ${f} -> 600`));
            } catch (e) {
              console.log(chalk.red(`修复权限失败: ${f} (${e.message})`));
            }
          }
        }
      }
    } catch (e) {
      console.log(chalk.red(`权限检查失败: ${e.message}`));
      ok = false;
    }
  }

  // 4) Provider JSON 结构校验
  try {
    const files = await fs.readdir(PROVIDERS_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) {
        continue;
      }
      const full = path.join(PROVIDERS_DIR, f);
      try {
        const data = await fs.readJson(full);
        const base = path.basename(f, '.json');
        // alias 校验
        let aliasOk = true;
        try {
          validateAlias(data.alias);
        } catch (e) {
          console.log(chalk.yellow(`结构警告: ${f} 别名无效 (${e.message})`));
          aliasOk = false;
          ok = false;
        }
        if (aliasOk && data.alias !== base) {
          console.log(
            chalk.yellow(
              `结构警告: ${f} 别名与文件名不一致 (alias=${data.alias}, file=${base})`
            )
          );
          ok = false;
          if (options.fix) {
            data.alias = base;
            await fs.writeJson(full, data);
            if (!isWindows()) {
              try {
                await fs.chmod(full, 0o600);
              } catch (e) {
                // 忽略权限设置失败
              }
            }
            console.log(chalk.green(`已修复: 同步别名为文件名 ${base}`));
          }
        }
        // URL 校验
        const urlCheck = validateApiUrlSecure(data.apiUrl || '');
        if (urlCheck !== true) {
          console.log(chalk.yellow(`结构警告: ${f} URL 无效: ${urlCheck}`));
          ok = false;
        }
        // Key 校验
        if (
          !data.apiKey ||
          typeof data.apiKey !== 'string' ||
          !data.apiKey.trim()
        ) {
          console.log(
            chalk.yellow(
              `结构警告: ${f} API Key 为空，请运行: cconfig edit ${base}`
            )
          );
          ok = false;
        }
      } catch (e) {
        console.log(chalk.red(`读取或解析失败: ${f} (${e.message})`));
        ok = false;
      }
    }
  } catch (e) {
    console.log(chalk.red(`Provider 文件检查失败: ${e.message})`));
    ok = false;
  }

  if (ok) {
    console.log(chalk.green('诊断完成: 一切正常'));
  } else if (!options.fix) {
    console.log(chalk.yellow('诊断完成: 发现问题，使用 --fix 可尝试自动修复'));
  }
}

program
  .command('doctor')
  .description('运行系统诊断')
  .option('--fix', '诊断并尝试修复问题')
  .action(doctorCommand);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log('CConfig - Claude Configuration Manager');
  console.log('简单、安全的 Claude API 配置管理工具\n');
  program.outputHelp();
} else {
  program.parse(process.argv);
}
