#!/bin/bash

# Claude Code Kit Installation Script
# This script installs and configures the Claude Code Kit with optimized configurations
# Version: 2.0.0 - Production Ready

set -euo pipefail

# Global variables for cleanup
TEMP_FILES=()
BACKUP_CREATED=""
INSTALLATION_STATE=""
ROLLBACK_NEEDED=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions with timestamp and log file support
LOG_FILE="/tmp/claude-code-kit-install-$(date +%Y%m%d_%H%M%S).log"

log_with_timestamp() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log_with_timestamp "INFO" "$1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log_with_timestamp "SUCCESS" "$1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    log_with_timestamp "WARN" "$1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log_with_timestamp "ERROR" "$1"
    ROLLBACK_NEEDED=true
    cleanup_and_exit 1
}

debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo -e "${NC}[DEBUG]${NC} $1"
        log_with_timestamp "DEBUG" "$1"
    fi
}

# Configuration
CLAUDE_CODE_KIT_DIR="$HOME/.cc-config"
CLAUDE_CONFIG_DIR="$HOME/.claude"
PROVIDERS_DIR="$CLAUDE_CODE_KIT_DIR/providers"
BACKUPS_DIR="$CLAUDE_CODE_KIT_DIR/backups"
ALIASES_FILE="$CLAUDE_CODE_KIT_DIR/aliases.sh"
REQUIRED_NODE_VERSION="18"
RECOMMENDED_NODE_VERSION="22"

# Add temp files to cleanup list
add_temp_file() {
    TEMP_FILES+=("$1")
}

# Cleanup function
cleanup_temp_files() {
    debug "Cleaning up temporary files..."
    for file in "${TEMP_FILES[@]}"; do
        if [ -f "$file" ] || [ -d "$file" ]; then
            rm -rf "$file"
            debug "Removed temporary file/directory: $file"
        fi
    done
}

# Rollback function
rollback_installation() {
    if [ "$ROLLBACK_NEEDED" = true ] && [ -n "$BACKUP_CREATED" ]; then
        warn "Rolling back installation..."
        
        # Restore from backup
        if [ -d "$BACKUPS_DIR/$BACKUP_CREATED/claude" ]; then
            rm -rf "$CLAUDE_CONFIG_DIR"
            mv "$BACKUPS_DIR/$BACKUP_CREATED/claude" "$CLAUDE_CONFIG_DIR"
            success "Configuration restored from backup"
        fi
        
        # Remove incomplete cc-config directory
        if [ "$INSTALLATION_STATE" != "completed" ]; then
            rm -rf "$CLAUDE_CODE_KIT_DIR"
            debug "Removed incomplete cc-config directory"
        fi
    fi
}

# Cleanup and exit function
cleanup_and_exit() {
    local exit_code=${1:-0}
    
    debug "Starting cleanup process..."
    
    if [ $exit_code -ne 0 ]; then
        rollback_installation
    fi
    
    cleanup_temp_files
    
    if [ $exit_code -ne 0 ]; then
        echo
        error "Installation failed. Check log file: $LOG_FILE"
        echo -e "${YELLOW}For support, please share the log file content.${NC}"
    fi
    
    exit $exit_code
}

# Trap for cleanup on exit or interrupt
trap 'cleanup_and_exit $?' EXIT
trap 'cleanup_and_exit 130' INT TERM

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version with enhanced validation
check_nodejs_version() {
    info "Checking Node.js installation..."
    
    if ! command_exists node; then
        warn "Node.js not found. Installing Node.js $RECOMMENDED_NODE_VERSION..."
        install_nodejs
        return
    fi
    
    local current_version
    current_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    
    if [ -z "$current_version" ] || ! [[ "$current_version" =~ ^[0-9]+$ ]]; then
        error "Unable to determine Node.js version. Please check your Node.js installation."
    fi
    
    debug "Current Node.js version: $current_version, Required: $REQUIRED_NODE_VERSION"
    
    if [ "$current_version" -lt "$REQUIRED_NODE_VERSION" ]; then
        warn "Node.js version $current_version is too old. Required: $REQUIRED_NODE_VERSION+"
        
        # Ask user before upgrading
        echo -n "Would you like to install Node.js $RECOMMENDED_NODE_VERSION? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            install_nodejs
        else
            error "Node.js $REQUIRED_NODE_VERSION+ is required to continue."
        fi
    else
        success "Node.js version $(node --version) is compatible"
        
        # Check npm as well
        if ! command_exists npm; then
            error "npm is not available. Please reinstall Node.js."
        fi
        
        local npm_version
        npm_version=$(npm --version 2>/dev/null)
        if [ $? -eq 0 ]; then
            debug "npm version: $npm_version"
        else
            warn "Unable to determine npm version"
        fi
    fi
}

