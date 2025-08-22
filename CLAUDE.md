# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Kit is a comprehensive configuration management toolkit for Claude Code that provides multi-provider API support, secure credential management, and automated shell integration. The project enables users to configure and switch between different API providers (like different Claude API endpoints) seamlessly.

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
cc-config --help
cc-config status

# Uninstall after testing
npm uninstall -g @kedoupi/claude-code-kit
```

## Core Architecture

The system follows a modular architecture with four core managers:

### ConfigManager (`src/core/ConfigManager.js`)
- **Purpose**: Overall system configuration and initialization
- **Key Features**: File locking, directory structure management, system validation
- **Location**: `~/.cc-config/config.json`
- **Responsibilities**: System-wide settings, feature flags, backup limits

### ProviderManager (`src/core/ProviderManager.js`)
- **Purpose**: API provider configuration management
- **Key Features**: Provider CRUD operations, validation, security checks
- **Location**: `~/.cc-config/providers/*.json`
- **Security**: Validates URLs, enforces HTTPS (except localhost/private networks), stores credentials with 600 permissions

### BackupManager (`src/core/BackupManager.js`)
- **Purpose**: Configuration backup and restoration
- **Key Features**: Automatic backups before changes, integrity verification, history management
- **Location**: `~/.cc-config/backups/`
- **Retention**: Configurable max backups (default: 10)

### AliasGenerator (`src/core/AliasGenerator.js`)
- **Purpose**: Shell alias generation for provider switching
- **Key Features**: Dynamic alias creation, shell compatibility detection, security validation
- **Output**: `~/.cc-config/aliases.sh`
- **Design**: Simplified to avoid command proliferation - only core aliases, no `-info` variants

## Key Design Decisions

### Provider Management Simplification
The system was recently refactored to eliminate redundant `-info` commands:
- **Before**: Each provider generated 2 aliases (`cc`, `cc-info`)
- **After**: Each provider generates 1 alias (`cc`) + unified management (`cc-config provider show <alias>`)
- **Benefit**: 50% reduction in shell command pollution, unified management interface

### Security Model
- **Credential Storage**: API keys stored in individual JSON files with 600 permissions
- **URL Validation**: Enforces HTTPS except for localhost and private networks
- **Backup Security**: All backups include integrity checks and metadata
- **Environment Variables**: Credentials loaded dynamically per command execution

### Shell Integration
- **Alias System**: Dynamic shell aliases that load provider-specific environment variables
- **Compatibility**: Supports zsh, bash, fish, dash with automatic detection
- **Error Handling**: Comprehensive validation with helpful error messages

## File Structure and Data Flow

```
~/.cc-config/                 # User configuration directory
├── config.json              # System configuration
├── aliases.sh               # Generated shell aliases
├── history.json            # Operation history
├── providers/              # Provider configurations
│   ├── cc.json            # Provider config (600 permissions)
│   └── zt.json            # Another provider config
└── backups/               # Automatic backups
    └── 2025-01-22_10-30-45/  # Timestamped backup
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

The main CLI (`bin/cc-config.js`) uses Commander.js with the following command hierarchy:

```
cc-config
├── provider                 # Provider management
│   ├── add                 # Add new provider (interactive)
│   ├── list                # List all providers
│   ├── show <alias>        # Show provider details (unified command)
│   ├── edit <alias>        # Edit provider configuration
│   ├── remove <alias>      # Remove provider
│   └── use [alias]         # Set/select default provider
├── update [--force]        # Update configuration templates
├── history                 # View/restore configuration backups
├── status [--detailed]     # Show system status
└── doctor [--fix]          # Run system diagnostics
```

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

### Alias Generation Security
The AliasGenerator includes security checks for:
- Shell injection attempts in alias names
- Reserved shell keywords
- File permission validation
- Command substitution patterns

### Backup Integrity
BackupManager ensures data integrity through:
- Metadata verification
- File size validation
- JSON structure validation
- Timestamp consistency checks