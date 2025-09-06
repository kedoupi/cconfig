# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCVM (Claude Code Version Manager) is a comprehensive configuration management toolkit for Claude Code that provides multi-provider API support, secure credential management, and automated shell integration. The project enables users to configure and switch between different API providers (like different Claude API endpoints) seamlessly.

## Common Development Commands

### Testing
```bash
# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test:watch

# Run integration tests
npm run test:integration

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

# Run pre-pack checks (lint + test)
npm run prepack
```

### Installation and Testing
```bash
# Install globally for testing
npm install -g .

# Test the CLI tool
ccvm --help
ccvm status

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
- **Setup**: `tests/setup/jest.setup.js` for global test configuration

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
├── exec                    # Execute claude with current default configuration (legacy)
├── status [--detailed]     # Show system status
├── doctor [--fix]          # Run system diagnostics
└── mcp                     # Manage MCP services for Claude Code
```

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
- **Lock Files**: Prevent concurrent operations with automatic cleanup
- **Validation**: Comprehensive input validation with helpful error messages
- **Recovery**: Automatic backup before destructive operations
- **Logging**: Structured error messages with actionable suggestions

## Important Implementation Notes

### Provider URL Validation
The system allows HTTP URLs for:
- localhost and 127.x.x.x addresses
- Private networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- When `CC_ALLOW_HTTP=true` environment variable is set


