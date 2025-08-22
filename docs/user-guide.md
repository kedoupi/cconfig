# Claude Code Kit 用户手册

## 📋 目录

- [项目概述](#项目概述)
- [安装指南](#安装指南)
- [命令参考](#命令参考)
- [配置管理](#配置管理)
- [提供商管理](#提供商管理)
- [备份与恢复](#备份与恢复)
- [安全最佳实践](#安全最佳实践)
- [故障排除](#故障排除)
- [高级功能](#高级功能)

## 项目概述

### 什么是 Claude Code Kit？

Claude Code Kit 是一个综合性的配置工具包，专为 Claude Code 用户设计。它提供：

- **多提供商支持**: 轻松配置和切换不同的 API 提供商
- **安全凭据管理**: 安全存储和管理 API 密钥
- **自动备份**: 自动备份配置，支持一键恢复  
- **无缝设置**: 简化的安装和配置流程
- **智能诊断**: 完善的系统健康检查

### 核心概念

#### 提供商 (Provider)
一个提供商是一组完整的 API 配置，包括：
- **别名 (Alias)**: 用于调用的命令名称
- **Base URL**: API 服务的基础地址
- **API Key**: 认证密钥
- **超时设置**: 请求超时时间

#### 配置目录结构
```
~/.cc-config/                # 主配置目录
├── providers/              # 提供商配置
│   ├── claude-main.json    # 示例提供商配置
│   └── claude-work.json    
├── backups/               # 自动备份
│   ├── 20241201-120000/   # 按时间戳命名的备份
│   └── 20241201-150000/   
├── aliases.sh             # 自动生成的别名脚本
└── config.json           # 全局配置

~/.claude/                 # Claude Code 配置目录
├── config                # Claude Code 主配置
└── templates/            # 配置模板
```

## 安装指南

### 系统要求

| 组件 | 要求 | 说明 |
|------|------|------|
| 操作系统 | macOS 10.15+ 或 Linux | Windows 通过 WSL 支持 |
| Shell | bash 4.0+ 或 zsh 5.0+ | 用于别名支持 |
| Node.js | 18.0+ (推荐 22+) | 自动安装 |
| 网络 | 稳定互联网连接 | 用于下载依赖 |

### 详细安装步骤

#### 方法一：一键安装脚本

```bash
# 下载并运行安装脚本
curl -fsSL https://raw.githubusercontent.com/claude-code-kit/claude-code-kit/main/install.sh | bash

# 安装特定版本
curl -fsSL https://raw.githubusercontent.com/claude-code-kit/claude-code-kit/main/install.sh | bash -s -- --version=1.0.0
```

#### 方法二：从源码安装

```bash
# 克隆仓库
git clone https://github.com/claude-code-kit/claude-code-kit.git
cd claude-code-kit

# 安装依赖
npm install

# 创建全局链接
npm link

# 验证安装
cc-config --version
```

#### 方法三：npm 安装

```bash
# 全局安装
npm install -g @kedoupi/claude-code-kit

# 或指定版本
npm install -g @kedoupi/claude-code-kit@1.0.0
```

### 安装验证

```bash
# 1. 检查版本
cc-config --version

# 2. 运行系统诊断
cc-config doctor

# 3. 查看帮助
cc-config --help
```

## 命令参考

### 主命令: cc-config

```bash
cc-config [command] [options]
```

### 全局选项

| 选项 | 描述 |
|------|------|
| `--version` | 显示版本信息 |
| `--help` | 显示帮助信息 |

### 提供商管理命令

#### `cc-config provider`

提供商管理的主命令，包含以下子命令：

##### `provider add` - 添加新提供商

```bash
cc-config provider add
```

**交互式配置流程:**
1. **Provider alias**: 输入命令别名（如 `claude-main`）
2. **API Base URL**: 输入 API 基础地址（默认: `https://api.anthropic.com`）
3. **API Key**: 输入 API 密钥（静默输入）
4. **Request timeout**: 设置超时时间（默认: `3000000`ms）

**示例:**
```bash
$ cc-config provider add
📡 Add New API Provider

? Provider alias (command name): my-claude
? API Base URL: https://api.anthropic.com
? API Key: [Hidden]
? Request timeout (ms): 3000000

✅ Provider 'my-claude' added successfully!
```

##### `provider list` - 列出所有提供商

```bash
cc-config provider list
```

**输出示例:**
```
📡 Configured API Providers

Alias           Base URL                        Status
──────────────────────────────────────────────────────────
claude-main     https://api.anthropic.com       ✓ Active
claude-work     https://api.anthropic.com       ✓ Active

💡 Total: 2 provider(s) configured
```

##### `provider show <alias>` - 显示提供商详情

```bash
cc-config provider show claude-main
```

**输出示例:**
```
📡 Provider Information: claude-main

Configuration:
  Alias: claude-main
  Base URL: https://api.anthropic.com
  Timeout: 3000000ms
  Created: 2024-12-01T12:00:00Z
  Last Used: 2024-12-01T15:30:00Z

Usage:
  claude-main "your message"               # Use this provider
  cc-config provider edit claude-main      # Edit this provider
```

##### `provider edit <alias>` - 编辑提供商

```bash
cc-config provider edit claude-main
```

**说明:** 允许修改除别名外的所有配置。API Key 可选择保持不变。

##### `provider remove <alias>` - 删除提供商

```bash
cc-config provider remove claude-main
```

**安全提示:** 需要确认操作，删除后会自动更新别名脚本。

##### `provider use [alias]` - 设置默认提供商

```bash
# 交互式选择（多提供商时）
cc-config provider use

# 直接指定
cc-config provider use claude-main
```

### 系统管理命令

#### `cc-config status` - 系统状态

```bash
# 基础状态
cc-config status

# 详细状态
cc-config status --detailed
```

**详细状态输出包括:**
- 系统信息（版本、Node.js、平台）
- 配置信息（提供商数量、备份数量）
- 目录状态（配置目录是否存在）
- 提供商详情（使用 --detailed）
- 备份统计（使用 --detailed）

#### `cc-config doctor` - 系统诊断

```bash
# 基础诊断
cc-config doctor

# 自动修复问题
cc-config doctor --fix
```

**诊断内容包括:**
- Node.js 环境检查
- 依赖项检查（jq, claude）
- 文件系统权限检查
- 配置状态验证
- 提供商连接测试
- 别名脚本状态
- 备份完整性检查

#### `cc-config update` - 更新配置

```bash
# 交互式更新
cc-config update

# 强制更新
cc-config update --force
```

**更新流程:**
1. 创建当前配置备份
2. 下载最新配置模板
3. 保持用户提供商配置不变
4. 重新生成别名脚本

#### `cc-config history` - 备份历史

```bash
cc-config history
```

**功能:**
- 显示所有可用备份
- 交互式选择恢复点
- 安全恢复配置

## 配置管理

### 配置文件结构

#### 全局配置 (`~/.cc-config/config.json`)

```json
{
  "version": "1.0.0",
  "initialized": true,
  "features": {
    "autoBackup": true,
    "validateConfigs": true,
    "enableAliases": true
  },
  "settings": {
    "backupRetention": 10,
    "defaultTimeout": 3000000,
    "maxProviders": 50
  }
}
```

#### 提供商配置示例

```json
{
  "alias": "claude-main",
  "baseURL": "https://api.anthropic.com",
  "apiKey": "sk-ant-...",
  "timeout": 3000000,
  "created": "2024-12-01T12:00:00Z",
  "lastUsed": "2024-12-01T15:30:00Z",
  "metadata": {
    "description": "主要的Claude配置",
    "tags": ["default", "production"]
  }
}
```

### 自定义配置

#### 修改全局设置

```bash
# 手动编辑配置文件
nano ~/.cc-config/config.json

# 修改后重新生成别名
cc-config doctor --fix
```

#### 环境变量支持

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `CC_CONFIG_DIR` | 配置目录 | `~/.cc-config` |
| `CC_DEBUG` | 调试模式 | `false` |
| `CC_BACKUP_RETENTION` | 备份保留数量 | `10` |

使用示例:
```bash
export CC_DEBUG=true
cc-config doctor
```

## 提供商管理

### 提供商配置最佳实践

#### 1. 命名规范

```bash
# 推荐的命名模式
claude-main      # 主要配置
claude-work      # 工作配置  
claude-dev       # 开发配置
claude-team      # 团队配置
```

#### 2. 多环境配置

```bash
# 开发环境
cc-config provider add
# alias: claude-dev
# url: https://api.anthropic.com

# 生产环境
cc-config provider add  
# alias: claude-prod
# url: https://api.anthropic.com
# 使用不同的 API Key
```

#### 3. 团队共享配置

对于团队使用，可以共享配置模板：

```bash
# 导出配置（去除敏感信息）
jq 'del(.apiKey)' ~/.cc-config/providers/claude-main.json > claude-template.json

# 团队成员导入并添加自己的 API Key
cp claude-template.json ~/.cc-config/providers/claude-main.json
# 然后编辑添加 API Key
cc-config provider edit claude-main
```

### 提供商测试

#### 连接测试

```bash
# 通过 doctor 命令测试所有提供商
cc-config doctor

# 手动测试特定提供商
claude-main "测试连接"
```

#### 性能测试

```bash
# 测试响应时间
time claude-main "简单问题"

# 测试超时设置
claude-main "复杂问题需要较长时间处理..."
```

## 备份与恢复

### 自动备份机制

系统在以下情况自动创建备份：
- 更新配置前
- 删除提供商前
- 运行 `cc-config update` 前

### 手动备份管理

#### 创建备份

```bash
# 通过更新触发备份
cc-config update

# 手动触发（通过删除一个不存在的提供商）
cc-config provider remove non-existent 2>/dev/null || true
```

#### 查看备份

```bash
# 列出所有备份
cc-config history

# 查看备份详情
ls -la ~/.cc-config/backups/
```

#### 恢复备份

```bash
# 交互式恢复
cc-config history
# 从列表中选择要恢复的备份

# 手动恢复（高级用户）
cp -r ~/.cc-config/backups/20241201-120000/* ~/.claude/
cc-config doctor --fix
```

### 备份验证

```bash
# 验证备份完整性
cc-config doctor

# 检查特定备份
ls -la ~/.cc-config/backups/20241201-120000/
```

## 安全最佳实践

### API 密钥安全

#### 1. 文件权限

确保配置文件具有正确的权限：

```bash
# 检查权限
ls -la ~/.cc-config/providers/

# 设置正确权限（如果需要）
chmod 600 ~/.cc-config/providers/*.json
chmod 700 ~/.cc-config/
```

#### 2. 环境隔离

```bash
# 为不同项目使用不同的提供商
# 项目A
cd /path/to/project-a
claude-project-a "项目相关问题"

# 项目B  
cd /path/to/project-b
claude-project-b "项目相关问题"
```

#### 3. 密钥轮换

定期轮换 API 密钥：

```bash
# 更新 API 密钥
cc-config provider edit claude-main
# 输入新的 API 密钥

# 测试新密钥
claude-main "测试新密钥"
```

### 备份安全

#### 1. 备份加密

对于敏感环境，考虑加密备份：

```bash
# 创建加密备份
tar -czf - ~/.cc-config/backups/ | gpg -c > cc-config-backup.tar.gz.gpg

# 恢复加密备份
gpg -d cc-config-backup.tar.gz.gpg | tar -xzf -
```

#### 2. 远程备份

```bash
# 同步备份到远程（去除敏感信息）
rsync -av --exclude="*.json" ~/.cc-config/backups/ user@remote-server:~/cc-config-backups/
```

## 故障排除

### 常见问题

#### 1. 安装问题

**问题**: 安装脚本失败
```bash
# 解决方案
# 检查网络连接
curl -I https://api.github.com

# 手动安装 Node.js
curl -fsSL https://nodejs.org/dist/v22.0.0/node-v22.0.0-linux-x64.tar.xz | tar -xJ
export PATH=$PWD/node-v22.0.0-linux-x64/bin:$PATH

# 重新尝试安装
npm install -g @kedoupi/claude-code-kit
```

**问题**: 权限不足
```bash
# 解决方案
# 使用用户目录安装
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm install -g @kedoupi/claude-code-kit
```

#### 2. 配置问题

**问题**: 别名不工作
```bash
# 解决方案
# 检查 aliases.sh 是否存在
ls -la ~/.cc-config/aliases.sh

# 重新生成别名
cc-config doctor --fix

# 手动加载别名
source ~/.cc-config/aliases.sh

# 添加到 shell 配置
echo "source ~/.cc-config/aliases.sh" >> ~/.zshrc
```

**问题**: 提供商连接失败
```bash
# 解决方案
# 检查网络连接
ping api.anthropic.com

# 验证 API 密钥
curl -H "Authorization: Bearer $API_KEY" https://api.anthropic.com/v1/messages

# 更新提供商配置
cc-config provider edit claude-main
```

#### 3. 性能问题

**问题**: 响应慢
```bash
# 解决方案
# 调整超时设置
cc-config provider edit claude-main
# 增加 timeout 值

# 检查网络延迟
ping api.anthropic.com
```

### 诊断工具

#### 系统诊断

```bash
# 完整诊断
cc-config doctor

# 详细状态
cc-config status --detailed

# 调试模式
CC_DEBUG=true cc-config doctor
```

#### 日志分析

```bash
# 查看错误日志
tail -f ~/.cc-config/logs/error.log

# 查看访问日志
tail -f ~/.cc-config/logs/access.log
```

### 获取帮助

#### 1. 内置帮助

```bash
# 主命令帮助
cc-config --help

# 子命令帮助
cc-config provider --help
cc-config provider add --help
```

#### 2. 在线资源

- [GitHub Issues](https://github.com/claude-code-kit/claude-code-kit/issues)
- [文档站点](https://claude-code-kit.github.io/docs/)
- [社区讨论](https://github.com/claude-code-kit/claude-code-kit/discussions)

#### 3. 提交 Bug 报告

```bash
# 收集诊断信息
cc-config doctor > diagnostic-report.txt
cc-config status --detailed >> diagnostic-report.txt

# 包含系统信息
uname -a >> diagnostic-report.txt
node --version >> diagnostic-report.txt
```

## 高级功能

### 脚本集成

#### 在脚本中使用

```bash
#!/bin/bash

# 脚本中使用特定提供商
response=$(claude-work "分析这个代码文件" < code.js)
echo "分析结果: $response"

# 错误处理
if ! claude-main "测试连接" >/dev/null 2>&1; then
    echo "提供商连接失败"
    exit 1
fi
```

#### 批量操作

```bash
# 批量测试所有提供商
for provider in $(cc-config provider list --format=json | jq -r '.[].alias'); do
    echo "测试提供商: $provider"
    $provider "Hello" || echo "  ✗ 失败"
done
```

### 配置模板

#### 创建配置模板

```bash
# 导出配置模板
mkdir -p ~/claude-templates
jq 'del(.apiKey)' ~/.cc-config/providers/claude-main.json > ~/claude-templates/default.json
```

#### 使用配置模板

```bash
# 从模板创建新配置
cp ~/claude-templates/default.json ~/.cc-config/providers/claude-new.json
# 编辑添加 API 密钥
cc-config provider edit claude-new
```

### 监控和统计

#### 使用统计

```bash
# 查看提供商使用情况
cc-config provider list --stats

# 查看备份统计
cc-config status --detailed
```

#### 性能监控

```bash
# 添加性能监控脚本
cat > ~/.cc-config/monitor.sh << 'EOF'
#!/bin/bash
while true; do
    start_time=$(date +%s%N)
    claude-main "ping" > /dev/null 2>&1
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    echo "$(date): ${duration}ms" >> ~/.cc-config/logs/performance.log
    sleep 60
done
EOF

chmod +x ~/.cc-config/monitor.sh
```

---

本用户手册涵盖了 Claude Code Kit 的所有主要功能。如果您需要更多信息，请查看：

- [快速开始指南](quick-start.md) - 5分钟快速上手
- [使用示例](examples.md) - 实际使用场景示例  
- [FAQ](faq.md) - 常见问题解答

如有其他问题，请在 [GitHub](https://github.com/claude-code-kit/claude-code-kit/issues) 上提交 issue。