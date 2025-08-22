# Claude Code Kit

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/@kedoupi/claude-code-kit.svg)](https://npmjs.org/package/@kedoupi/claude-code-kit)
[![License](https://img.shields.io/npm/l/@kedoupi/claude-code-kit.svg)](https://github.com/kedoupi/claude-code-kit/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/@kedoupi/claude-code-kit.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)](https://github.com/kedoupi/claude-code-kit)
[![CI Status](https://img.shields.io/github/workflow/status/kedoupi/claude-code-kit/CI)](https://github.com/kedoupi/claude-code-kit/actions)

**🚀 专业的 Claude Code 配置管理工具包**

*Professional Configuration Toolkit for Claude Code*

[中文](#中文文档) | [English](#english-documentation) | [文档](docs/) | [示例](docs/examples.md) | [FAQ](docs/faq.md)

</div>

---

## 中文文档

### 📖 项目简介

Claude Code Kit 是一个全面的 Claude Code 配置管理工具包，为开发者提供多提供商支持、安全凭据管理和无缝环境设置。通过统一的命令行界面，轻松管理不同的 API 提供商，在多个 Claude 服务之间无缝切换，提升开发效率。

### ✨ 核心特性

- 🔧 **多提供商支持** - 轻松配置和切换多个 Claude API 提供商
- 🛡️ **安全凭据管理** - 安全存储和管理 API 密钥，支持权限控制
- 🚀 **一键安装配置** - 自动环境检测，智能安装和配置
- 📦 **智能别名系统** - 自动生成 shell 别名，快速切换提供商
- 🔄 **自动备份恢复** - 配置变更自动备份，支持一键恢复
- 🩺 **系统诊断工具** - 全面的系统检查和问题诊断
- 🎯 **简洁设计理念** - 减少命令冗余，统一管理界面

### 🚀 快速开始

#### 安装方式

**方式一：npm 全局安装（推荐）**
```bash
npm install -g @kedoupi/claude-code-kit
```

**方式二：一键安装脚本**
```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/claude-code-kit/main/install.sh | bash
```

**方式三：本地安装**
```bash
git clone https://github.com/kedoupi/claude-code-kit.git
cd claude-code-kit
npm install
npm install -g .
```

#### 基础使用

1. **添加 API 提供商**
```bash
cc-config provider add
# 按提示输入：别名、API地址、密钥等信息
```

2. **列出所有提供商**
```bash
cc-config provider list
```

3. **查看提供商详情**
```bash
cc-config provider show <别名>
```

4. **使用提供商**
```bash
# 使用配置的提供商别名直接调用
your-alias "你的问题"

# 例如：
claude "解释 React hooks"
openai "设计一个 REST API"
```

5. **系统状态检查**
```bash
cc-config status
cc-config doctor
```

### 💡 使用示例

#### 多提供商配置
```bash
# 配置 Anthropic 官方 API
cc-config provider add
# 别名: anthropic
# URL: https://api.anthropic.com
# 密钥: your-anthropic-key

# 配置自定义 API 服务
cc-config provider add  
# 别名: custom
# URL: https://your-custom-api.com
# 密钥: your-custom-key

# 使用不同提供商
anthropic "技术问题咨询"
custom "使用自定义API的问题"
```

#### 团队协作配置
```bash
# 导出配置（去除敏感信息）
cc-config export --safe > team-config.json

# 团队成员导入配置模板
cc-config import team-config.json
# 然后各自添加API密钥
```

### 🏗️ 系统架构

```
Claude Code Kit
├── ConfigManager      # 系统配置管理
├── ProviderManager    # API提供商管理  
├── BackupManager      # 备份和恢复
├── AliasGenerator     # Shell别名生成
└── SecurityManager    # 安全和权限控制
```

**配置文件结构**
```
~/.cc-config/
├── config.json        # 系统配置
├── aliases.sh         # 生成的shell别名
├── providers/         # 提供商配置
│   ├── anthropic.json
│   └── custom.json
└── backups/           # 自动备份
    └── 2024-01-20_10-30-45/
```

### 📚 详细文档

- **[快速开始指南](docs/quick-start.md)** - 5分钟完成安装和配置
- **[用户手册](docs/user-guide.md)** - 完整的功能说明和最佳实践
- **[使用示例](docs/examples.md)** - 各种实际使用场景
- **[常见问题](docs/faq.md)** - 问题解答和故障排除
- **[架构文档](CLAUDE.md)** - 开发者技术文档

### 🛠️ 开发者指南

#### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- jq (JSON 处理工具)

#### 开发命令
```bash
# 安装依赖
npm install

# 运行测试
npm test
npm run test:coverage

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format

# 集成测试
npm run test:integration
```

#### 项目结构
```
claude-code-kit/
├── src/                # 源代码
│   ├── core/          # 核心管理器
│   │   ├── ConfigManager.js
│   │   ├── ProviderManager.js
│   │   ├── BackupManager.js
│   │   └── AliasGenerator.js
│   └── utils/         # 工具函数
├── bin/               # CLI入口
├── tests/             # 测试文件
├── docs/              # 项目文档
└── install.sh         # 安装脚本
```

### 🔒 安全特性

- **权限控制** - API密钥文件使用600权限存储
- **安全验证** - HTTPS强制验证（本地和内网除外）
- **备份加密** - 自动备份包含完整性校验
- **环境隔离** - 动态加载配置，避免环境变量污染

### 🤝 贡献指南

我们欢迎所有形式的贡献！

1. **Fork** 项目仓库
2. **创建** 功能分支 (`git checkout -b feature/amazing-feature`)
3. **提交** 更改 (`git commit -m 'Add amazing feature'`)
4. **推送** 到分支 (`git push origin feature/amazing-feature`)
5. **创建** Pull Request

#### 开发规范
- 遵循 ESLint 和 Prettier 代码规范
- 为新功能编写单元测试
- 更新相关文档
- 保持提交信息清晰明确

### 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

### 🙏 致谢

感谢所有为项目做出贡献的开发者和社区成员！

---

## English Documentation

### 📖 Project Overview

Claude Code Kit is a comprehensive configuration management toolkit for Claude Code, providing multi-provider support, secure credential management, and seamless environment setup. Easily manage different API providers through a unified command-line interface and switch between multiple Claude services effortlessly.

### ✨ Key Features

- 🔧 **Multi-Provider Support** - Easy configuration and switching between multiple Claude API providers
- 🛡️ **Secure Credential Management** - Safe storage and management of API keys with permission control
- 🚀 **One-Click Installation** - Automatic environment detection with intelligent setup
- 📦 **Smart Alias System** - Auto-generated shell aliases for quick provider switching
- 🔄 **Automatic Backup & Restore** - Auto-backup on configuration changes with one-click restore
- 🩺 **System Diagnostics** - Comprehensive system checks and issue diagnosis
- 🎯 **Clean Design** - Reduced command redundancy with unified management interface

### 🚀 Quick Start

#### Installation Methods

**Method 1: Global npm install (Recommended)**
```bash
npm install -g @kedoupi/claude-code-kit
```

**Method 2: One-line install script**
```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/claude-code-kit/main/install.sh | bash
```

**Method 3: Local installation**
```bash
git clone https://github.com/kedoupi/claude-code-kit.git
cd claude-code-kit
npm install
npm install -g .
```

#### Basic Usage

1. **Add API Provider**
```bash
cc-config provider add
# Follow prompts to enter: alias, API URL, key, etc.
```

2. **List All Providers**
```bash
cc-config provider list
```

3. **Show Provider Details**
```bash
cc-config provider show <alias>
```

4. **Use Provider**
```bash
# Use configured provider alias directly
your-alias "your question"

# Examples:
claude "Explain React hooks"
openai "Design a REST API"
```

5. **System Status Check**
```bash
cc-config status
cc-config doctor
```

### 💡 Usage Examples

#### Multi-Provider Configuration
```bash
# Configure Anthropic official API
cc-config provider add
# Alias: anthropic
# URL: https://api.anthropic.com
# Key: your-anthropic-key

# Configure custom API service
cc-config provider add  
# Alias: custom
# URL: https://your-custom-api.com
# Key: your-custom-key

# Use different providers
anthropic "Technical consultation"
custom "Question using custom API"
```

#### Team Collaboration Setup
```bash
# Export configuration (without sensitive data)
cc-config export --safe > team-config.json

# Team members import configuration template
cc-config import team-config.json
# Then each adds their API keys
```

### 🏗️ System Architecture

```
Claude Code Kit
├── ConfigManager      # System configuration management
├── ProviderManager    # API provider management  
├── BackupManager      # Backup and restore
├── AliasGenerator     # Shell alias generation
└── SecurityManager    # Security and permission control
```

**Configuration File Structure**
```
~/.cc-config/
├── config.json        # System configuration
├── aliases.sh         # Generated shell aliases
├── providers/         # Provider configurations
│   ├── anthropic.json
│   └── custom.json
└── backups/           # Automatic backups
    └── 2024-01-20_10-30-45/
```

### 📚 Detailed Documentation

- **[Quick Start Guide](docs/quick-start.md)** - Complete setup in 5 minutes
- **[User Manual](docs/user-guide.md)** - Complete feature guide and best practices
- **[Usage Examples](docs/examples.md)** - Various real-world scenarios
- **[FAQ](docs/faq.md)** - Common questions and troubleshooting
- **[Architecture Docs](CLAUDE.md)** - Technical documentation for developers

### 🛠️ Developer Guide

#### Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0
- jq (JSON processing tool)

#### Development Commands
```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:coverage

# Code linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Integration tests
npm run test:integration
```

#### Project Structure
```
claude-code-kit/
├── src/                # Source code
│   ├── core/          # Core managers
│   │   ├── ConfigManager.js
│   │   ├── ProviderManager.js
│   │   ├── BackupManager.js
│   │   └── AliasGenerator.js
│   └── utils/         # Utility functions
├── bin/               # CLI entry point
├── tests/             # Test files
├── docs/              # Project documentation
└── install.sh         # Installation script
```

### 🔒 Security Features

- **Permission Control** - API key files stored with 600 permissions
- **Security Validation** - HTTPS enforcement (except localhost/private networks)
- **Backup Encryption** - Auto-backups include integrity verification
- **Environment Isolation** - Dynamic configuration loading to avoid env pollution

### 🤝 Contributing

We welcome all forms of contributions!

1. **Fork** the project repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Create** a Pull Request

#### Development Standards
- Follow ESLint and Prettier code standards
- Write unit tests for new features
- Update relevant documentation
- Keep commit messages clear and descriptive

### 📊 Project Stats

- **Test Coverage**: 94%+
- **Core Modules**: 4 managers + utilities
- **Documentation**: Complete user and developer guides
- **Security**: Comprehensive validation and protection
- **Performance**: Optimized for CLI usage patterns

### 🌟 Community

- **GitHub Issues**: [Report bugs or request features](https://github.com/kedoupi/claude-code-kit/issues)
- **Discussions**: [Join community discussions](https://github.com/kedoupi/claude-code-kit/discussions)
- **Documentation**: [Comprehensive guides and examples](docs/)

### 📄 License

This project is licensed under the [MIT License](LICENSE).

### 🙏 Acknowledgments

Thanks to all developers and community members who contributed to this project!

---

<div align="center">

**Made with ❤️ by the Claude Code Kit community**

[⭐ Star us on GitHub](https://github.com/kedoupi/claude-code-kit) | [🐛 Report Issues](https://github.com/kedoupi/claude-code-kit/issues) | [📖 Read Docs](docs/)

</div>