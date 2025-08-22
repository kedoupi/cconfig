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
    echo -e "${BLUE}🔹 [INFO]${NC} $1"
    log_with_timestamp "INFO" "$1"
}

success() {
    echo -e "${GREEN}✅ [SUCCESS]${NC} $1"
    log_with_timestamp "SUCCESS" "$1"
}

warn() {
    echo -e "${YELLOW}⚠️  [WARN]${NC} $1"
    log_with_timestamp "WARN" "$1"
}

error() {
    echo -e "${RED}❌ [ERROR]${NC} $1"
    log_with_timestamp "ERROR" "$1"
    ROLLBACK_NEEDED=true
    cleanup_and_exit 1
}

debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo -e "${NC}🔍 [DEBUG]${NC} $1"
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

# Installation progress tracking
CURRENT_STEP=0
TOTAL_STEPS=10

# Progress indicator function
step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local title="$1"
    echo
    echo -e "${BLUE}📋 Step $CURRENT_STEP/$TOTAL_STEPS:${NC} $title"
    echo -e "${BLUE}$(printf '━%.0s' $(seq 1 $CURRENT_STEP))$(printf '─%.0s' $(seq 1 $((TOTAL_STEPS - CURRENT_STEP))))${NC} ($((CURRENT_STEP * 100 / TOTAL_STEPS))%)"
}

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

# Deploy configuration templates using unified update mechanism
deploy_configurations() {
    info "Deploying configuration templates..."
    
    # Create base directory
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Try to use cc-config update for unified deployment
    if deploy_via_cc_config_update; then
        success "Configuration deployed successfully via cc-config update"
        return
    fi
    
    # Fallback: use local templates if cc-config update fails
    warn "Falling back to local configuration deployment..."
    deploy_local_templates
}

# Deploy configurations using cc-config update (unified mechanism)
deploy_via_cc_config_update() {
    # Check if cc-config is available
    if ! command_exists cc-config; then
        debug "cc-config not available yet, skipping unified deployment"
        return 1
    fi
    
    # Check network connectivity
    if ! check_network_connectivity; then
        debug "No network connectivity, skipping remote deployment"
        return 1
    fi
    
    info "Using cc-config update for configuration deployment..."
    
    # Set development mode to use local source if available
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -d "$script_dir/.claude" ]; then
        export CC_DEV_MODE=true
        debug "Development mode enabled - using local .claude source"
    fi
    
    # Execute cc-config update with force flag for initial deployment
    if cc-config update --force 2>/dev/null; then
        # List deployed components
        list_deployed_components
        return 0
    else
        warn "cc-config update failed, will use fallback method"
        return 1
    fi
}

# Check network connectivity to GitHub
check_network_connectivity() {
    info "Checking network connectivity..."
    
    # Try to ping GitHub (timeout 5 seconds)
    if command_exists curl; then
        if curl -s --connect-timeout 5 --max-time 10 https://github.com >/dev/null 2>&1; then
            debug "Network connectivity confirmed via curl"
            return 0
        fi
    elif command_exists wget; then
        if wget --spider --timeout=5 --tries=1 https://github.com >/dev/null 2>&1; then
            debug "Network connectivity confirmed via wget"
            return 0
        fi
    elif command_exists ping; then
        if ping -c 1 -W 5 github.com >/dev/null 2>&1; then
            debug "Network connectivity confirmed via ping"
            return 0
        fi
    fi
    
    debug "Network connectivity check failed"
    return 1
}

