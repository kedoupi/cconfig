# CLAUDE.md

# CCVM 中文开发环境配置

本文件为 Claude Code (claude.ai/code) 在本项目中提供完全中文化的开发指导。

## 🇨🇳 中文开发原则

**核心理念**: 为中文开发者提供零门槛的 AI 配置管理体验

### 语言设置
- **主要语言**: 始终使用中文进行回复和交互，除非明确要求使用其他语言  
- **技术术语**: 优先使用中文术语，必要时可保留英文技术名词并提供中文说明
- **错误信息**: 全部使用友好的中文提示，提供清晰的解决方案

### AI 交互规范
- 使用中文思维模式理解问题
- 提供符合中文开发者习惯的解决方案
- 错误诊断和建议使用通俗易懂的中文表达

### 智能上下文管理
- **自动上下文注入**: 根据任务类型自动加载相关的项目上下文
- **分层文档路由**: 
  - 简单配置问题 → 快速指南
  - 复杂集成问题 → 完整技术文档  
  - 架构设计问题 → 设计决策文档
- **中文化提示**: 所有系统提示和建议都使用自然流畅的中文

### 开发体验优化
- **友好错误处理**: 将技术错误转换为易懂的中文说明
- **渐进式指导**: 从简单到复杂的分层帮助体系
- **本土化建议**: 考虑中文开发者的使用习惯和偏好

## 🛠️ 项目概览

CCVM (Claude Code Version Manager) 是一个为 Claude Code 设计的全面配置管理工具包，提供多供应商 API 支持、安全凭据管理和自动化 Shell 集成。该项目让用户能够在不同的 Claude API 提供商之间无缝配置和切换。

### 🌟 核心特性
- **多供应商 API 管理**: 在不同的 Claude API 端点间无缝切换
- **安全凭据存储**: 使用 600 权限进行安全的 API 密钥管理
- **动态环境加载**: 通过 `ccvm env` 命令进行 Shell 集成  
- **MCP 服务管理**: Model Context Protocol 服务的交互式管理
- **系统诊断功能**: 全面的健康检查和问题诊断
- **智能 CLI 集成**: 与原生 `claude` 命令的直接集成

### 🎯 设计理念
- **零配置**: 开箱即用的智能默认设置
- **渐进增强**: 从简单使用到高级定制的平滑过渡
- **安全优先**: API 密钥和敏感配置的安全管理
- **开发友好**: 符合中国开发者习惯的设计和交互

### Architecture Philosophy
CCVM follows a **three-layer architecture** with clear separation of concerns:
- **CLI Layer**: User interface and command parsing (Commander.js)
- **Core Layer**: Business logic managers (ConfigManager, ProviderManager, MCPManager)  
- **Utils Layer**: Shared utilities and services

## Common Development Commands

### Testing
```bash
# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode  
npm run test:watch

# Run integration tests
npm run test:integration

# Run performance benchmarks
npm run test:performance

# Run a specific test file
npm test -- tests/unit/core/ConfigManager.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="provider management"
```

### Code Quality
```bash
# Lint all code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check format without modifying files
npm run format:check

# Run pre-pack checks (lint + test + format check)
npm run prepack

# Calculate code size metrics
npm run size

# Generate API documentation
npm run docs
```

### Installation and Testing
```bash
# Install globally for testing
npm install -g .

# Test the CLI tool
ccvm --help
ccvm status

# Clean and reset development environment
npm run clean
npm run reset

# Uninstall after testing
npm uninstall -g @kedoupi/ccvm
```

## Core Architecture

The system follows a modular architecture with three core managers:

### ConfigManager (`src/core/ConfigManager.js`)
- **Purpose**: Overall system configuration and initialization
- **Key Features**: File locking, directory structure management, system validation
- **Location**: `~/.claude/ccvm/config.json`
- **Responsibilities**: System-wide settings, feature flags

