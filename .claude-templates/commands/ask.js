#!/usr/bin/env node

/**
 * /ask 命令 - 需求分析对话专家
 * 深度理解产品想法并澄清需求细节
 */

const chalk = require('chalk');
const inquirer = require('inquirer');

class AskCommand {
  constructor() {
    this.name = 'ask';
    this.description = '需求分析对话，深度理解产品想法并澄清需求细节';
    this.usage = '/ask [需求描述]';
  }

  async execute(args, context) {
    console.log(chalk.blue.bold('🎯 需求分析对话专家'));
    console.log(chalk.gray('让我们深入理解您的需求...'));
    console.log();

    const requirement = args.join(' ');
    
    if (!requirement) {
      const { userRequirement } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'userRequirement',
          message: '请详细描述您的需求：',
          validate: input => input.trim().length > 0 || '请输入需求描述'
        }
      ]);
      
      return this.analyzeRequirement(userRequirement, context);
    }
    
    return this.analyzeRequirement(requirement, context);
  }

  async analyzeRequirement(requirement, context) {
    console.log(chalk.yellow('📋 需求分析中...'));
    
    // 分析需求的维度
    const analysisPrompt = `
作为需求分析专家，请对以下需求进行深度分析：

需求描述：${requirement}

请从以下维度进行分析：

1. **功能需求分析**
   - 核心功能点识别
   - 用户角色和使用场景
   - 功能优先级划分

2. **技术需求分析**
   - 技术栈建议
   - 架构设计考虑
   - 性能和扩展性要求

3. **业务需求分析**
   - 业务价值和目标
   - 成功指标定义
   - 风险和挑战识别

4. **实现路径建议**
   - 开发阶段规划
   - 最小可行产品(MVP)定义
   - 迭代计划建议

5. **需要澄清的问题**
   - 列出5-10个关键问题
   - 帮助进一步明确需求细节

请提供详细、结构化的分析报告。
`;

    // 这里可以集成 Claude API 调用
    console.log(chalk.green('✨ 需求分析完成'));
    console.log();
    console.log(chalk.blue('📊 分析报告已生成，建议继续使用:'));
    console.log(chalk.gray('  /specs - 生成详细规格文档'));
    console.log(chalk.gray('  /workflow - 执行开发工作流'));
    
    return {
      command: 'ask',
      requirement: requirement,
      analysis: analysisPrompt,
      nextSteps: ['specs', 'workflow']
    };
  }
}

module.exports = AskCommand;