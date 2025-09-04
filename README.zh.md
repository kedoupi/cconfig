# CCVM - Claude 代码版本管理器

<div align="center">

```
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│  ██████  ██████ ██    ██ ███    ███                         │
│ ██      ██      ██    ██ ████  ████                         │
│ ██      ██      ██    ██ ██ ████ ██                         │
│ ██      ██      ██    ██ ██  ██  ██                         │
│  ██████  ██████  ██████  ██      ██                         │
│                                                             │
│                Claude 代码版本管理器                          │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
```

[![NPM Version](https://img.shields.io/npm/v/@kedoupi/ccvm.svg)](https://npmjs.org/package/@kedoupi/ccvm)
[![License](https://img.shields.io/npm/l/@kedoupi/ccvm.svg)](https://github.com/kedoupi/ccvm/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/@kedoupi/ccvm.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)](https://github.com/kedoupi/ccvm)
[![CI Status](https://img.shields.io/github/workflow/status/kedoupi/ccvm/CI)](https://github.com/kedoupi/ccvm/actions)

**🚀 Claude API 提供商版本管理器 - 像 nvm 管理 Claude**

*综合性的 Claude Code 配置管理工具包，提供多提供商 API 支持、安全凭据管理和自动化 Shell 集成。*

[中文](#中文文档) | [English](README.md) | [文档](docs/) | [示例](docs/examples.md) | [FAQ](docs/faq.md)

</div>

---

## 中文文档

### 📖 项目简介

CCVM（Claude Code Version Manager）是一个综合性的 Claude Code 配置管理工具包，提供多提供商 API 支持、安全凭据管理和自动化 Shell 集成。该项目使用户能够无缝配置和切换不同的 API 提供商（如不同的 Claude API 端点），类似于 nvm 管理 Node.js 版本的方式。

### ✨ 核心特性

- 🔧 **多提供商支持** - 轻松配置和切换多个 Claude API 提供商
- 🛡️ **安全凭据管理** - 安全存储和管理 API 密钥，支持权限控制
- 🚀 **一键安装配置** - 自动环境检测，智能安装和配置
- ⚡ **智能Claude集成** - 无缝集成原生Claude命令，自动环境变量配置
- 📦 **MCP服务管理** - 为 Claude Desktop 安装和管理模型上下文协议服务
- 📊 **使用统计分析** - 集成 ccusage 工具，全面分析 Claude Code 使用情况和成本估算
- 🔄 **自动备份恢复** - 配置变更自动备份，支持一键恢复
- 🩺 **系统诊断工具** - 全面的系统检查和问题诊断
- 🎯 **简洁设计理念** - 减少命令冗余，统一管理界面

### 🚀 快速开始

#### 安装方式

CCVM 可以通过在终端中运行以下命令之一来安装：

| 方式      | 命令                                                                                           |
| :-------- | :------------------------------------------------------------------------------------------------ |
| **curl**  | `curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash` |
| **wget**  | `wget -qO- https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash`   |

> **注意**: 安装脚本会智能检测您的环境，并自动备份现有配置。

#### 手动检查安装脚本

您可以在运行前手动检查安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh -o install.sh
# 检查脚本内容
cat install.sh
# 运行安装
bash install.sh
```

#### 开发模式安装

适用于贡献者和开发者：

```bash
git clone https://github.com/kedoupi/ccvm.git
cd ccvm
npm install
# 在项目目录下运行安装脚本，自动启用开发模式
./install.sh
```

#### 基础使用

1. **添加 API 提供商**
```bash
ccvm add
# 按提示输入：提供商名称、API地址、密钥等信息
```

2. **列出所有提供商**
```bash
ccvm list
```

3. **查看提供商详情**
```bash
ccvm show <别名>
```

4. **使用提供商**
```bash
# 设置默认提供商
ccvm use <别名>

# 使用claude命令（自动加载CCVM配置）
claude "你的问题"

# 例如：
claude "解释 React hooks"
claude "设计一个 REST API"
```

5. **系统状态检查**
```bash
ccvm status
ccvm doctor
```

6. **使用统计分析**
```bash
# 查看全面的使用统计信息
ccusage

# 每日使用报告
ccusage --daily

# 月度使用汇总  
ccusage --monthly

# 实时会话监控
ccusage --live
```

### 💡 使用示例

#### 多提供商配置
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

#### 团队协作配置
```bash
# 查看当前配置
ccvm status --detailed

# 切换默认提供商
ccvm use anthropic

# 查看和管理备份
ccvm history
```

#### MCP 服务管理
```bash
# Claude Code 的交互式 MCP 管理
ccvm mcp
# 选择 "📋 查看推荐 MCP 服务" 来浏览可用服务
# 选择 "➕ 安装 MCP 服务到 Claude Code" 进行安装
# 选择 "🔧 检查环境配置" 来诊断问题

# 推荐的 MCP 服务：
# - 文件系统 MCP：本地文件访问
# - 顺序思维：结构化推理
# - 内存银行：持久化内存存储
# - Docker MCP：容器管理

# 查看已安装的服务（Claude Code 原生命令）
claude mcp list
```

### 🏗️ 系统架构

```
CCVM (Claude Code Version Manager)
├── ConfigManager      # 系统配置管理
├── ProviderManager    # API提供商管理  
├── BackupManager      # 备份和恢复
├── AliasGenerator     # Shell别名生成
└── UpdateManager      # 配置模板更新
```

### ⚡ 技术实现

**智能Claude函数集成**
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

**工作流程**
1. 📡 `ccvm env` 输出当前provider的环境变量设置
2. 🔧 claude函数自动加载这些环境变量
3. 🚀 直接调用原生Claude CLI，传递所有参数
4. ✅ 完全透明的体验，无需额外配置

**配置文件结构**
```
~/.claude/ccvm/
├── config.json        # 系统配置
├── history.json       # 操作历史
├── providers/         # 提供商配置
│   ├── anthropic.json
│   └── custom.json
└── backups/           # 自动备份
    └── 2025-08-26_10-30-45/
```

### 📚 CLI 命令参考

| 命令 | 描述 | 示例 |
|---------|-------------|---------|
| `ccvm add` | 添加新提供商（交互式） | `ccvm add` |
| `ccvm list` | 列出所有提供商 | `ccvm list` |
| `ccvm show <别名>` | 显示提供商详情 | `ccvm show anthropic` |
| `ccvm edit <别名>` | 编辑提供商配置 | `ccvm edit custom` |
| `ccvm remove <别名>` | 移除提供商 | `ccvm remove old-provider` |
| `ccvm use [别名]` | 设置/选择默认提供商 | `ccvm use anthropic` |
| `ccvm env [--shell <shell>]` | 输出环境变量 | `ccvm env --shell bash` |
| `ccvm exec` | 使用当前配置执行claude | `ccvm exec "hello world"` |
| `ccvm update [--force]` | 更新配置模板 | `ccvm update --force` |
| `ccvm history` | 查看/恢复配置备份 | `ccvm history` |
| `ccvm status [--detailed]` | 显示系统状态 | `ccvm status --detailed` |
| `ccvm doctor [--fix]` | 运行系统诊断 | `ccvm doctor --fix` |
| `ccvm mcp` | 管理 Claude Code 的 MCP 服务 | `ccvm mcp` |

### 🛠️ 开发指南

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
npm run test:integration

# 代码质量检查
npm run lint
npm run lint:fix
npm run format

# 预打包检查
npm run prepack
```

#### 项目结构
```
ccvm/
├── src/                # 源代码
│   ├── core/          # 核心管理器
│   │   ├── ConfigManager.js
│   │   ├── ProviderManager.js
│   │   ├── BackupManager.js
│   │   ├── AliasGenerator.js
│   │   └── UpdateManager.js
│   └── utils/         # 工具函数
│       ├── banner.js  # ASCII艺术和横幅
│       ├── errorHandler.js
│       └── logger.js
├── bin/               # CLI入口点
├── tests/             # 测试文件
│   ├── unit/          # 单元测试
│   ├── integration/   # 集成测试
│   └── helpers/       # 测试工具
├── tools/             # 开发工具
├── docs/              # 文档
└── install.sh         # 安装脚本
```

### 🔒 安全特性

- **权限控制** - API密钥文件使用600权限存储
- **安全验证** - HTTPS强制验证（本地和内网除外）
- **备份加密** - 自动备份包含完整性校验
- **环境隔离** - 动态加载配置，避免环境变量污染
- **输入清理** - 对用户输入进行全面验证和清理

### 🧪 测试

项目通过全面的测试策略保持高测试覆盖率：

- **单元测试** - 使用 Jest 进行单个组件测试
- **集成测试** - 完整的 CLI 命令测试
- **覆盖率报告** - 所有指标最低70%覆盖率
- **测试工具** - 共享的固件和测试助手

运行测试：
```bash
npm test                    # 运行所有单元测试
npm run test:coverage      # 运行并生成覆盖率报告
npm run test:integration   # 运行集成测试
npm run test:watch         # 开发模式监视测试
```

### 🤝 贡献指南

我们欢迎所有形式的贡献！请查看我们的[贡献指南](CONTRIBUTING.md)了解详情。

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

### 📊 项目统计

- **测试覆盖率**: 94%+
- **核心模块**: 5个管理器 + 工具函数
- **文档**: 完整的用户和开发者指南
- **安全**: 全面的验证和保护机制
- **性能**: 针对CLI使用模式优化

### 🌟 社区

- **GitHub Issues**: [报告问题或请求功能](https://github.com/kedoupi/ccvm/issues)
- **Discussions**: [加入社区讨论](https://github.com/kedoupi/ccvm/discussions)
- **文档**: [完整指南和示例](docs/)

### 🎯 发展路线图

- [ ] **插件系统** - 支持自定义提供商的可扩展架构
- [ ] **配置同步** - 团队环境的云端同步功能
- [ ] **高级日志** - 增强的调试和监控能力
- [ ] **图形界面** - 可选的配置管理图形界面
- [ ] **Docker集成** - 基于容器的部署选项

### 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

### 🙏 致谢

感谢所有为项目做出贡献的开发者和社区成员！

---

<div align="center">

**Made with ❤️ by the Claude Code Kit community**

[⭐ 在GitHub上给我们Star](https://github.com/kedoupi/ccvm) | [🐛 报告问题](https://github.com/kedoupi/ccvm/issues) | [📖 阅读文档](docs/)

</div>