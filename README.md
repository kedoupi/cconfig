# CConfig

**Claude 配置管理工具（CConfig）** - 专注的 Claude API 配置管理工具

[![npm version](https://badge.fury.io/js/@kedoupi%2Fcconfig.svg)](https://badge.fury.io/js/@kedoupi%2Fcconfig)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📖 项目简介

CConfig 是一个专为 Claude API 设计的配置管理工具，让开发者能够轻松管理和切换不同的 Claude
API 配置，就像使用 Git 配置一样简单直观。

### 🎯 核心功能

- **🔧 Claude API 配置管理** - 添加、编辑、删除 API 配置
- **🔄 一键切换配置** - 快速在不同 API 提供商间切换
- **🔒 安全凭据存储** - API 密钥安全管理（类 Unix 上使用 600 权限）
- **🚀 Shell 集成** - 与现有工作流无缝集成

## 🚀 快速开始

### 安装

一键安装（面向使用者）

```bash
curl -fsSL https://github.com/kedoupi/cconfig/raw/main/install.sh | bash
```

- install.sh 会自动：检查 Node 环境、安装 `cconfig`、检测并安装 `claude`
  CLI、写入 Shell 集成（`claude()` 会先加载 `cconfig env`）。

手动安装（面向开发者）

```bash
git clone https://github.com/kedoupi/cconfig.git
cd cconfig
./setup.sh
```

- setup.sh 会：安装依赖、运行测试、检测并安装 `claude` CLI、把 `cconfig()` 和 `claude()`
  函数指向本仓库，方便开发调试。

### 基本使用

```bash
# 添加 Claude API 配置
cconfig add anthropic

# 查看所有配置
cconfig list

# 切换默认配置
cconfig use anthropic

# 直接使用 Claude
claude "你好，世界！"

# 输出当前环境变量（加载到 shell 使用）
eval "$(cconfig env)"
```

提示：如果尚未设置默认配置，首次添加的 Provider 会自动设为默认。

## 📋 命令参考

### 配置管理

```bash
cconfig add [alias]          # 添加新配置（交互式）
cconfig list                 # 列出所有配置
cconfig show <alias>         # 显示配置详情
cconfig edit <alias>         # 编辑现有配置
cconfig remove <alias>       # 删除配置
cconfig use [alias]          # 切换默认配置
```

### 系统状态

```bash
cconfig status               # 显示系统状态（配置目录、数量、默认项）
cconfig status --detailed    # 显示每个 provider 的详细信息
```

### 系统诊断

```bash
cconfig doctor               # 运行系统诊断并给出建议
cconfig doctor --fix         # 自动修复常见问题（如无效默认项、权限不安全）
```

诊断内容与规则说明：

- 默认项有效性
  - 规则：`config.json` 中的 `defaultProvider` 必须存在对应的 Provider 文件。
  - 修复：`--fix` 时自动清空无效默认项（不删除任何 Provider 文件）。

- Provider 文件权限（类 Unix）
  - 规则：`~/.cconfig/providers/*.json` 应为 `600` 权限（仅所有者读/写）。
  - 修复：`--fix` 时自动执行 `chmod 600`。

- 结构校验（每个 `providers/*.json`）
  - alias
    - 规则：必须匹配正则 `^[a-zA-Z0-9_-]{1,64}$`，且内容需与文件名一致（例如 `anthropic.json` 的
      `alias` 应为 `anthropic`）。
    - 修复：`--fix` 时若“仅与文件名不一致”，会自动将 `alias`
      同步为文件名；若格式非法，仅提示修复建议，不自动修改。
  - URL
    - 规则：必须为 `http://` 或 `https://` 的有效 URL（推荐公网地址使用 HTTPS，但非强制）。
    - 修复：不自动修改 URL；请使用 `cconfig edit <alias>` 手动修正。
  - API Key
    - 规则：必须为非空字符串。
    - 修复：不自动生成或修改；请使用 `cconfig edit <alias>` 手动更新。

示例：

```bash
# 仅检查并提示问题
cconfig doctor

# 自动修复可安全修复的问题（清空无效默认项、权限 600、alias 与文件名不一致）
cconfig doctor --fix
```

### 环境变量

```bash
cconfig env                  # 输出默认配置的环境变量
cconfig env --provider <alias>  # 输出指定配置的环境变量
cconfig env --shell fish     # 输出 fish shell 格式
```

### 说明

- 目前已实现的命令：`add`、`list`、`show`、`edit`、`remove`、`use`、`env`、`status`、`doctor`。
- `mcp` 为规划功能，尚未在此版本中提供。

#### 安全策略

- 建议在公网环境使用 HTTPS 保障安全；本工具不再强制限制 HTTP 使用场景。

## 💡 使用示例

### 添加自定义 API 配置

```bash
$ cconfig add custom-api
? API 端点 URL: https://api.custom.com
? API Key: sk-custom-key-123456789
✓ 配置 'custom-api' 添加成功！
```

### 查看和切换配置

```bash
$ cconfig list
┌─────────────┬──────────────────────────┬─────────┬─────────────┐
│    别名     │           URL            │  状态   │  最后使用   │
├─────────────┼──────────────────────────┼─────────┼─────────────┤
│ anthropic   │ https://api.anthropic.com│ 默认    │ 2小时前     │
│ custom-api  │ https://api.custom.com   │ 可用    │ 从未使用    │
└─────────────┴──────────────────────────┴─────────┴─────────────┘

$ cconfig use custom-api
✓ 默认配置已切换到 'custom-api'
```

### Shell 集成

```bash
# 加载配置到当前 shell
eval "$(cconfig env)"

# 使用特定配置
eval "$(cconfig env --provider custom-api)"
claude "使用自定义 API"

# 支持不同 shell 格式
eval "$(cconfig env --shell fish)"  # Fish shell
eval "$(cconfig env --shell zsh)"   # Zsh shell
```

## 🏗️ 配置文件结构

CConfig 将配置存储在 `~/.cconfig/` 目录：

```
~/.cconfig/
├── config.json              # 系统配置
└── providers/               # API 提供商配置
    ├── anthropic.json       # Anthropic 配置
    └── custom-api.json      # 自定义配置
```

### 🔄 从旧版本迁移

如果您之前使用的是旧版本（配置在 `~/.claude/cconfig/`），CConfig 会在首次运行时自动迁移您的配置到新位置 `~/.cconfig/`。迁移过程：

1. **自动检测**：检查旧配置目录是否存在
2. **安全迁移**：将所有配置文件复制到新位置
3. **保留备份**：旧配置目录保留，您可以手动删除

### 配置文件格式（示例）

```json
{
  "alias": "anthropic",
  "name": "Anthropic Claude API",
  "apiUrl": "https://api.anthropic.com",
  "apiKey": "sk-...",
  "timeout": 30000,
  "createdAt": "2025-09-11T...",
  "lastUsed": "2025-09-11T..."
}
```

## 🛠️ 开发

### 本地开发

```bash
# 克隆项目
git clone https://github.com/kedoupi/cconfig.git
cd cconfig

# 安装依赖
npm install

# 运行测试
npm test

# 本地测试
npm install -g .
cconfig --help
```

### CI 发布（GitHub Actions）

- 已内置 npm 自动发布：推送形如 `v1.0.0` 的 Git 标签即触发。
- 仓库需要配置 `NPM_TOKEN` 机密（npm automation token，具发布权限，免 2FA）。
- 操作步骤：
  - 在 npm 创建 automation token，并添加到 GitHub 仓库 Settings → Secrets → Actions → `NPM_TOKEN`
  - 确保 `package.json` 的 `version` 与标签一致
  - 打标签并推送：

```bash
git tag v1.0.0
git push origin v1.0.0
```

工作流文件：`.github/workflows/release.yml`

### 脚本命令

```bash
npm run test              # 运行测试
npm run test:coverage     # 测试覆盖率
npm run lint             # 代码检查
npm run lint:fix         # 自动修复
npm run format           # 代码格式化
```

## 📊 系统要求

- **Node.js**: >=18.0.0
- **操作系统**: macOS, Linux, Windows
- **权限**: 读写 `~/.cconfig/` 目录

## 🤝 贡献

欢迎贡献代码！请参考以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发指南

- 遵循现有代码风格
- 编写测试用例
- 更新相关文档
- 确保所有测试通过

## 📝 更新日志

### v1.0.0

- 初始公开发布（npm 包：`@kedoupi/cconfig`）
- 放宽 URL 校验：不再强制非本地/内网地址必须使用 HTTPS（仍要求 http/https 协议，推荐公网使用 HTTPS）
- 首个 Provider 自动设为默认：首次添加配置时自动写入 `defaultProvider` 并记录 `lastUsed`
- API Key 输入改为“掩码显示”（inquirer `mask: '*'`），避免完全不回显带来的困扰
- 安装脚本全中文化，并在“未配置 Provider”时提示执行 `cconfig add`
- 文档与提示统一中文，修正过时示例（去除无效的 dev-setup.sh 提示）

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🔗 相关链接

- [GitHub 仓库](https://github.com/kedoupi/cconfig)
- [npm 包](https://www.npmjs.com/package/@kedoupi/cconfig)
- [问题反馈](https://github.com/kedoupi/cconfig/issues)

---

**CConfig** - 让 Claude API 配置管理变得简单 ✨
