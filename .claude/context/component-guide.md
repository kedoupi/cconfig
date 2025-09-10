---
layer: 组件层
priority: medium
context_type: component_details
language: zh-CN
created: 2025-09-10
---

# CCVM 组件详解

## 🏗️ 系统架构组件

### 核心管理器
- **ConfigManager** (`src/core/ConfigManager.js`)
  - 功能：系统配置和初始化管理
  - 职责：配置文件管理、系统验证、功能开关
  - 配置位置：`~/.claude/ccvm/config.json`

- **ProviderManager** (`src/core/ProviderManager.js`)  
  - 功能：API 提供商配置管理
  - 职责：CRUD 操作、URL 验证、安全检查
  - 配置位置：`~/.claude/ccvm/providers/*.json`

- **MCPManager** (`src/core/MCPManager.js`)
  - 功能：MCP 服务管理
  - 职责：交互式配置、服务集成、连接测试
  - 支持服务：文件系统、Chrome浏览器、企业微信等

### 🔧 工具组件

#### Shell 集成系统
```bash
# 环境变量动态加载原理
eval "$(ccvm env)"                    # 加载默认配置
eval "$(ccvm env --provider 自定义)"   # 临时切换配置
claude "开始对话"                      # 使用加载的配置
```

#### 安全管理系统
- **文件权限**: 所有配置文件使用 600 权限（仅所有者可读写）
- **HTTPS 验证**: 强制使用 HTTPS（本地网络除外）
- **凭据隔离**: 动态加载环境变量，避免持久化泄露

### 🔌 MCP 服务生态

#### 已集成服务
1. **文件系统 MCP** - 本地文件操作和管理
2. **Chrome Browser MCP** - 浏览器自动化和网页交互
3. **企业微信 MCP** - 企业微信群消息自动化
4. **Context7** - 智能文档上下文服务
5. **Docker MCP** - 容器管理和操作

#### 服务配置模式
```javascript
// 标准 MCP 服务配置结构
{
  name: "服务名称",
  displayName: "显示名称", 
  transport: "stdio|sse|http",
  package: "npm包名",
  needsConfig: true,
  configFields: [...]
}
```

### 📊 诊断系统

#### 健康检查项目
- Node.js 版本兼容性
- 依赖包完整性
- 配置文件权限
- API 连通性测试
- MCP 服务状态

#### 自动修复功能
- 权限问题修复
- 配置文件重建
- 依赖包重新安装
- Shell 配置更新

---
*这是组件层文档 - 适合了解各模块的详细功能和使用方式*