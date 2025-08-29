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

The system follows a modular architecture with five core managers:

### ConfigManager (`src/core/ConfigManager.js`)
- **Purpose**: Overall system configuration and initialization
- **Key Features**: File locking, directory structure management, system validation
- **Location**: `~/.claude/ccvm/config.json`
- **Responsibilities**: System-wide settings, feature flags, backup limits

### ProviderManager (`src/core/ProviderManager.js`)
- **Purpose**: API provider configuration management
- **Key Features**: Provider CRUD operations, validation, security checks
- **Location**: `~/.claude/ccvm/providers/*.json`
- **Security**: Validates URLs, enforces HTTPS (except localhost/private networks), stores credentials with 600 permissions

### BackupManager (`src/core/BackupManager.js`)
- **Purpose**: Configuration backup and restoration
- **Key Features**: Automatic backups before changes, integrity verification, history management
- **Location**: `~/.claude/ccvm/backups/`
- **Retention**: Configurable max backups (default: 10)

### AliasGenerator (`src/core/AliasGenerator.js`)
- **Purpose**: Shell function generation for seamless Claude integration  
- **Key Features**: Dynamic shell function creation, shell compatibility detection, security validation
- **Output**: Shell functions integrated into user's shell configuration
- **Design**: Simplified Claude function that loads CCVM environment and calls native Claude CLI

### UpdateManager (`src/core/UpdateManager.js`)
- **Purpose**: Configuration template updates from remote repositories
- **Key Features**: Safe downloading, merging, and applying remote configuration updates
- **Location**: Downloads to `~/.claude/ccvm/.update-temp/`
- **Security**: HTTPS-only downloads with integrity verification

## Key Design Decisions

### Smart Claude Integration
The system provides seamless integration with native Claude CLI:
- **Design**: Single `claude` command that automatically loads CCVM configuration and calls native Claude
- **Management**: Use `ccvm use <alias>` to set default provider, then `claude "prompt"` works transparently
- **Implementation**: `ccvm env` command provides shell-compatible environment variable export statements
- **Benefit**: Zero-friction user experience with automatic environment configuration

### Security Model
- **Credential Storage**: API keys stored in individual JSON files with 600 permissions
- **URL Validation**: Enforces HTTPS except for localhost and private networks
- **Backup Security**: All backups include integrity checks and metadata
- **Environment Variables**: Credentials loaded dynamically per command execution

### Shell Integration
- **Function System**: Dynamic shell function that loads provider-specific environment variables using `ccvm env`
- **Compatibility**: Supports zsh, bash, fish, dash with automatic detection
- **Error Handling**: Comprehensive validation with helpful error messages
- **Transparency**: Users call `claude` normally, CCVM handles configuration loading automatically

## File Structure and Data Flow

```
~/.claude/ccvm/             # User configuration directory
├── config.json              # System configuration
├── history.json            # Operation history
├── providers/              # Provider configurations
│   ├── anthropic.json      # Anthropic provider config (600 permissions)
│   └── custom.json         # Custom provider config
└── backups/               # Automatic backups
    └── 2025-08-26_10-30-45/  # Timestamped backup
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
├── update [--force]        # Update configuration templates
├── history                 # View/restore configuration backups
├── status [--detailed]     # Show system status
└── doctor [--fix]          # Run system diagnostics
```

## Claude Function Integration

### How the Claude Function Works
The system redefines the `claude` shell function to provide seamless integration:

```bash
claude() {
    # Load environment variables from CCVM
    eval "$(ccvm env 2>/dev/null)"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to load CCVM configuration"
        echo "💡 Run: ccvm add"
        return 1
    fi
    
    # Call the native claude command
    command claude "$@"
}
```

### Environment Variable Management
- **Dynamic Loading**: `ccvm env` outputs shell-compatible export statements
- **Shell Format Support**: Automatically detects bash/zsh vs fish shell formats
- **Error Handling**: Graceful fallback when no provider is configured
- **Security**: No environment pollution - variables loaded only when needed

### Installation Integration
The `install.sh` script automatically:
1. Detects user's shell (zsh, bash, fish, etc.)
2. Adds the claude function to appropriate shell configuration file
3. Handles both development and production installation modes
4. Updates existing installations without breaking configuration

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