# Deploy local templates (fallback method)
deploy_local_templates() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Create subdirectories
    mkdir -p "$CLAUDE_CONFIG_DIR/commands"
    mkdir -p "$CLAUDE_CONFIG_DIR/agents"
    mkdir -p "$CLAUDE_CONFIG_DIR/output-styles"
    
    # Try multiple sources for configuration templates
    local template_source=""
    
    # 1. Try script directory (for development)
    if [ -d "$script_dir/.claude" ]; then
        template_source="$script_dir/.claude"
        info "Found configuration templates in script directory"
    else
        # 2. Try npm global package (most common case for users)
        template_source=$(get_npm_package_template_path)
        if [ -n "$template_source" ] && [ -d "$template_source" ]; then
            info "Found configuration templates in npm package"
        else
            # 3. Last resort: create minimal config
            warn "No configuration templates found anywhere"
            warn "Creating minimal configuration..."
            create_minimal_config
            return
        fi
    fi
    
    # Deploy the templates
    if [ -n "$template_source" ]; then
        cp -r "$template_source"/* "$CLAUDE_CONFIG_DIR/"
        success "Configuration templates deployed successfully from $(basename "$(dirname "$template_source")")"
        
        # List deployed components
        list_deployed_components
    fi
}

# Get npm package template path
get_npm_package_template_path() {
    # Try to find the npm package location
    local npm_global_root
    local package_path
    
    # Method 1: Use npm root -g
    if command_exists npm; then
        npm_global_root=$(npm root -g 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$npm_global_root" ]; then
            package_path="$npm_global_root/@kedoupi/claude-code-kit/.claude"
            if [ -d "$package_path" ]; then
                echo "$package_path"
                return 0
            fi
        fi
    fi
    
    # Method 2: Try common npm global locations
    local common_paths=(
        "/usr/local/lib/node_modules/@kedoupi/claude-code-kit/.claude"
        "$HOME/.npm-global/lib/node_modules/@kedoupi/claude-code-kit/.claude"
        "/usr/lib/node_modules/@kedoupi/claude-code-kit/.claude"
    )
    
    # Add NVM paths if they exist
    if [ -n "${NVM_DIR:-}" ]; then
        local nvm_current_version
        nvm_current_version=$(node --version 2>/dev/null | sed 's/v//')
        if [ -n "$nvm_current_version" ]; then
            common_paths+=(
                "$NVM_DIR/versions/node/v$nvm_current_version/lib/node_modules/@kedoupi/claude-code-kit/.claude"
            )
        fi
    fi
    
    for path in "${common_paths[@]}"; do
        if [ -d "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    # Method 3: Try to use which cc-config to find installation path
    if command_exists cc-config; then
        local cc_config_path
        cc_config_path=$(which cc-config 2>/dev/null)
        if [ -n "$cc_config_path" ]; then
            # cc-config is usually at: /path/to/node_modules/@kedoupi/claude-code-kit/bin/cc-config.js
            local package_root
            package_root=$(dirname "$(dirname "$cc_config_path")")"/.claude"
            if [ -d "$package_root" ]; then
                echo "$package_root"
                return 0
            fi
        fi
    fi
    
    return 1
}

# List deployed components
list_deployed_components() {
    info "Deployed components:"
    if [ -d "$CLAUDE_CONFIG_DIR/agents" ]; then
        local agent_count
        agent_count=$(ls "$CLAUDE_CONFIG_DIR/agents" | wc -l | tr -d ' ')
        echo "  • $agent_count agent definitions"
    fi
    if [ -d "$CLAUDE_CONFIG_DIR/commands" ]; then
        local command_count
        command_count=$(ls "$CLAUDE_CONFIG_DIR/commands" | wc -l | tr -d ' ')
        echo "  • $command_count command templates"
    fi
    if [ -d "$CLAUDE_CONFIG_DIR/output-styles" ]; then
        local style_count
        style_count=$(ls "$CLAUDE_CONFIG_DIR/output-styles" | wc -l | tr -d ' ')
        echo "  • $style_count output styles"
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

# Skip provider configuration during installation
configure_default_provider() {
    echo
    echo -e "${BLUE}🔑 Provider Configuration${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}📋 Provider setup will be handled after installation.${NC}"
    echo
    echo -e "${BLUE}After installation completes, you'll use:${NC}"
    echo "  cc-config provider add"
    echo
    echo -e "${YELLOW}💡 To get your API key:${NC}"
    echo "  1. Visit: https://console.anthropic.com/"
    echo "  2. Sign up or log in to your account" 
    echo "  3. Go to API Keys section"
    echo "  4. Create a new API key"
    echo
    
    info "Provider configuration will be done post-installation"
}

# Skip additional provider configuration during installation
configure_additional_provider() {
    echo
    echo -e "${BLUE}🔧 Post-Installation Setup${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}📋 Providers will be configured after installation.${NC}"
    echo
    echo -e "${BLUE}Commands you'll use:${NC}"
    echo "  cc-config provider add          # Add your first provider"
    echo "  cc-config provider list         # List all providers"
    echo "  cc-config provider show <alias> # View provider details"
    echo
    
    info "All provider management will be done through cc-config commands"
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

# Detect shell type with multiple methods
detect_shell() {
    # Method 1: Check environment variables
    if [ -n "${ZSH_VERSION:-}" ]; then
        echo "zsh"
        return
    elif [ -n "${BASH_VERSION:-}" ]; then
        echo "bash"
        return
    fi
    
    # Method 2: Check SHELL variable
    case "${SHELL:-}" in
        */zsh)
            echo "zsh"
            return
            ;;
        */bash)
            echo "bash"
            return
            ;;
    esac
    
    # Method 3: Check current process
    if ps -p $$ -o comm= | grep -q zsh; then
        echo "zsh"
        return
    elif ps -p $$ -o comm= | grep -q bash; then
        echo "bash"
        return
    fi
    
    # Default fallback
    echo "unknown"
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

