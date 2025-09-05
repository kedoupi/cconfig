# MCP (Model Context Protocol) 管理指南

## 概述

MCP (Model Context Protocol) 是一个开放标准，让 Claude Code 能够连接到各种数据源和工具。CCVM 提供了简单的 MCP 服务管理功能，帮助您轻松安装和配置推荐的 MCP 服务到 Claude Code 中。

## 预置 MCP 服务

CCVM 默认提供以下精选的 MCP 服务：

| 服务名称 | 描述 | 需要配置 |
|---------|------|---------|
| **Filesystem MCP** ⭐ | 让 Claude 读写本地文件和目录 | 否 |
| **Sequential Thinking MCP** ⭐ | 帮助 Claude 进行结构化思考和推理 | 否 |
| **Memory Bank MCP** ⭐ | 为 Claude 提供多项目持久化记忆存储 | 是（根目录路径） |
| **Docker MCP** ⭐ | 管理 Docker 容器和镜像 | 否（需要 Python/UV） |

## 使用方法

### 交互式管理

```bash
ccvm mcp
```

进入交互式管理界面，提供以下功能：

1. **📋 查看推荐 MCP 服务** - 显示推荐服务列表
2. **➕ 安装 MCP 服务到 Claude Code** - 选择并安装新服务
3. **➖ 从 Claude Code 移除 MCP 服务** - 移除已安装的服务
4. **🔍 查看已安装的 MCP 服务** - 运行 `claude mcp list` 查看详情
5. **🔧 检查环境配置** - 诊断系统环境

### 安装 MCP 服务

通过交互式菜单安装：

1. 运行 `ccvm mcp`
2. 选择 "➕ 安装 MCP 服务到 Claude Code"
3. 使用空格键选择要安装的服务
4. 选择安装作用域：
   - **用户级别 (User)** - 所有项目可用（推荐）
   - **项目级别 (Project)** - 仅当前项目，可共享给团队
   - **本地级别 (Local)** - 仅当前项目，私有配置
5. 如果服务需要配置，按提示输入相关信息

示例：安装 Filesystem MCP
```
📦 安装 Filesystem MCP 到 user 作用域...
安装 @modelcontextprotocol/server-filesystem... ✓
执行: claude mcp add --user filesystem npx -y @modelcontextprotocol/server-filesystem
✅ Filesystem MCP 已添加到 Claude Code
```

### MCP 作用域说明

Claude Code 支持三种 MCP 配置作用域：

1. **Local Scope（本地）**
   - 默认作用域
   - 配置私有，不会提交到版本控制
   - 适合个人或敏感配置

2. **Project Scope（项目）**
   - 存储在项目根目录的 `.mcp.json` 文件
   - 可以提交到版本控制，与团队共享
   - 使用前需要用户确认

3. **User Scope（用户）**
   - 跨所有项目可用
   - 适合常用工具和个人服务
   - CCVM 推荐使用此作用域

配置项说明：

- **Memory Bank MCP**
  - `MEMORY_BANK_ROOT`: 记忆银行根目录路径（默认：.claude/memory-banks）
  - 该目录基于项目级别，每个项目有独立的记忆存储空间

- **Docker MCP**
  - 基于 Python 实现，需要先安装 UV 包管理器
  - 安装 UV: `curl -LsSf https://astral.sh/uv/install.sh | sh`
  - 不需要额外配置，自动检测本地 Docker 环境

### 检查环境配置

```bash
ccvm mcp
```
然后选择 "🔧 检查环境配置"

检查项包括：
- Claude Code 是否安装
- Node.js 和 npm 版本
- 已安装的 MCP 服务数量

### 查看已安装的服务

使用 Claude Code 原生命令：
```bash
claude mcp list
```

或通过 CCVM 菜单选择 "🔍 查看已安装的 MCP 服务"

## Claude Code MCP 命令

Claude Code 提供了原生的 MCP 管理命令：

```bash
# 添加本地 stdio 服务器
claude mcp add server-name /path/to/server

# 添加远程 SSE 服务器
claude mcp add --transport sse server-name https://url

# 添加到不同作用域
claude mcp add --user server-name /path/to/server     # 用户级
claude mcp add --project server-name /path/to/server  # 项目级

# 查看已安装的服务
claude mcp list

# 获取服务详情
claude mcp get server-name

# 移除服务
claude mcp remove server-name
```

## 注意事项

1. **Claude Code 依赖**：需要先安装 Claude Code CLI：
   ```bash
   npm install -g @anthropic/claude-code
   ```

2. **权限要求**：某些 MCP 服务（如 Filesystem）需要您在使用时明确授权每个操作。

3. **Node.js 依赖**：MCP 服务需要 Node.js 环境，CCVM 会自动使用 `npx` 运行服务。

4. **作用域选择**：
   - 个人使用推荐 User 作用域
   - 团队协作推荐 Project 作用域
   - 敏感配置使用 Local 作用域

## 故障排除

如果 MCP 服务无法正常工作：

1. 运行 `ccvm mcp` → "🔧 检查环境配置" 诊断问题
2. 确保 Claude Code 已正确安装：`claude --version`
3. 检查 Node.js 是否正确安装：`node --version`
4. 使用 `claude mcp list` 验证服务是否已添加
5. 查看 Claude Code 的调试输出了解详细错误信息

## 扩展功能（未来计划）

- 支持更多 MCP 服务
- 自定义 MCP 服务添加
- MCP 服务版本管理
- 配置组（开发/生产环境）
- MCP 服务依赖管理