### ProviderManager (`src/core/ProviderManager.js`)
- **Purpose**: API provider configuration management
- **Key Features**: Provider CRUD operations, validation, security checks
- **Location**: `~/.claude/ccvm/providers/*.json`
- **Security**: Validates URLs, enforces HTTPS (except localhost/private networks), stores credentials with 600 permissions


### MCPManager (`src/core/MCPManager.js`)
- **Purpose**: MCP (Model Context Protocol) service management for Claude Code
- **Key Features**: Interactive MCP service management, configuration, integration
- **Integration**: Provides `ccvm mcp` command interface
- **Supported Services**: Filesystem MCP, Sequential Thinking, Docker MCP, Context7, Chrome Browser MCP, Figma MCP, WeComBot MCP

#### Chrome Browser MCP Integration
CCVM提供了Chrome浏览器自动化的深度集成：

**特殊安装流程**:
- **Chrome扩展**: 需要从GitHub手动下载并安装浏览器扩展
- **npm全局包**: 自动安装`mcp-chrome-bridge`包
- **服务启动**: 通过浏览器扩展启动本地HTTP服务
- **连接测试**: 自动验证MCP服务连接状态

**功能特性**:
- **20+ 浏览器工具**: 截图、标签管理、内容分析、表单填写
- **跨标签上下文**: 语义搜索和内容关联
- **网络监控**: 请求拦截和分析
- **隐私保护**: 完全本地运行，不向外发送数据

**使用方式**:
```bash
# 通过CCVM安装和配置
ccvm mcp
# 选择"Chrome Browser MCP"并按向导完成设置

# 使用示例
claude "截图当前网页"
claude "分析这个页面的主要内容"  
claude "帮我填写这个表单"
claude "关闭所有标签页"
```

## Key Design Decisions

### Smart Claude Integration
The system provides seamless integration with native Claude CLI through environment variable management:

**Dynamic Environment Loading:**
- **Usage**: `eval "$(ccvm env)"` followed by `claude "prompt"`  
- **Benefits**: Dynamic provider switching, no file dependencies, temporary provider support
- **Implementation**: `ccvm env [--provider <alias>]` outputs shell-compatible export statements
- **Commands**: 
  - `ccvm env` - Load default provider environment
  - `ccvm env --provider <alias>` - Load specific provider environment

### Security Model
- **Credential Storage**: API keys stored in individual JSON files with 600 permissions
- **URL Validation**: Enforces HTTPS except for localhost and private networks
- **Environment Variables**: Credentials loaded dynamically per command execution

### Shell Integration
- **Environment System**: Dynamic environment variable loading using `ccvm env` command
- **Shell Compatibility**: Supports zsh, bash, fish with format detection (`--shell` option)
- **Usage Pattern**: `eval "$(ccvm env)"` then `claude "prompt"`
- **Provider Switching**: Temporary provider switching with `--provider` option

## File Structure and Data Flow

```
~/.claude/ccvm/             # User configuration directory
├── config.json              # System configuration
├── history.json            # Operation history
└── providers/              # Provider configurations
    ├── anthropic.json      # Anthropic provider config (600 permissions)
    └── custom.json         # Custom provider config
```

## Testing Architecture

### Unit Tests (`tests/unit/`)
- **Core Managers**: Each core class has comprehensive unit tests
- **Test Utilities**: `tests/helpers/testUtils.js` provides fixtures and helpers
- **Coverage**: Minimum 70% coverage required across branches, functions, lines, statements

### Integration Tests (`tests/integration/`)
- **Full System**: End-to-end testing of CLI commands
- **Tools**: `tools/integration-test.js` runs comprehensive integration scenarios

### Test Configuration
- **Framework**: Jest with 30-second timeout
- **Environment**: Node.js test environment  
- **Coverage Target**: 70% minimum across branches, functions, lines, statements
- **Test Helpers**: `tests/helpers/testUtils.js` provides fixtures and mock utilities
- **Environment Management**: `tests/helpers/TestEnvironmentManager.js` for isolated test environments

## Environment Variables and Configuration

### Development Environment Variables
```bash
# Allow HTTP for testing (bypasses HTTPS validation)
CC_ALLOW_HTTP=true

# Debug mode for additional logging
NODE_ENV=test
```

