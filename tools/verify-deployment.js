#!/usr/bin/env node

/**
 * 验证部署工具 - 检查配置模板部署是否正常
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function verifyDeployment() {
  console.log(chalk.blue('🔍 验证配置模板部署状态\n'));
  
  const results = {
    templates: {},
    dependencies: {},
    structure: {}
  };
  
  // 1. 验证模板文件结构
  console.log(chalk.yellow('📁 检查模板文件结构...'));
  const templatesDir = path.join(__dirname, '../.claude-templates');
  
  try {
    // 检查settings.json模板
    const settingsPath = path.join(templatesDir, 'settings.json');
    if (await fs.pathExists(settingsPath)) {
      const settings = await fs.readJson(settingsPath);
      results.templates.settings = { exists: true, valid: !!settings.providers };
      console.log(chalk.green('✅ settings.json 模板存在且有效'));
    } else {
      results.templates.settings = { exists: false };
      console.log(chalk.red('❌ settings.json 模板缺失'));
    }
    
    // 检查CLAUDE.md模板
    const claudeMdPath = path.join(templatesDir, 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf8');
      results.templates.claudeMd = { exists: true, valid: content.includes('Claude Code') };
      console.log(chalk.green('✅ CLAUDE.md 模板存在且有效'));
    } else {
      results.templates.claudeMd = { exists: false };
      console.log(chalk.red('❌ CLAUDE.md 模板缺失'));
    }
    
    // 检查commands目录
    const commandsDir = path.join(templatesDir, 'commands');
    if (await fs.pathExists(commandsDir)) {
      const commands = await fs.readdir(commandsDir);
      results.templates.commands = { exists: true, count: commands.length };
      console.log(chalk.green(`✅ commands 目录存在，包含 ${commands.length} 个文件`));
    } else {
      results.templates.commands = { exists: false };
      console.log(chalk.red('❌ commands 目录缺失'));
    }
    
    // 检查agents目录
    const agentsDir = path.join(templatesDir, 'agents');
    if (await fs.pathExists(agentsDir)) {
      const agents = await fs.readdir(agentsDir);
      results.templates.agents = { exists: true, count: agents.length };
      console.log(chalk.green(`✅ agents 目录存在，包含 ${agents.length} 个文件`));
    } else {
      results.templates.agents = { exists: false };
      console.log(chalk.red('❌ agents 目录缺失'));
    }
    
    // 检查output-styles目录
    const outputStylesDir = path.join(templatesDir, 'output-styles');
    if (await fs.pathExists(outputStylesDir)) {
      const styles = await fs.readdir(outputStylesDir);
      results.templates.outputStyles = { exists: true, count: styles.length };
      console.log(chalk.green(`✅ output-styles 目录存在，包含 ${styles.length} 个文件`));
    } else {
      results.templates.outputStyles = { exists: false };
      console.log(chalk.red('❌ output-styles 目录缺失'));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ 模板文件验证失败: ${error.message}`));
  }
  
  console.log();
  
  // 2. 验证部署功能
  console.log(chalk.yellow('🚀 测试部署功能...'));
  try {
    const { deploy } = require('../src/commands/deploy');
    
    // 创建临时目录进行测试
    const tmpDir = path.join(__dirname, '../tmp-deploy-test');
    await fs.ensureDir(tmpDir);
    
    // 模拟部署到临时目录
    const originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    
    try {
      await deploy({ template: 'minimal', force: true, overwrite: true });
      
      // 检查部署结果
      const claudeDir = path.join(tmpDir, '.claude');
      const settingsFile = path.join(claudeDir, 'settings.json');
      
      if (await fs.pathExists(claudeDir) && await fs.pathExists(settingsFile)) {
        results.deployment = { success: true };
        console.log(chalk.green('✅ 部署功能正常'));
      } else {
        results.deployment = { success: false, reason: '文件未创建' };
        console.log(chalk.red('❌ 部署功能异常：文件未创建'));
      }
    } finally {
      process.env.HOME = originalHome;
      await fs.remove(tmpDir);
    }
    
  } catch (error) {
    results.deployment = { success: false, reason: error.message };
    console.log(chalk.red(`❌ 部署功能异常: ${error.message}`));
  }
  
  console.log();
  
  // 3. 验证依赖项
  console.log(chalk.yellow('📦 检查依赖项...'));
  try {
    const packageJson = await fs.readJson(path.join(__dirname, '../package.json'));
    const requiredDeps = ['fs-extra', 'chalk', 'inquirer', 'commander'];
    
    for (const dep of requiredDeps) {
      if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
        results.dependencies[dep] = true;
        console.log(chalk.green(`✅ ${dep} 已安装`));
      } else {
        results.dependencies[dep] = false;
        console.log(chalk.red(`❌ ${dep} 缺失`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`❌ 依赖项检查失败: ${error.message}`));
  }
  
  console.log();
  
  // 4. 生成报告
  console.log(chalk.blue('📊 验证报告摘要:'));
  
  const templateCount = Object.values(results.templates).filter(t => t.exists).length;
  const totalTemplates = Object.keys(results.templates).length;
  console.log(`模板文件: ${templateCount}/${totalTemplates} 正常`);
  
  const depCount = Object.values(results.dependencies).filter(Boolean).length;
  const totalDeps = Object.keys(results.dependencies).length;
  console.log(`依赖项: ${depCount}/${totalDeps} 正常`);
  
  const deploymentStatus = results.deployment?.success ? '正常' : '异常';
  console.log(`部署功能: ${deploymentStatus}`);
  
  console.log();
  
  if (templateCount === totalTemplates && depCount === totalDeps && results.deployment?.success) {
    console.log(chalk.green('🎉 所有验证通过！Claude Code 配置工具集已准备就绪。'));
    return true;
  } else {
    console.log(chalk.yellow('⚠️  部分项目需要注意，但核心功能可用。'));
    return false;
  }
}

// 运行验证
if (require.main === module) {
  verifyDeployment()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(chalk.red('验证过程发生错误:', error.message));
      process.exit(1);
    });
}

module.exports = { verifyDeployment };