# Install cc-config tool from npm
install_cc_config_tool() {
    info "Installing cc-config tool from npm..."
    
    # Install from npm registry (production installation)
    local install_attempts=0
    local max_attempts=3
    
    while [ $install_attempts -lt $max_attempts ]; do
        install_attempts=$((install_attempts + 1))
        debug "cc-config installation attempt $install_attempts of $max_attempts"
        
        if npm install -g @kedoupi/claude-code-kit; then
            success "cc-config tool installed globally from npm"
            break
        else
            if [ $install_attempts -eq $max_attempts ]; then
                error "Failed to install cc-config tool after $max_attempts attempts"
            else
                warn "Installation attempt $install_attempts failed. Retrying..."
                sleep 2
            fi
        fi
    done
    
    # Verify installation
    if command_exists cc-config; then
        local cc_version
        cc_version=$(cc-config --version 2>/dev/null || echo "unknown")
        success "cc-config tool verified successfully"
        info "cc-config version: $cc_version"
        debug "cc-config location: $(which cc-config)"
    else
        error "cc-config tool installation verification failed"
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
    echo "🚀 =================================================="
    echo "      Claude Code Kit Installation Script"
    echo "      Version 2.0.0 - Production Ready"
    echo "=================================================="
    echo
    
    info "Welcome to Claude Code Kit installation!"
    echo -e "${BLUE}📦 What will be installed:${NC}"
    echo "  • Claude Code CLI (latest version)"
    echo "  • Configuration management tools"
    echo "  • Multi-provider support"
    echo "  • Shell integration and aliases"
    echo
    
    # Installation steps with progress indicators
    step "Checking system dependencies"
    check_dependencies
    
    step "Verifying Node.js installation"
    check_nodejs_version
    
    step "Installing Claude Code CLI"
    install_claude_code
    
    step "Installing cc-config management tool"
    install_cc_config_tool
    
    step "Setting up configuration directories"
    setup_cc_config_directory
    
    step "Creating backup of existing config"
    backup_existing_config
    
    step "Deploying configuration templates"
    deploy_configurations
    
    step "Preparing provider configuration"
    configure_default_provider
    
    step "Setting up post-installation guide"
    configure_additional_provider
    
    step "Generating shell aliases"
    generate_aliases
    
    step "Configuring shell integration"
    setup_shell_integration
    
    echo
    echo "🎉 =================================================="
    success "Claude Code Kit installation completed successfully!"
    echo "=================================================="
    echo
    echo -e "${GREEN}✨ What's ready for you:${NC}"
    echo "  ✅ Claude Code CLI is installed and configured"
    echo "  ✅ Shell aliases are ready to use"
    echo "  ✅ Provider management system is active"
    echo "  ✅ Automatic backups are enabled"
    echo
    echo -e "${BLUE}🚀 Next steps:${NC}"
    echo "  1️⃣  Restart your terminal or run: source ~/.zshrc (or ~/.bashrc)"
    echo "  2️⃣  Add your first API provider: cc-config provider add"
    echo "  3️⃣  Test installation: cc-config status"
    echo "  4️⃣  Start chatting with your alias: <your-alias> \"Hello, Claude!\""
    echo
    echo -e "${BLUE}📚 Need help?${NC}"
    echo "  🌐 Documentation: https://github.com/kedoupi/claude-code-kit"
    echo "  🐛 Report issues: https://github.com/kedoupi/claude-code-kit/issues"
    echo "  💬 Get support: Read the docs/user-guide.md"
    echo
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi