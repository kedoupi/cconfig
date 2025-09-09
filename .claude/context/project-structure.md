---
created: 2025-09-06
version: 1.0.0
author: Claude (context-creation)
---

# 项目结构和组件组织

## 根目录结构

```
ccvm/
├── bin/                    # 可执行文件
├── src/                    # 源代码
├── tests/                  # 测试文件
├── tools/                  # 工具脚本
├── claude-templates/       # Claude Code 模板
├── .claude/               # Claude Code 配置
├── node_modules/          # 依赖包
├── package.json           # 项目配置
├── jest.config.js         # Jest 配置
├── install.sh            # 安装脚本
├── CLAUDE.md             # 项目指令
└── README.md             # 项目说明
```

## 核心源码结构 (src/)

### 核心管理器 (src/core/)
```
src/core/
├── ConfigManager.js      # 系统配置管理器
├── ProviderManager.js    # API 提供商管理器
└── MCPManager.js        # MCP 服务管理器
```

**职责分工**：
- **ConfigManager**: 全局系统配置、初始化、验证
- **ProviderManager**: API 提供商 CRUD 操作、安全验证
- **MCPManager**: MCP 服务的交互式管理和配置

### 工具库 (src/utils/)
```
src/utils/
├── FileUtils.js         # 文件操作工具
├── Validator.js         # 输入验证工具
├── LockManager.js       # 文件锁管理器
├── ResourceManager.js   # 资源管理器
├── errorHandler.js      # 错误处理器
├── logger.js           # 日志记录器
├── banner.js           # 品牌展示工具
└── errorCodes.js       # 错误代码定义
```

## 可执行文件结构 (bin/)

```
bin/
└── ccvm.js             # 主要 CLI 入口点
```

**命令结构**：
```javascript
ccvm
├── add                 # 添加新提供商 (交互式)
├── list               # 列出所有提供商
├── show <alias>       # 显示提供商详情
├── edit <alias>       # 编辑提供商配置
├── remove <alias>     # 删除提供商
├── use [alias]        # 设置/选择默认提供商
├── env [options]      # 输出环境变量
├── status [--detailed] # 显示系统状态
├── doctor [--fix]     # 运行系统诊断
└── mcp               # 管理 MCP 服务
```

## 测试架构 (tests/)

### 单元测试 (tests/unit/)
```
tests/unit/
├── bin/                   # CLI 测试
│   ├── ccvm.test.js
│   └── ccvm-commands.test.js
├── core/                  # 核心模块测试
│   ├── MCPManager.test.js
│   └── ProviderManager.test.js
└── utils/                 # 工具测试
    ├── FileUtils.test.js
    ├── Logger.test.js
    ├── Validator.test.js
    ├── banner.test.js
    └── errorHandler.test.js
```

### 集成测试 (tests/integration/)
```
tests/integration/
├── cli.test.js                      # CLI 集成测试
├── commands.test.js                 # 命令集成测试
└── claude-temp-provider.test.js     # 临时提供商测试
```

### 测试工具 (tests/helpers/ & tests/performance/)
```
tests/
├── helpers/
│   ├── testUtils.js              # 测试工具函数
│   └── TestEnvironmentManager.js # 测试环境管理
└── performance/
    └── benchmark.js              # 性能基准测试
```

## 工具脚本 (tools/)

```
tools/
├── integration-test.js    # 集成测试执行器
└── scripts/
    └── test-security.js   # 安全测试脚本
```

## 文档结构 (docs/)

```
docs/
├── mcp-guide.md          # MCP 服务指南
└── specs/                # 功能规格文档
    └── temporary-provider-switching/
        ├── requirements.md   # 需求文档
        ├── design.md        # 设计文档
        └── tasks.md         # 任务分解
```

## Claude Code 集成 (.claude/ & claude-templates/)

### 模板结构 (claude-templates/)
```
claude-templates/
├── agents/               # 智能体模板
│   ├── architect.md
│   ├── backend-dev.md
│   ├── code-fixer.md
│   ├── debugger.md
│   ├── dependency-manager.md
│   ├── developer.md
│   ├── doc-writer.md
│   ├── frontend-dev.md
│   ├── planner.md
│   ├── reviewer.md
│   └── test-runner.md
├── commands/            # 命令模板
│   ├── ask.md
│   ├── clean-project.md
│   ├── commit.md
│   ├── docs.md
│   ├── gemini.md
│   ├── specs.md
│   ├── test.md
│   └── think.md
└── output-styles/       # 输出样式模板
    ├── frontend-developer.md
    ├── gemini-code-review.md
    └── ui-ux-designer.md
```

### 上下文管理 (.claude/context/)
```
.claude/context/
├── project-overview.md      # 项目概览 (本文件)
├── tech-context.md         # 技术上下文
├── project-structure.md    # 项目结构 (当前文件)
├── development-context.md  # 开发上下文
├── progress.md            # 进展追踪
└── decisions.md           # 技术决策记录
```

## 配置文件层次

### 项目级配置
```
项目根目录/
├── package.json          # npm 包配置
├── jest.config.js        # Jest 测试配置
├── .gitignore           # Git 忽略规则
└── CLAUDE.md            # Claude Code 项目指令
```

### 用户级配置
```
~/.claude/ccvm/          # 用户配置目录
├── config.json          # 系统配置
├── history.json         # 操作历史
└── providers/           # 提供商配置
    ├── anthropic.json   # Anthropic 配置
    └── custom.json      # 自定义配置
```

## 依赖关系图

### 核心模块依赖
```
bin/ccvm.js
├── src/core/ConfigManager.js
├── src/core/ProviderManager.js
├── src/core/MCPManager.js
└── src/utils/*
```

### 工具模块依赖
```
src/core/* 模块
├── src/utils/FileUtils.js
├── src/utils/Validator.js
├── src/utils/LockManager.js
├── src/utils/errorHandler.js
└── src/utils/logger.js
```

## 数据流向

### 配置管理流向
```
用户输入 → CLI 解析 → 核心管理器 → 文件系统 → 配置存储
```

### 环境变量流向
```
ccvm env → ProviderManager → 环境变量输出 → Shell 加载 → claude 命令
```

### MCP 服务流向
```
ccvm mcp → MCPManager → Claude Code 配置 → MCP 服务激活
```

## 扩展点和接口

### 插件接口
- **Provider 插件**: 新的 API 提供商支持
- **MCP 服务插件**: 自定义 MCP 服务集成
- **命令插件**: 自定义 CLI 命令扩展

### 配置接口
- **Provider 配置模式**: 标准化的提供商配置格式
- **MCP 服务配置**: 统一的服务配置接口
- **系统配置扩展**: 可扩展的系统级配置

## 文件命名约定

### 源代码文件
- **PascalCase**: 类文件 (ConfigManager.js)
- **camelCase**: 工具文件 (errorHandler.js)
- **kebab-case**: 测试文件 (ccvm-commands.test.js)

### 配置文件
- **小写**: 系统配置 (config.json)
- **kebab-case**: 复合名称 (mcp-guide.md)
- **UPPERCASE**: 特殊文件 (CLAUDE.md, README.md)