### Runtime Configuration
The system dynamically loads provider configurations and sets these environment variables:
- `ANTHROPIC_AUTH_TOKEN`: API key for the selected provider
- `ANTHROPIC_BASE_URL`: API endpoint URL
- `API_TIMEOUT_MS`: Request timeout (default: 3000000ms)

## CLI Command Structure

The main CLI (`bin/ccvm.js`) uses Commander.js with the following command hierarchy:

```
ccvm
├── add                     # Add new provider (interactive)
├── list                    # List all providers
├── show <alias>            # Show provider details
├── edit <alias>            # Edit provider configuration
├── remove <alias>          # Remove provider
├── use [alias]             # Set/select default provider
├── env [--shell <shell>]   # Output environment variables for current provider
│   [--provider <alias>]    # Specify provider for env output
├── status [--detailed]     # Show system status
├── doctor [--fix]          # Run system diagnostics
└── mcp                     # Manage MCP services for Claude Code
```

**Note**: The `exec` command has been removed in favor of direct `claude` command integration.

## Claude Integration Usage

### Environment Variable Management
The system uses `ccvm env` command to provide dynamic environment variable loading:

**Basic Usage:**
```bash
# Load default provider and use Claude
eval "$(ccvm env)"
claude "Hello, how are you?"

# Load specific provider temporarily  
eval "$(ccvm env --provider custom-api)"
claude "This uses custom-api temporarily"
```

**Shell Format Support:**
- **Auto-detection**: Automatically detects shell format
- **Manual override**: Use `--shell bash|zsh|fish` for specific formats
- **Error handling**: Clear error messages for configuration issues

**Environment Variables Set:**
- `ANTHROPIC_AUTH_TOKEN`: API key for authentication
- `ANTHROPIC_BASE_URL`: API endpoint URL  
- `API_TIMEOUT_MS`: Request timeout (default: 3000000ms)

## Error Handling Patterns

The codebase follows consistent error handling patterns:
- **Lock Files**: Prevent concurrent operations with automatic cleanup (LockManager.js)
- **Validation**: Comprehensive input validation with helpful error messages (Validator.js)
- **Recovery**: Automatic backup before destructive operations
- **Logging**: Structured error messages with actionable suggestions (logger.js)
- **Resource Management**: Automatic cleanup of temporary files and resources (ResourceManager.js)

## Important Implementation Notes

### Provider URL Validation
The system allows HTTP URLs for:
- localhost and 127.x.x.x addresses
- Private networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- When `CC_ALLOW_HTTP=true` environment variable is set

### File Permissions and Security
- All configuration files stored with 600 permissions (owner read/write only)
- API keys never logged or exposed in error messages
- Automatic backup creation before destructive operations
- Lock files prevent concurrent access conflicts

### Development Debugging
- Use `DEBUG=ccvm:*` environment variable for verbose logging
- `ccvm doctor --fix` for automated problem resolution
- `ccvm status --detailed` for comprehensive system information

## Project Context and Status

### Current Development Phase
- **Version**: 1.1.0 (Production Ready)
- **Development Status**: Active development with focus on architecture optimization
- **Recent Focus**: Code quality improvements, MCP service integration, documentation enhancement
- **Test Coverage**: 70%+ across branches, functions, lines, and statements

### Development Philosophy
CCVM follows these core principles:
- **Fail Fast**: Critical configuration errors should stop execution immediately
- **Log and Continue**: Optional features should log errors but continue operation
- **Graceful Degradation**: Provide fallback options when dependencies are unavailable
- **Prefer Working Solutions**: Choose implementations that work over perfect solutions

### Quality Standards
- No partial implementations - features are either complete or not included
- Avoid code duplication - refactor common patterns and logic
- Write tests for every function
- Maintain clear separation of concerns
- Prevent resource leaks and handle cleanup properly
- Maintain consistent naming conventions

