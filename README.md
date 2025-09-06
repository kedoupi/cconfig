# CCVM - Claude Code Version Manager

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
│                Claude Code Version Manager                  │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
```

[![NPM Version](https://img.shields.io/npm/v/@kedoupi/ccvm.svg)](https://npmjs.org/package/@kedoupi/ccvm)
[![License](https://img.shields.io/npm/l/@kedoupi/ccvm.svg)](https://github.com/kedoupi/ccvm/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/@kedoupi/ccvm.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)](https://github.com/kedoupi/ccvm)
[![CI Status](https://img.shields.io/github/workflow/status/kedoupi/ccvm/CI)](https://github.com/kedoupi/ccvm/actions)

**🚀 Claude API Provider Version Manager - Like nvm for Claude**

*Comprehensive configuration management toolkit for Claude Code with multi-provider API support, secure credential management, and automated shell integration.*

[English](#english-documentation) | [中文](README.zh.md) | [Docs](docs/) | [Examples](docs/examples.md) | [FAQ](docs/faq.md)

</div>

---

## English Documentation

### 📖 Project Overview

CCVM (Claude Code Version Manager) is a comprehensive configuration management toolkit for Claude Code that provides multi-provider API support, secure credential management, and automated shell integration. The project enables users to configure and switch between different API providers (like different Claude API endpoints) seamlessly, similar to how nvm manages Node.js versions.

### ✨ Key Features

- 🔧 **Multi-Provider Support** - Easy configuration and switching between multiple Claude API providers
- 🛡️ **Secure Credential Management** - Safe storage and management of API keys with permission control
- 🚀 **One-Click Installation** - Automatic environment detection with intelligent setup
- ⚡ **Smart Claude Integration** - Seamless integration with native Claude command, automatic environment setup
- 📦 **MCP Service Management** - Install and manage Model Context Protocol services for Claude Code
- 📊 **Environment Variable Management** - Dynamic environment loading via `ccvm env` command
- 🩺 **System Diagnostics** - Comprehensive health checks, validation, and issue diagnosis
- 🎯 **Clean Design** - Reduced command redundancy with unified management interface

### 🚀 Quick Start

#### Installation

CCVM can be installed by running one of the following commands in your terminal:

| Method    | Command                                                                                           |
| :-------- | :------------------------------------------------------------------------------------------------ |
| **curl**  | `curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash` |
| **wget**  | `wget -qO- https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh \| bash`   |

> **Note**: The install script will intelligently detect your environment and automatically backup existing configurations.

#### Manual Inspection

You can manually inspect the install script before running:

```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh -o install.sh
# Inspect the script content
cat install.sh
# Run installation
bash install.sh
```

#### Development Mode Installation

For contributors and developers:

```bash
git clone https://github.com/kedoupi/ccvm.git
cd ccvm
npm install
# Run install script in project directory, automatically enables dev mode
./install.sh
```

#### Basic Usage

1. **Add API Provider**
```bash
ccvm add
# Follow prompts to enter: provider name, API URL, key, etc.
```

2. **List All Providers**
```bash
ccvm list
```

3. **Show Provider Details**
```bash
ccvm show <alias>
```

4. **Use Provider**
```bash
# Set default provider
ccvm use <alias>

# Use claude command with CCVM environment
eval "$(ccvm env)"
claude "your question"

# Temporary switch to specific provider (without changing default)
eval "$(ccvm env --provider <provider-alias>)"
claude "your question"

# Examples:
eval "$(ccvm env)"; claude "Explain React hooks"                    # Use default provider
eval "$(ccvm env --provider anthropic)"; claude "Design a REST API"        # Temporarily use anthropic
eval "$(ccvm env --provider custom-api)"; claude "Translate docs"  # Temporarily use custom-api
```

5. **System Status Check**
```bash
ccvm status
ccvm doctor
```

6. **Environment Management**
```bash
# Output environment variables for shell evaluation
ccvm env

# Use specific provider temporarily
ccvm env --provider <alias>

# Check current configuration
ccvm status --detailed
```

### 💡 Usage Examples

#### Multi-Provider Configuration
```bash
# Configure Anthropic official API
ccvm add
# Provider name: anthropic
# URL: https://api.anthropic.com
# Key: your-anthropic-key

# Configure custom API service
ccvm add  
# Provider name: custom
# URL: https://your-custom-api.com
# Key: your-custom-key

# Set default provider and use
ccvm use anthropic
eval "$(ccvm env)"
claude "Technical consultation"

# Temporary switch to other providers (recommended approach)
eval "$(ccvm env --provider custom)"
claude "Question using custom API"

eval "$(ccvm env --provider backup-api)"
claude "Emergency backup API usage"
```

#### Temporary Provider Switching (Advanced Usage)
```bash
# Temporary switching without modifying default config (recommended)
eval "$(ccvm env --provider backup-api)"
claude "Handle emergency with backup API"

eval "$(ccvm env --provider test-env)" 
claude "Verify features in test environment"

# Quick multi-provider workflows
eval "$(ccvm env --provider fast-api)"
claude "Rapid prototyping questions"      # Use fast API

eval "$(ccvm env --provider quality-api)"
claude "Production-grade code review"     # Switch to high-quality API

eval "$(ccvm env --provider cost-api)"
claude "Large data processing tasks"      # Switch to economical API

# Error recovery scenarios
eval "$(ccvm env)"
claude "Main task"                        # Default API

eval "$(ccvm env --provider backup-api)"
claude "Main task"                        # Quick switch to backup API
```

#### Team Collaboration Setup
```bash
# View current configuration
ccvm status --detailed

# Switch default provider
ccvm use anthropic

