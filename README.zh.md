# CCVM - Claude 代码版本管理器

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/@kedoupi/ccvm.svg)](https://npmjs.org/package/@kedoupi/ccvm)
[![License](https://img.shields.io/npm/l/@kedoupi/ccvm.svg)](https://github.com/kedoupi/ccvm/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/@kedoupi/ccvm.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)](https://github.com/kedoupi/ccvm)
[![CI Status](https://img.shields.io/github/workflow/status/kedoupi/ccvm/CI)](https://github.com/kedoupi/ccvm/actions)

**🚀 Claude API 提供商版本管理器**

*像 nvm 管理 Node.js 版本一样管理 Claude API 提供商*

[中文](#) | [English](README.md) | [文档](docs/) | [示例](docs/examples.md) | [FAQ](docs/faq.md)

</div>

---

## 📖 项目简介

CCVM（Claude Code Version Manager）是一个专业的 Claude API 提供商版本管理工具，类似于 nvm 管理 Node.js 版本的方式来管理不同的 Claude API 提供商。支持多个自定义 API 端点、密钥管理和环境隔离，让您可以像管理 Node.js 版本一样轻松管理 Claude 服务。

## ✨ 核心特性

- 🔧 **多提供商支持** - 轻松配置和切换多个 Claude API 提供商
- 🛡️ **安全凭据管理** - 安全存储和管理 API 密钥，支持权限控制
- 🚀 **一键安装配置** - 自动环境检测，智能安装和配置
- ⚡ **智能Claude集成** - 无缝集成原生Claude命令，自动环境变量配置
- 🔄 **自动备份恢复** - 配置变更自动备份，支持一键恢复
- 🩺 **系统诊断工具** - 全面的系统检查和问题诊断
- 🎯 **简洁设计理念** - 减少命令冗余，统一管理界面

## 🚀 快速开始

### 安装方式

CCVM 可以通过在终端中运行以下命令之一来安装：

| 方式    | 命令                                                                                           |
| :-------- | :------------------------------------------------------------------------------------------------ |
| **curl**  | `curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash` |
| **wget**  | `wget -qO- https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash`   |

> **注意**: 安装脚本会智能检测您的环境，并自动备份现有配置。

### 手动检查安装脚本

您可以在运行前手动检查安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh -o install.sh
# 检查脚本内容
cat install.sh
# 运行安装
bash install.sh
```

### 开发模式安装

**适用于贡献者和开发者**
```bash
git clone https://github.com/kedoupi/ccvm.git
cd ccvm
npm install
# 在项目目录下运行安装脚本，自动启用开发模式
./install.sh
```

## 💡 基础使用

### 1. 添加 API 提供商
```bash
ccvm add
# 按提示输入：提供商名称、API地址、密钥等信息
```

### 2. 列出所有提供商
```bash
ccvm list
```

### 3. 查看提供商详情
```bash
ccvm show <别名>
```

### 4. 使用提供商
```bash
# 设置默认提供商
ccvm use <别名>

# 使用claude命令（自动加载CCVM配置）
claude "你的问题"

# 例如：
claude "解释 React hooks"
claude "设计一个 REST API"
```

### 5. 系统状态检查
```bash
ccvm status
ccvm doctor
```

## 🎯 使用示例

### 多提供商配置
```bash
# 配置 Anthropic 官方 API
ccvm add
# 提供商名称: anthropic
# URL: https://api.anthropic.com
# 密钥: your-anthropic-key

# 配置自定义 API 服务
ccvm add  
# 提供商名称: custom
# URL: https://your-custom-api.com
# 密钥: your-custom-key

# 切换和使用不同提供商
ccvm use anthropic
claude "技术问题咨询"

ccvm use custom  
claude "使用自定义API的问题"
```

### 团队协作配置
```bash
# 查看当前配置
ccvm status --detailed

# 切换默认提供商
ccvm use anthropic

# 查看和管理备份
ccvm history
```

## 🏗️ 系统架构

```
CCVM (Claude Code Version Manager)
├── ConfigManager      # 系统配置管理
├── ProviderManager    # API提供商管理  
├── BackupManager      # 备份和恢复
└── AliasGenerator     # Shell别名生成
```

## ⚡ 技术实现

### 智能Claude函数集成
```bash
# CCVM重新定义了claude函数，实现无缝集成：
claude() {
    # 1. 动态加载CCVM环境变量
    eval "$(ccvm env 2>/dev/null)"
    
    # 2. 检查配置有效性
    if [ $? -ne 0 ]; then
        echo "❌ Failed to load CCVM configuration"
        return 1
    fi
    
    # 3. 调用原生Claude命令
    command claude "$@"
}
```

### 工作流程
1. 📡 `ccvm env` 输出当前provider的环境变量设置
2. 🔧 claude函数自动加载这些环境变量
3. 🚀 直接调用原生Claude CLI，传递所有参数
4. ✅ 完全透明的体验，无需额外配置

### 配置文件结构
```
~/.claude/ccvm/
├── config.json        # 系统配置
├── providers/         # 提供商配置
│   ├── anthropic.json
│   └── custom.json
└── backups/           # 自动备份
    └── 2024-01-20_10-30-45/
```

## 📚 详细文档

- **[快速开始指南](docs/quick-start.md)** - 5分钟完成安装和配置
- **[用户手册](docs/user-guide.md)** - 完整的功能说明和最佳实践
- **[使用示例](docs/examples.md)** - 各种实际使用场景
- **[常见问题](docs/faq.md)** - 问题解答和故障排除
- **[架构文档](CLAUDE.md)** - 开发者技术文档

## 🛠️ 开发者指南

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- jq (JSON 处理工具)

### 开发命令
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

### 项目结构
```
ccvm/
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

## 🔒 安全特性

- **权限控制** - API密钥文件使用600权限存储
- **安全验证** - HTTPS强制验证（本地和内网除外）
- **备份加密** - 自动备份包含完整性校验
- **环境隔离** - 动态加载配置，避免环境变量污染

## 🤝 贡献指南

我们欢迎所有形式的贡献！

1. **Fork** 项目仓库
2. **创建** 功能分支 (`git checkout -b feature/amazing-feature`)
3. **提交** 更改 (`git commit -m 'Add amazing feature'`)
4. **推送** 到分支 (`git push origin feature/amazing-feature`)
5. **创建** Pull Request

### 开发规范
- 遵循 ESLint 和 Prettier 代码规范
- 为新功能编写单元测试
- 更新相关文档
- 保持提交信息清晰明确

## 📊 项目统计

- **测试覆盖率**: 94%+
- **核心模块**: 4个管理器 + 工具函数
- **文档**: 完整的用户和开发者指南
- **安全**: 全面的验证和保护机制
- **性能**: 针对CLI使用模式优化

## 🌟 社区

- **GitHub Issues**: [报告问题或请求功能](https://github.com/kedoupi/ccvm/issues)
- **Discussions**: [加入社区讨论](https://github.com/kedoupi/ccvm/discussions)
- **文档**: [完整指南和示例](docs/)

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

感谢所有为项目做出贡献的开发者和社区成员！

---

<div align="center">

**Made with ❤️ by the Claude Code Kit community**

[⭐ Star us on GitHub](https://github.com/kedoupi/ccvm) | [🐛 报告问题](https://github.com/kedoupi/ccvm/issues) | [📖 阅读文档](docs/)

</div>