### Recent Major Changes
Based on Git history, recent development has focused on:
- Architecture refactoring and optimization (September 2025)
- MCP service management simplification 
- Code quality standardization with ESLint + Prettier
- Comprehensive documentation system establishment
- Test suite expansion and coverage improvement

### Technical Decision Records
Key architectural decisions include:
- **CLI Framework**: Commander.js v11.1.0 for mature, lightweight CLI handling
- **Configuration Storage**: JSON file-based hierarchical storage for simplicity and security
- **Security Model**: File permissions (600) + HTTPS validation for comprehensive protection
- **Shell Integration**: Dynamic environment variable loading via `ccvm env` for seamless Claude integration
- **Three-Layer Architecture**: Clear separation between CLI, Core, and Utils layers
- **Testing Strategy**: Jest-based testing with unit, integration, and performance tiers

### Known Technical Debt
- Continue improving test quality beyond current 70% coverage
- Further code complexity reduction in core managers
- Configuration loading cache optimization for better performance
- Dependency package size optimization

## Project Structure Deep Dive

### Core Module Responsibilities

**ConfigManager** (`src/core/ConfigManager.js`):
- Manages `~/.claude/ccvm/config.json` system configuration
- Handles file locking to prevent concurrent operations
- Validates system directories and permissions
- Manages feature flags and system-wide settings

**ProviderManager** (`src/core/ProviderManager.js`):
- CRUD operations for API providers in `~/.claude/ccvm/providers/`
- URL validation with security checks (HTTPS enforcement)
- Credential storage with 600 file permissions
- Provider switching and default management

**MCPManager** (`src/core/MCPManager.js`):
- Interactive MCP service configuration for Claude Code
- Supports Filesystem, Sequential Thinking, Docker, Context7, IDE services
- Direct integration with Claude Code's MCP system
- Service health checking and validation

### Utility Modules

**Critical Utils**:
- `LockManager.js`: File-based locking for concurrent operation prevention
- `Validator.js`: Input validation and security checks
- `FileUtils.js`: Safe file operations with backup and recovery
- `ResourceManager.js`: Automatic cleanup of temporary resources
- `errorHandler.js`: Structured error handling with user-friendly messages
- `logger.js`: Configurable logging with debug support

### Testing Strategy Details

**Unit Test Coverage** (`tests/unit/`):
- Each core manager has comprehensive test suite
- Mock external dependencies (fs-extra, inquirer)
- Test utilities in `tests/helpers/testUtils.js` provide fixtures
- Environment isolation via `tests/helpers/TestEnvironmentManager.js`

**Integration Testing** (`tests/integration/`):
- End-to-end CLI command testing
- Full system workflow validation
- Provider management lifecycle testing
- Shell integration verification

**Performance Testing** (`tests/performance/`):
- Startup time benchmarks (target: <500ms)
- Memory usage monitoring (target: <50MB)
- Configuration loading performance
- Command response time tracking

## Project Context Documentation

This project includes comprehensive context documentation in `.claude/context/` for detailed project understanding:

### Core Context Files

- **`.claude/context/project-overview.md`** - Complete project background, goals, and value proposition
- **`.claude/context/tech-context.md`** - Technical stack, architecture design, and implementation details  
- **`.claude/context/project-structure.md`** - Detailed file organization, component relationships, and naming conventions
- **`.claude/context/development-context.md`** - Development workflows, coding standards, and best practices
- **`.claude/context/progress.md`** - Project milestones, current status, and roadmap planning
- **`.claude/context/decisions.md`** - Architecture Decision Records (ADRs) with rationale and consequences

### Context Usage

These files provide comprehensive project context that complements this CLAUDE.md file:
- **For Architecture Understanding**: Read `tech-context.md` and `decisions.md` for deep technical insights
- **For Development Setup**: Consult `development-context.md` for detailed workflow guidance  
- **For Project History**: Review `progress.md` for milestone understanding and `decisions.md` for evolution
- **For File Navigation**: Use `project-structure.md` for comprehensive codebase organization

The context files are automatically maintained and updated to reflect current project state.