# Install Node.js using NVM with enhanced error handling
install_nodejs() {
    info "Setting up Node.js installation..."
    
    # Create temp directory for NVM installation
    local nvm_temp_dir="/tmp/nvm-install-$$"
    add_temp_file "$nvm_temp_dir"
    
    if ! command_exists nvm; then
        info "Installing NVM (Node Version Manager)..."
        
        # Check if curl or wget is available
        if command_exists curl; then
            curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh -o "$nvm_temp_dir.sh"
        elif command_exists wget; then
            wget -q https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh -O "$nvm_temp_dir.sh"
        else
            error "Neither curl nor wget is available. Cannot install NVM."
        fi
        
        add_temp_file "$nvm_temp_dir.sh"
        
        # Verify download
        if [ ! -f "$nvm_temp_dir.sh" ] || [ ! -s "$nvm_temp_dir.sh" ]; then
            error "Failed to download NVM installation script"
        fi
        
        # Run NVM installation
        bash "$nvm_temp_dir.sh" || error "NVM installation failed"
        
        # Source NVM
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
        
        # Verify NVM installation
        if ! command_exists nvm; then
            error "NVM installation verification failed"
        fi
        
        success "NVM installed successfully"
    else
        debug "NVM already available"
    fi
    
    info "Installing Node.js $RECOMMENDED_NODE_VERSION..."
    
    # Install Node.js with error handling
    if ! nvm install "$RECOMMENDED_NODE_VERSION"; then
        error "Failed to install Node.js $RECOMMENDED_NODE_VERSION"
    fi
    
    if ! nvm use "$RECOMMENDED_NODE_VERSION"; then
        error "Failed to activate Node.js $RECOMMENDED_NODE_VERSION"
    fi
    
    if ! nvm alias default "$RECOMMENDED_NODE_VERSION"; then
        warn "Failed to set default Node.js version, but installation continues"
    fi
    
    # Verify installation
    local installed_version
    installed_version=$(node --version 2>/dev/null | sed 's/v//')
    if [ -z "$installed_version" ]; then
        error "Node.js installation verification failed"
    fi
    
    success "Node.js $installed_version installed successfully"
    debug "npm version: $(npm --version 2>/dev/null || echo 'unknown')"
}

# Install or update Claude Code CLI with enhanced error handling
install_claude_code() {
    info "Installing Claude Code CLI..."
    INSTALLATION_STATE="installing_claude"
    
    # Check if npm is available and working
    if ! npm --version >/dev/null 2>&1; then
        error "npm is not working properly. Please check your Node.js installation."
    fi
    
    # Check npm registry connectivity
    info "Checking npm registry connectivity..."
    if ! npm ping >/dev/null 2>&1; then
        warn "Cannot reach npm registry. Continuing with cached packages if available..."
    fi
    
    local install_attempts=0
    local max_attempts=3
    
    while [ $install_attempts -lt $max_attempts ]; do
        install_attempts=$((install_attempts + 1))
        debug "Claude Code installation attempt $install_attempts of $max_attempts"
        
        if command_exists claude; then
            info "Claude Code already installed. Checking for updates..."
            
            # Try update first
            if npm update -g @anthropic-ai/claude-code >/dev/null 2>&1; then
                success "Claude Code updated successfully"
                break
            else
                warn "Update failed. Attempting fresh installation..."
                # Remove and reinstall
                npm uninstall -g @anthropic-ai/claude-code >/dev/null 2>&1 || true
            fi
        fi
        
        # Install Claude Code
        info "Installing Claude Code CLI (attempt $install_attempts)..."
        if npm install -g @anthropic-ai/claude-code; then
            success "Claude Code CLI installed successfully"
            break
        else
            if [ $install_attempts -eq $max_attempts ]; then
                error "Failed to install Claude Code CLI after $max_attempts attempts"
            else
                warn "Installation attempt $install_attempts failed. Retrying..."
                sleep 2
            fi
        fi
    done
    
    # Verify installation
    if command_exists claude; then
        local claude_version
        claude_version=$(claude --version 2>/dev/null || echo "unknown")
        success "Claude Code CLI verified successfully"
        info "Claude Code version: $claude_version"
        debug "Claude Code location: $(which claude)"
    else
        error "Claude Code CLI installation verification failed"
    fi
    
    INSTALLATION_STATE="claude_installed"
}

