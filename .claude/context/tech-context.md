---
created: 2025-09-06
version: 1.0.0
author: Claude (context-creation)
---

# 技术上下文和架构

## 技术栈概览

### 运行环境
- **Node.js**: >=18.0.0
- **平台支持**: macOS, Linux, Windows
- **包管理**: npm

### 核心依赖
- **CLI 框架**: Commander.js v11.1.0
- **文件系统**: fs-extra v11.2.0
- **用户交互**: Inquirer.js v8.2.7
- **终端样式**: Chalk v4.1.2
- **表格显示**: cli-table3 v0.6.5
- **加载动画**: Ora v5.4.1

### 开发工具
- **测试框架**: Jest v29.7.0
- **代码检查**: ESLint v8.57.0
- **代码格式化**: Prettier v3.1.1
- **Git 钩子**: Husky v8.0.3
- **文档生成**: JSDoc v4.0.2

## 架构设计

### 核心架构原则
- **模块化设计**: 功能分离，职责清晰
- **安全第一**: API 密钥安全存储和传输
- **用户体验**: 直观的 CLI 界面和交互设计
- **扩展性**: 支持插件和自定义扩展

### 三层架构

#### 1. CLI 层 (bin/ccvm.js)
```
CLI Interface
├── Command Parsing (Commander.js)
├── Interactive Prompts (Inquirer.js)
├── Output Formatting (Chalk, cli-table3)
└── Error Handling
```

#### 2. 业务逻辑层 (src/core/)
```
Core Managers
├── ConfigManager.js    # 系统配置管理
├── ProviderManager.js  # API 提供商管理
└── MCPManager.js      # MCP 服务管理
```

#### 3. 工具层 (src/utils/)
```
Utilities
├── FileUtils.js        # 文件操作工具
├── Validator.js        # 输入验证工具
├── LockManager.js      # 文件锁管理
├── ResourceManager.js  # 资源管理器
├── errorHandler.js     # 错误处理器
├── logger.js          # 日志记录器
└── banner.js          # 品牌展示
```

## 数据存储架构

### 配置文件结构
```
~/.claude/ccvm/
├── config.json              # 系统配置
├── history.json            # 操作历史
└── providers/              # 提供商配置
    ├── anthropic.json      # Anthropic 官方配置
    └── custom.json         # 自定义配置
```

### 数据模型

#### ConfigManager 数据结构
```javascript
{
  "version": "1.1.0",
  "defaultProvider": "anthropic",
  "features": {
    "mcp": true,
    "diagnostics": true
  },
  "createdAt": "2025-09-06T...",
  "lastUpdated": "2025-09-06T..."
}
```

#### ProviderManager 数据结构
```javascript
{
  "alias": "anthropic",
  "name": "Anthropic Claude API",
  "apiUrl": "https://api.anthropic.com",
  "apiKey": "sk-...",
  "timeout": 30000,
  "isDefault": true,
  "createdAt": "2025-09-06T...",
  "lastUsed": "2025-09-06T..."
}
```

#### MCPManager 数据结构
```javascript
{
  "filesystem": {
    "enabled": true,
    "config": {
      "allowedDirectories": ["/path/to/allowed"]
    }
  },
  "docker": {
    "enabled": false,
    "config": {}
  }
}
```

## 安全模型

### 凭据管理
- **文件权限**: 所有配置文件设置为 600 权限（仅所有者读写）
- **路径验证**: 强制 HTTPS，仅允许本地网络和私有网络使用 HTTP
- **环境隔离**: 动态加载环境变量，避免持久化敏感信息

### URL 验证策略
```javascript
允许的 HTTP 地址:
- localhost 和 127.x.x.x
- 私有网络 (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- 开发环境 (CC_ALLOW_HTTP=true)
```

## 集成架构

### Shell 集成机制
```bash
# 环境变量动态加载
eval "$(ccvm env)"
claude "your prompt"

# 临时提供商切换
eval "$(ccvm env --provider custom)"
claude "using custom provider"
```

### MCP 服务集成
- **文件系统 MCP**: 本地文件操作支持
- **顺序思考 MCP**: 结构化思维过程
- **Docker MCP**: 容器管理集成
- **Context7**: 文档上下文服务
- **Chrome Browser MCP**: 浏览器自动化和网页交互 (新增)
- **Figma MCP**: 设计文件和原型数据访问
- **WeComBot MCP**: 企业微信群消息发送，支持多种消息类型 (新增)
- **IDE 集成**: VS Code 等开发环境支持

## 性能和可扩展性

### 性能优化策略
- **文件锁机制**: 防止并发操作冲突
- **缓存策略**: 配置文件缓存和智能刷新
- **懒加载**: 按需加载模块和配置
- **资源管理**: 自动清理临时文件和锁定文件

### 扩展性设计
- **插件架构**: 支持第三方 MCP 服务扩展
- **配置模板**: 标准化配置格式便于扩展
- **Hook 系统**: 支持生命周期钩子函数
- **API 抽象**: 统一的 API 接口便于多供应商支持

## 测试架构

### 测试策略
- **单元测试**: 覆盖所有核心模块（70%+ 覆盖率）
- **集成测试**: 端到端 CLI 命令测试
- **性能测试**: 启动时间和内存使用基准测试

### 测试工具链
```
Testing Stack
├── Jest (测试框架)
├── 测试工具 (tests/helpers/testUtils.js)
├── 环境管理 (tests/helpers/TestEnvironmentManager.js)
└── 集成测试工具 (tools/integration-test.js)
```

## 部署和分发

### 包管理
- **NPM 分发**: @kedoupi/ccvm
- **全局安装**: `npm install -g @kedoupi/ccvm`
- **文件包含**: bin/, src/, .claude/, tools/, install.sh

### 安装脚本
- **install.sh**: 自动化安装和配置脚本
- **权限设置**: 自动设置正确的文件权限
- **环境检测**: 验证 Node.js 版本和依赖

## 监控和诊断

### 系统诊断功能
- **健康检查**: `ccvm doctor` 命令
- **配置验证**: 自动检测配置问题
- **网络测试**: API 端点连通性检查
- **权限验证**: 文件权限和访问权限检查

### 错误处理策略
- **结构化错误**: 标准化错误码和消息
- **用户友好**: 可操作的错误信息和建议
- **故障恢复**: 自动备份和恢复机制