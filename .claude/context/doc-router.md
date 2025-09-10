---
type: document_router
language: zh-CN
created: 2025-09-10
---

# CCVM 智能文档路由配置

## 🧠 路由决策逻辑

### 基础层文档使用场景 (quick-guide.md)
**触发条件**：
- 用户询问"什么是CCVM"、"怎么安装"、"快速开始"
- 首次使用相关问题
- 需要简单概览的情况

**关键词**：安装、开始、入门、介绍、是什么、怎么用

**回答策略**：
- 提供简洁明了的答案
- 重点关注核心功能和基本操作
- 引导用户快速上手

### 组件层文档使用场景 (component-guide.md)
**触发条件**：
- 询问具体功能模块的工作原理
- 需要了解架构设计
- 配置相关的详细问题

**关键词**：架构、组件、配置、MCP、管理器、工作原理、如何实现

**回答策略**：
- 详细解释各组件功能
- 提供配置示例和原理说明
- 包含技术细节但保持可理解

### 功能层文档使用场景 (advanced-usage.md)
**触发条件**：
- 复杂使用场景和工作流
- 高级配置和自定义需求
- 故障排查和性能优化

**关键词**：高级、自动化、CI/CD、故障、优化、多环境、批量、脚本

**回答策略**：
- 提供完整的解决方案
- 包含代码示例和最佳实践
- 深入的技术细节和专业建议

## 🎯 智能路由规则

### 问题复杂度评估
```javascript
// 伪代码：问题复杂度评估逻辑
function evaluateQuestionComplexity(question) {
    const basicKeywords = ['安装', '开始', '什么是', '怎么用', '介绍'];
    const componentKeywords = ['架构', '配置', '组件', '原理', '管理'];
    const advancedKeywords = ['高级', '自动化', '优化', '故障', '脚本'];
    
    if (containsKeywords(question, basicKeywords)) {
        return 'basic';
    } else if (containsKeywords(question, advancedKeywords)) {
        return 'advanced';  
    } else if (containsKeywords(question, componentKeywords)) {
        return 'component';
    } else {
        return 'basic'; // 默认返回基础层
    }
}
```

### 回答模式
1. **渐进式回答**：先给基础答案，然后询问是否需要更详细信息
2. **上下文感知**：根据对话历史调整文档层级
3. **智能推荐**：主动推荐相关文档层级

## 📋 使用指导

### 对AI助手的指导
当回答CCVM相关问题时：

1. **首先判断问题复杂度**
2. **选择合适的文档层级**
3. **提供该层级的专业回答**
4. **适时引导到其他层级**

### 示例对话流程

**用户**：CCVM是什么？
**AI**：*[路由到基础层]* CCVM是一个配置管理工具...（提供quick-guide.md内容）

**用户**：MCP管理器是怎么工作的？  
**AI**：*[路由到组件层]* MCP管理器负责...（提供component-guide.md内容）

**用户**：如何在CI/CD中集成CCVM？
**AI**：*[路由到功能层]* 在CI/CD环境中，你可以...（提供advanced-usage.md内容）

---
*此文件用于指导AI进行智能文档路由，提供分层的中文化帮助体验*