# Create backup of existing configuration with enhanced safety
backup_existing_config() {
    INSTALLATION_STATE="backing_up"
    
    if [ -d "$CLAUDE_CONFIG_DIR" ]; then
        local timestamp
        timestamp=$(date +"%Y%m%d_%H%M%S")
        local backup_dir="$BACKUPS_DIR/$timestamp"
        
        info "Backing up existing Claude configuration..."
        
        # Ensure backup directory exists
        if ! mkdir -p "$backup_dir"; then
            error "Failed to create backup directory: $backup_dir"
        fi
        
        # Calculate size before backup
        local original_size
        original_size=$(du -sh "$CLAUDE_CONFIG_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        
        # Create backup with error checking
        if ! cp -r "$CLAUDE_CONFIG_DIR" "$backup_dir/claude"; then
            error "Failed to backup existing configuration"
        fi
        
        # Verify backup integrity
        if [ ! -d "$backup_dir/claude" ]; then
            error "Backup verification failed - directory not created"
        fi
        
        local backup_size
        backup_size=$(du -sh "$backup_dir/claude" 2>/dev/null | cut -f1 || echo "unknown")
        
        # Record backup metadata with additional info
        cat > "$backup_dir/metadata.json" << EOF
{
    "timestamp": "$timestamp",
    "description": "Pre-installation backup",
    "original_size": "$original_size",
    "backup_size": "$backup_size",
    "created_by": "install.sh v2.0.0",
    "original_path": "$CLAUDE_CONFIG_DIR",
    "backup_path": "$backup_dir/claude",
    "files_count": $(find "$backup_dir/claude" -type f 2>/dev/null | wc -l || echo "unknown")
}
EOF
        
        # Set backup created flag for rollback
        BACKUP_CREATED="$timestamp"
        
        success "Configuration backed up to $backup_dir"
        debug "Backup size: $backup_size (original: $original_size)"
        
        # Update history file
        local history_file="$BACKUPS_DIR/../history.json"
        if [ -f "$history_file" ]; then
            # Create temporary file for JSON manipulation
            local temp_history="/tmp/history_temp_$$.json"
            add_temp_file "$temp_history"
            
            # Add backup entry to history
            jq --arg timestamp "$timestamp" \
               --arg description "Pre-installation backup" \
               --arg size "$backup_size" \
               '.backups += [{"timestamp": $timestamp, "description": $description, "size": $size}]' \
               "$history_file" > "$temp_history" 2>/dev/null && mv "$temp_history" "$history_file"
        fi
    else
        debug "No existing Claude configuration found. Skipping backup."
    fi
    
    INSTALLATION_STATE="backup_completed"
}

# Deploy configuration templates
deploy_configurations() {
    info "Deploying configuration templates..."
    
    # Create directories
    mkdir -p "$CLAUDE_CONFIG_DIR"
    mkdir -p "$CLAUDE_CONFIG_DIR/commands"
    mkdir -p "$CLAUDE_CONFIG_DIR/agents"
    mkdir -p "$CLAUDE_CONFIG_DIR/output-styles"
    
    # Copy configuration templates from this repository
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -d "$script_dir/.claude" ]; then
        cp -r "$script_dir/.claude"/* "$CLAUDE_CONFIG_DIR/"
        success "Configuration templates deployed successfully"
    else
        warn "Configuration templates not found in $script_dir/.claude"
        warn "Creating minimal configuration..."
        create_minimal_config
    fi
}

# Create minimal configuration if templates are not available
create_minimal_config() {
    # Create basic settings.json
    cat > "$CLAUDE_CONFIG_DIR/settings.json" << 'EOF'
{
    "name": "Claude Code Kit Configuration",
    "description": "Basic configuration for Claude Code",
    "version": "1.0.0",
    "apiSettings": {
        "timeout": 3000000
    }
}
EOF

    # Create basic CLAUDE.md
    cat > "$CLAUDE_CONFIG_DIR/CLAUDE.md" << 'EOF'
# Claude Code Configuration

This is a basic configuration for Claude Code.

## Environment Variables
- `ANTHROPIC_API_KEY`: Your API key
- `ANTHROPIC_BASE_URL`: API base URL (optional)
EOF

    success "Minimal configuration created"
}

# Setup Claude Code Kit directories
setup_cc_config_directory() {
    info "Setting up Claude Code Kit directories..."
    
    mkdir -p "$CLAUDE_CODE_KIT_DIR"
    mkdir -p "$PROVIDERS_DIR"
    mkdir -p "$BACKUPS_DIR"
    
    # Create history file
    cat > "$CLAUDE_CODE_KIT_DIR/history.json" << EOF
{
    "version": "1.0",
    "backups": []
}
EOF
    
    success "Claude Code Kit directories created"
}

# Configure default provider
configure_default_provider() {
    info "Configuring default provider..."
    
    echo
    echo "Please provide your Anthropic API configuration:"
    
    # Get API Key
    while true; do
        echo -n "API Key: "
        read -s api_key
        echo
        
        if [ -n "$api_key" ]; then
            break
        else
            warn "API Key cannot be empty. Please try again."
        fi
    done
    
    # Get Base URL (optional)
    echo -n "Base URL (press Enter for default: https://api.anthropic.com): "
    read base_url
    
    if [ -z "$base_url" ]; then
        base_url="https://api.anthropic.com"
    fi
    
    # Create default provider configuration
    cat > "$PROVIDERS_DIR/default.json" << EOF
{
    "alias": "claude",
    "baseURL": "$base_url",
    "apiKey": "$api_key",
    "timeout": "3000000"
}
EOF
    
    success "Default provider configured"
}

# Ask about additional provider
configure_additional_provider() {
    echo
    echo -n "Would you like to add an additional provider? (y/N): "
    read -r add_provider
    
    if [[ "$add_provider" =~ ^[Yy]$ ]]; then
        echo -n "Provider alias (e.g., 'cc'): "
        read alias
        
        echo -n "API Key: "
        read -s api_key
        echo
        
        echo -n "Base URL: "
        read base_url
        
        if [ -n "$alias" ] && [ -n "$api_key" ] && [ -n "$base_url" ]; then
            cat > "$PROVIDERS_DIR/$alias.json" << EOF
{
    "alias": "$alias",
    "baseURL": "$base_url", 
    "apiKey": "$api_key",
    "timeout": "3000000"
}
EOF
            success "Additional provider '$alias' configured"
        else
            warn "Skipping additional provider due to missing information"
        fi
    fi
}

# Generate shell aliases
generate_aliases() {
    info "Generating shell aliases..."
    
    cat > "$ALIASES_FILE" << 'EOF'
# Claude Code Kit - Auto-generated aliases
# This file is automatically generated. Do not edit manually.

_load_claude_config() {
    local config_file="$1"
    if [ -f "$config_file" ]; then
        export ANTHROPIC_AUTH_TOKEN=$(jq -r ".apiKey" "$config_file")
        export ANTHROPIC_BASE_URL=$(jq -r ".baseURL" "$config_file")
        export API_TIMEOUT_MS=$(jq -r ".timeout // \"3000000\"" "$config_file")
    fi
}

EOF
    
    # Add aliases for each provider
    for provider_file in "$PROVIDERS_DIR"/*.json; do
        if [ -f "$provider_file" ]; then
            local alias_name
            alias_name=$(jq -r ".alias" "$provider_file")
            echo "alias $alias_name='_load_claude_config \"$provider_file\" && claude'" >> "$ALIASES_FILE"
        fi
    done
    
    success "Shell aliases generated"
}

# Detect shell type
detect_shell() {
    if [ -n "${ZSH_VERSION:-}" ]; then
        echo "zsh"
    elif [ -n "${BASH_VERSION:-}" ]; then
        echo "bash"
    else
        echo "unknown"
    fi
}

# Setup shell integration
setup_shell_integration() {
    local shell_type
    shell_type=$(detect_shell)
    
    info "Setting up shell integration for $shell_type..."
    
    local shell_config
    case "$shell_type" in
        "zsh")
            shell_config="$HOME/.zshrc"
            ;;
        "bash")
            shell_config="$HOME/.bashrc"
            ;;
        *)
            warn "Unknown shell type. Please manually add the following to your shell configuration:"
            echo "source $ALIASES_FILE"
            return
            ;;
    esac
    
    # Check if aliases are already sourced
    if ! grep -q "source $ALIASES_FILE" "$shell_config" 2>/dev/null; then
        echo "" >> "$shell_config"
        echo "# Claude Code Kit aliases" >> "$shell_config"
        echo "source $ALIASES_FILE" >> "$shell_config"
        success "Shell integration added to $shell_config"
    else
        info "Shell integration already exists in $shell_config"
    fi
}

# Install cc-config tool
install_cc_config_tool() {
    info "Installing cc-config tool..."
    
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Install Node.js dependencies if package.json exists
    if [ -f "$script_dir/package.json" ]; then
        cd "$script_dir"
        npm install
        
        # Create global symlink for cc-config
        npm link
        success "cc-config tool installed globally"
    else
        warn "cc-config tool not available in this installation"
    fi
}

# Check system dependencies with enhanced detection and installation
check_dependencies() {
    info "Checking system dependencies..."
    local missing_deps=()
    local optional_missing=()
    
    # Critical dependencies
    if ! command_exists curl && ! command_exists wget; then
        missing_deps+=("curl or wget")
    fi
    
    # Check for package managers (for jq installation)
    local package_manager=""
    if command_exists brew; then
        package_manager="brew"
    elif command_exists apt-get; then
        package_manager="apt-get"
    elif command_exists yum; then
        package_manager="yum"
    elif command_exists dnf; then
        package_manager="dnf"
    elif command_exists zypper; then
        package_manager="zypper"
    elif command_exists pacman; then
        package_manager="pacman"
    fi
    
    # Check for jq
    if ! command_exists jq; then
        if [ -n "$package_manager" ]; then
            info "Installing jq for JSON processing using $package_manager..."
            
            case "$package_manager" in
                "brew")
                    brew install jq || optional_missing+=("jq")
                    ;;
                "apt-get")
                    sudo apt-get update && sudo apt-get install -y jq || optional_missing+=("jq")
                    ;;
                "yum")
                    sudo yum install -y jq || optional_missing+=("jq")
                    ;;
                "dnf")
                    sudo dnf install -y jq || optional_missing+=("jq")
                    ;;
                "zypper")
                    sudo zypper install -y jq || optional_missing+=("jq")
                    ;;
                "pacman")
                    sudo pacman -S --noconfirm jq || optional_missing+=("jq")
                    ;;
            esac
        else
            optional_missing+=("jq")
        fi
    fi
    
    # Check other useful tools
    if ! command_exists git; then
        debug "Git not found - some features may be limited"
    fi
    
    # Report missing critical dependencies
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing critical dependencies: ${missing_deps[*]}"
    fi
    
    # Report missing optional dependencies
    if [ ${#optional_missing[@]} -gt 0 ]; then
        warn "Missing optional dependencies: ${optional_missing[*]}"
        warn "Some features may not work properly. Please install them manually."
    fi
    
    # Check write permissions
    local test_dirs=("$HOME" "/tmp")
    for dir in "${test_dirs[@]}"; do
        if [ ! -w "$dir" ]; then
            error "No write permission to $dir. Please check your permissions."
        fi
    done
    
    # Check disk space (at least 100MB)
    local available_space
    if command_exists df; then
        available_space=$(df "$HOME" | awk 'NR==2 {print $4}')
        if [ "$available_space" -lt 102400 ]; then  # 100MB in KB
            warn "Low disk space detected. At least 100MB free space is recommended."
        fi
    fi
    
    success "System dependencies check completed"
}

# Main installation function
main() {
    echo "=================================================="
    echo "      Claude Code Kit Installation Script"
    echo "=================================================="
    echo
    
    info "Starting Claude Code Kit installation..."
    
    # Check dependencies first
    check_dependencies
    
    # Main installation steps
    check_nodejs_version
    install_claude_code
    setup_cc_config_directory
    backup_existing_config
    deploy_configurations
    configure_default_provider
    configure_additional_provider
    generate_aliases
    setup_shell_integration
    install_cc_config_tool
    
    echo
    echo "=================================================="
    success "Claude Code Kit installation completed!"
    echo "=================================================="
    echo
    info "Next steps:"
    echo "  1. Restart your terminal or run: source ~/.zshrc (or ~/.bashrc)"
    echo "  2. Test installation: claude --version"
    echo "  3. Use your configured aliases (e.g., 'claude \"Hello\"')"
    echo "  4. Manage providers with: cc-config provider list"
    echo
    info "For help and documentation, visit:"
    echo "  https://github.com/kedoupi/claude-code-kit"
    echo
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi