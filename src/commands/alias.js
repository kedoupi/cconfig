const chalk = require('chalk');
const ConfigManager = require('../core/ConfigManager');
const AliasGenerator = require('../core/AliasGenerator');
const {
  handleError,
  handleSuccess,
  handleInfo,
  handleWarning,
} = require('../utils/errorHandler');

const configManager = new ConfigManager();
const aliasGenerator = new AliasGenerator(configManager);

/**
 * 生成Shell别名配置
 */
async function generate(_options) {
  try {
    console.log(chalk.blue('🔗 生成Shell别名配置'));

    // 确保配置目录存在
    await configManager.initialize();

    const script = await aliasGenerator.generateAliases();

    if (!script) {
      handleWarning('没有启用的服务商配置，无法生成别名');
      handleInfo('请先使用 "cc-config provider add" 添加服务商配置');
      return;
    }

    handleSuccess('别名配置生成成功');
    console.log(chalk.gray(`别名文件: ${configManager.aliasesFile}`));

    // 显示生成的别名
    const stats = await aliasGenerator.getAliasStats();
    if (stats.enabled > 0) {
      console.log(chalk.blue('\n📋 可用别名:'));
      stats.aliases
        .filter(a => a.enabled)
        .forEach(alias => {
          console.log(
            `   ${chalk.cyan(alias.alias)} - ${alias.description || '无描述'}`
          );
        });
    }

    // 提示用户下一步操作
    console.log(chalk.yellow('\n📝 下一步操作:'));
    console.log('1. 安装别名到Shell配置: cc-config alias install');
    console.log('2. 或者手动添加到Shell配置文件:');
    console.log(`   echo "source ${configManager.aliasesFile}" >> ~/.zshrc`);
    console.log('3. 重新加载Shell配置: source ~/.zshrc');
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 安装别名到Shell配置
 */
async function install(options) {
  try {
    console.log(chalk.blue('📦 安装别名到Shell配置'));

    // 首先生成最新的别名配置
    await generate({ force: options.force });

    // 检测Shell类型
    const shell = options.shell || aliasGenerator.detectShell();
    console.log(chalk.gray(`检测到Shell类型: ${shell}`));

    // 更新Shell配置
    const result = await aliasGenerator.updateShellConfig(options.force);

    if (result.updated) {
      handleSuccess(result.message);
      console.log(chalk.blue('📋 安装完成，需要重新加载Shell配置:'));

      if (shell === 'zsh') {
        console.log('   source ~/.zshrc');
      } else if (shell === 'bash') {
        console.log('   source ~/.bashrc');
      } else {
        console.log(`   source ${result.configFile}`);
      }

      console.log('\n或者重新打开终端窗口');

      // 显示可用的别名
      const stats = await aliasGenerator.getAliasStats();
      if (stats.enabled > 0) {
        console.log(chalk.blue('\n🎉 安装成功！可用别名:'));
        stats.aliases
          .filter(a => a.enabled)
          .forEach(alias => {
            console.log(
              `   ${chalk.cyan(alias.alias)} - 使用此别名调用对应服务商`
            );
          });
      }
    } else {
      handleInfo(result.message);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 从Shell配置中移除别名
 */
async function uninstall() {
  try {
    console.log(chalk.blue('🗑️  从Shell配置中移除别名'));

    const result = await aliasGenerator.removeShellConfig();

    if (result.removed) {
      handleSuccess(result.message);
      console.log(chalk.blue('📋 移除完成，需要重新加载Shell配置:'));
      console.log(`   source ${result.configFile}`);
      console.log('\n或者重新打开终端窗口');
    } else {
      handleInfo(result.message);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 验证别名配置
 */
async function validate() {
  try {
    console.log(chalk.blue('🔍 验证别名配置'));

    const validation = await aliasGenerator.validateAliases();

    console.log(chalk.blue('\n📊 验证结果:'));

    if (validation.valid) {
      handleSuccess('别名配置验证通过');
    } else {
      console.log(chalk.red('❌ 发现配置问题:'));
    }

    if (validation.issues.length > 0) {
      console.log();
      validation.issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        const color = issue.severity === 'error' ? 'red' : 'yellow';
        console.log(`${icon} ${chalk[color](issue.message)}`);

        // 提供解决建议
        if (issue.type === 'duplicate_alias') {
          console.log(
            chalk.gray('   建议: 使用 "cc-config provider edit" 修改重复的别名')
          );
        } else if (issue.type === 'system_conflict') {
          console.log(chalk.gray('   建议: 避免使用系统命令作为别名'));
        } else if (issue.type === 'missing_config') {
          console.log(chalk.gray('   建议: 重新添加缺失的服务商配置'));
        }
      });
    }

    // 显示统计信息
    const stats = await aliasGenerator.getAliasStats();
    console.log(chalk.blue('\n📈 配置统计:'));
    console.log(`   总数: ${stats.total}`);
    console.log(`   启用: ${chalk.green(stats.enabled)}`);
    console.log(`   禁用: ${chalk.red(stats.disabled)}`);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * 显示别名统计信息
 */
async function stats() {
  try {
    const stats = await aliasGenerator.getAliasStats();
    const shell = aliasGenerator.detectShell();
    const configFile = aliasGenerator.getShellConfigFile();

    console.log(chalk.blue('📊 别名配置统计\n'));

    // 基本统计
    console.log(chalk.green('📈 基本统计:'));
    console.log(`   总服务商数: ${stats.total}`);
    console.log(`   启用别名数: ${chalk.green(stats.enabled)}`);
    console.log(`   禁用别名数: ${chalk.red(stats.disabled)}`);
    console.log();

    // Shell信息
    console.log(chalk.green('🐚 Shell信息:'));
    console.log(`   当前Shell: ${shell}`);
    console.log(`   配置文件: ${configFile}`);
    console.log(`   别名文件: ${configManager.aliasesFile}`);
    console.log();

    // 别名列表
    if (stats.aliases.length > 0) {
      console.log(chalk.green('🔗 别名列表:'));
      stats.aliases.forEach(alias => {
        const statusIcon = alias.enabled ? '✅' : '❌';
        const statusColor = alias.enabled ? 'green' : 'red';
        const description = alias.description || '无描述';

        console.log(
          `   ${statusIcon} ${chalk[statusColor](alias.alias)} - ${description}`
        );
      });
      console.log();
    }

    // 配置状态检查
    try {
      const fs = require('fs-extra');

      console.log(chalk.green('🔍 配置状态:'));

      // 检查别名文件是否存在
      const aliasFileExists = await fs.exists(configManager.aliasesFile);
      console.log(
        `   别名文件: ${aliasFileExists ? chalk.green('✅ 存在') : chalk.red('❌ 不存在')}`
      );

      // 检查Shell配置是否包含source命令
      if (await fs.exists(configFile)) {
        const content = await fs.readFile(configFile, 'utf8');
        const hasSource = content.includes('source ~/.cc-config/aliases.sh');
        console.log(
          `   Shell集成: ${hasSource ? chalk.green('✅ 已安装') : chalk.yellow('⚠️  未安装')}`
        );

        if (!hasSource) {
          console.log(
            chalk.yellow(
              '     使用 "cc-config alias install" 安装别名到Shell配置'
            )
          );
        }
      } else {
        console.log(`   Shell配置: ${chalk.red('❌ 配置文件不存在')}`);
      }

      // 验证配置
      const validation = await aliasGenerator.validateAliases();
      console.log(
        `   配置验证: ${validation.valid ? chalk.green('✅ 通过') : chalk.red('❌ 有问题')}`
      );
    } catch (checkError) {
      console.log(`   状态检查失败: ${checkError.message}`);
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

module.exports = {
  generate,
  install,
  uninstall,
  validate,
  stats,
};
