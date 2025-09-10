---
layer: 基础层
priority: high
context_type: quick_start
language: zh-CN
created: 2025-09-10
---

# CCVM 快速入门指南

## 🚀 三分钟上手 CCVM

### 什么是 CCVM？
CCVM (Claude Code Version Manager) 是一个**配置管理工具**，让你轻松在不同的 Claude API 提供商之间切换。

### 🎯 核心用途
- **API 切换**: 在不同的 Claude 服务商间一键切换
- **安全管理**: 安全存储你的 API 密钥  
- **Shell 集成**: 与命令行完美集成

### ⚡ 立即开始

```bash
# 1. 安装 CCVM
curl -fsSL https://github.com/kedoupi/ccvm/raw/main/install.sh | bash

# 2. 添加第一个配置
ccvm add

# 3. 开始使用
claude "你好，帮我分析一下这个代码"
```

### 📱 常用命令
```bash
ccvm list          # 查看所有配置
ccvm use <名称>     # 切换默认配置
ccvm status        # 查看当前状态
ccvm doctor        # 诊断问题
```

### 🆘 遇到问题？
- 运行 `ccvm doctor --fix` 自动修复常见问题
- 查看 [详细文档](./.claude/context/tech-context.md) 了解更多
- [问题排查指南](./.claude/context/troubleshooting.md) 解决具体问题

---
*这是基础层文档 - 适合快速了解和上手使用*