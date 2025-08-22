# Claude Code Kit 快速开始指南

## 📋 目录

- [简介](#简介)
- [系统要求](#系统要求)
- [5分钟快速安装](#5分钟快速安装)
- [第一次配置](#第一次配置)
- [基础使用](#基础使用)
- [常见使用场景](#常见使用场景)
- [下一步](#下一步)

## 简介

Claude Code Kit 是一个强大的配置工具包，为 Claude Code 提供多提供商支持、安全凭据管理和无缝设置。通过本指南，您将在 5 分钟内完成安装并开始使用。

## 系统要求

### 必需条件
- **操作系统**: macOS 或 Linux
- **Shell**: bash 或 zsh
- **网络**: 稳定的互联网连接

### 自动安装的依赖
以下依赖会在安装过程中自动安装：
- **Node.js** 18+ (推荐 22+)
- **Claude Code CLI** (如果未安装)

## 5分钟快速安装

### 方法一：一键安装脚本（推荐）

```bash
# 下载并运行安装脚本
curl -fsSL https://raw.githubusercontent.com/claude-code-kit/claude-code-kit/main/install.sh | bash
```

### 方法二：npm 全局安装

```bash
# 确保已安装 Node.js 18+
npm install -g @kedoupi/claude-code-kit

# 或使用 yarn
yarn global add @kedoupi/claude-code-kit
```

### 安装进度说明

安装过程中您会看到如下进度：

```
🚀 Claude Code Kit 安装器
✓ 检查系统环境...
✓ 安装 Node.js (如果需要)...
✓ 安装 Claude Code CLI...
✓ 安装 Claude Code Kit...
✓ 创建配置目录...
✅ 安装完成！
```

## 第一次配置

### 1. 验证安装

```bash
# 检查安装是否成功
cc-config --version

# 运行系统诊断
cc-config doctor
```

预期输出：
```
Claude Code Kit Configuration Manager 1.0.0

🩺 Claude Code Kit System Diagnostics
✅ Node.js Environment
✅ Dependencies  
✅ File System Permissions
✅ Configuration Status
```

### 2. 添加第一个 API 提供商

```bash
cc-config provider add
```

系统将引导您完成交互式配置：

```
📡 Add New API Provider

? Provider alias (command name): claude-main
? API Base URL: https://api.anthropic.com
? API Key: [输入您的API密钥]
? Request timeout (ms): 3000000

✅ Provider 'claude-main' added successfully!

💡 Next steps:
   1. Restart your terminal or run: source ~/.zshrc
   2. Test the provider: claude-main "Hello"
   3. List all providers: cc-config provider list
```

### 3. 重新加载 Shell 配置

```bash
# 对于 zsh 用户
source ~/.zshrc

# 对于 bash 用户  
source ~/.bashrc
```

## 基础使用

### 测试您的配置

```bash
# 使用您刚配置的提供商
claude-main "你好！请介绍一下你自己。"
```

### 查看所有配置的提供商

```bash
cc-config provider list
```

输出示例：
```
📡 Configured API Providers

Alias           Base URL                        Status
──────────────────────────────────────────────────────────
claude-main     https://api.anthropic.com       ✓ Active

💡 Total: 1 provider(s) configured
```

### 查看系统状态

```bash
cc-config status
```

## 常见使用场景

### 场景 1：配置多个提供商

如果您需要使用多个 API 提供商（例如不同的 API 密钥或不同的服务）：

```bash
# 添加工作用的提供商
cc-config provider add
# 配置别名为：claude-work

# 添加个人用的提供商  
cc-config provider add  
# 配置别名为：claude-personal

# 现在可以分别使用
claude-work "工作相关的问题"
claude-personal "个人项目问题"
```

### 场景 2：快速切换默认提供商

```bash
# 查看可用提供商
cc-config provider list

# 设置默认提供商
cc-config provider use claude-work

# 现在 claude-work 成为默认选择
```

### 场景 3：测试提供商连接

```bash
# 查看特定提供商详情
cc-config provider show claude-main

# 运行完整诊断（包括连接测试）
cc-config doctor
```

### 场景 4：备份和恢复配置

```bash
# 查看配置历史和备份
cc-config history

# 如果需要恢复到之前的配置
# 从交互式菜单中选择要恢复的备份
```

## 下一步

### 🚀 准备好深入了解？

1. **阅读完整用户手册**: [用户手册](user-guide.md)
2. **查看使用示例**: [使用示例](examples.md)  
3. **遇到问题？**: [FAQ](faq.md)

### 🔧 高级配置

- **自定义配置模板**: 了解如何创建自己的配置模板
- **批量配置管理**: 适合团队和企业用户的配置管理
- **集成其他工具**: 与 IDE、CI/CD 等工具的集成

### 📚 更多资源

- [项目 GitHub 仓库](https://github.com/claude-code-kit/claude-code-kit)
- [问题反馈](https://github.com/claude-code-kit/claude-code-kit/issues)
- [贡献指南](https://github.com/claude-code-kit/claude-code-kit/blob/main/CONTRIBUTING.md)

## 💡 小贴士

- **定期运行 `cc-config doctor`** 来检查系统状态
- **使用 `cc-config status --detailed`** 获取详细的配置信息
- **在重要操作前，系统会自动创建备份**，您可以随时恢复
- **所有敏感信息（如 API 密钥）都经过安全处理**，不会出现在日志中

---

**恭喜！** 🎉 您已经成功完成了 Claude Code Kit 的基础设置。现在可以开始享受强大的 Claude Code 体验了！

如果在使用过程中遇到任何问题，请查看 [FAQ](faq.md) 或在 GitHub 上提交 issue。