# Check system health
ccvm doctor --fix
```

#### MCP Service Management
```bash
# Interactive MCP management for Claude Code
ccvm mcp
# Select "📋 查看推荐 MCP 服务" to view available services
# Select "➕ 安装 MCP 服务到 Claude Code" to install
# Select "🔧 检查环境配置" to diagnose issues

# Recommended MCP services:
# - Filesystem MCP: Local file access
# - Sequential Thinking: Structured reasoning
# - Memory Bank: Persistent memory storage
# - Docker MCP: Container management

# View installed services (Claude Code native command)
claude mcp list
```

### 🏗️ System Architecture

```
CCVM (Claude Code Version Manager)
├── ConfigManager      # System configuration management
├── ProviderManager    # API provider management  
├── MCPManager         # MCP service management
└── Utils/             # Utility modules (banner, logger, validation, etc.)
```

### ⚡ Technical Implementation

**Dynamic Environment Loading**
```bash
# CCVM provides dynamic environment variable loading:

# Method 1: Direct evaluation (recommended)
eval "$(ccvm env)"
claude "your question"

# Method 2: Provider-specific temporary usage
eval "$(ccvm env --provider custom-api)"
claude "question for custom API"

# Method 3: Shell-specific format
eval "$(ccvm env --shell fish)"  # For fish shell users
```

**Workflow**
1. 📡 `ccvm env` outputs shell-compatible environment variable exports
2. 🔧 `eval` command loads these variables into current shell session
3. 🚀 Native `claude` command automatically uses loaded environment variables
4. ✅ Completely transparent experience, no configuration files needed

**Configuration File Structure**
```
~/.claude/ccvm/
├── config.json        # System configuration
├── providers/         # Provider configurations
│   ├── anthropic.json # Individual provider configs
│   └── custom.json    # (with 600 permissions)
```

### 📚 CLI Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `ccvm add` | Add new provider (interactive) | `ccvm add` |
| `ccvm list` | List all providers | `ccvm list` |
| `ccvm show <alias>` | Show provider details | `ccvm show anthropic` |
| `ccvm edit <alias>` | Edit provider configuration | `ccvm edit custom` |
| `ccvm remove <alias>` | Remove provider | `ccvm remove old-provider` |
| `ccvm use [alias]` | Set/select default provider | `ccvm use anthropic` |
| `ccvm env [--shell <shell>]` | Output environment variables | `ccvm env --shell bash` |
| `ccvm env [--provider <alias>]` | Output variables for specific provider | `ccvm env --provider custom` |
| `ccvm status [--detailed]` | Show system status | `ccvm status --detailed` |
| `ccvm doctor [--fix]` | Run system diagnostics | `ccvm doctor --fix` |
| `ccvm mcp` | Manage MCP services for Claude Code | `ccvm mcp` |

### 🛠️ Development

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
npm run test:integration

# Code quality
npm run lint
npm run lint:fix
npm run format

# Pre-pack checks
npm run prepack
```

#### Project Structure
```
ccvm/
├── src/                # Source code
│   ├── core/          # Core managers
│   │   ├── ConfigManager.js
│   │   ├── ProviderManager.js
│   │   └── MCPManager.js
│   └── utils/         # Utility functions
│       ├── banner.js  # ASCII art and banners
│       ├── errorHandler.js
│       ├── logger.js
│       ├── Validator.js
│       └── FileUtils.js
├── bin/               # CLI entry point
├── tests/             # Test files
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── helpers/       # Test utilities
├── tools/             # Development tools
├── docs/              # Documentation
└── install.sh         # Installation script
```

### 🔒 Security Features

- **Permission Control** - API key files stored with 600 permissions
- **Security Validation** - HTTPS enforcement (except localhost/private networks)
- **Backup Encryption** - Auto-backups include integrity verification
- **Environment Isolation** - Dynamic configuration loading to avoid env pollution
- **Input Sanitization** - Comprehensive validation and sanitization of user inputs

### 🧪 Testing

The project maintains high test coverage with comprehensive testing strategies:

- **Unit Tests** - Individual component testing with Jest
- **Integration Tests** - Full CLI command testing
- **Coverage Reports** - Minimum 70% coverage across all metrics
- **Test Utilities** - Shared fixtures and test helpers

Run tests:
```bash
npm test                    # Run all unit tests
npm run test:coverage      # Run with coverage report
npm run test:integration   # Run integration tests
npm run test:watch         # Watch mode for development
```

### 🤝 Contributing

We welcome all forms of contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

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
- **Core Modules**: 5 managers + utilities
- **Documentation**: Complete user and developer guides
- **Security**: Comprehensive validation and protection
- **Performance**: Optimized for CLI usage patterns

### 🌟 Community

- **GitHub Issues**: [Report bugs or request features](https://github.com/kedoupi/ccvm/issues)
- **Discussions**: [Join community discussions](https://github.com/kedoupi/ccvm/discussions)
- **Documentation**: [Comprehensive guides and examples](docs/)

### 🎯 Roadmap

- [ ] **Plugin System** - Extensible architecture for custom providers
- [ ] **Configuration Sync** - Cloud synchronization for team environments
- [ ] **Advanced Logging** - Enhanced debugging and monitoring capabilities
- [ ] **GUI Interface** - Optional graphical interface for configuration management
- [ ] **Docker Integration** - Container-based deployment options

### 📄 License

This project is licensed under the [MIT License](LICENSE).

### 🙏 Acknowledgments

Thanks to all developers and community members who contributed to this project!

---

<div align="center">

**Made with ❤️ by the Claude Code Kit community**

[⭐ Star us on GitHub](https://github.com/kedoupi/ccvm) | [🐛 Report Issues](https://github.com/kedoupi/ccvm/issues) | [📖 Read Docs](docs/)

</div>