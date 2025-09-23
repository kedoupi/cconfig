#!/bin/bash
# CConfig 仓库初始化脚本（开发环境）

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track whether shell integration existed before this run (to detect first setup)
WAS_INTEGRATED_BEFORE=0

log() {
    case "$1" in
        INFO) echo -e "${BLUE}ℹ️  $2${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $2${NC}" ;;
        WARN) echo -e "${YELLOW}⚠️  $2${NC}" ;;
        ERROR) echo -e "${RED}❌ $2${NC}"; exit 1 ;;
    esac
}

# Check if in project directory
check_project_directory() {
    if [[ ! -f "package.json" || ! -f "bin/cconfig.js" ]]; then
        log ERROR "请在 CConfig 项目根目录运行此脚本"
    fi
    log SUCCESS "项目目录已验证"
}

# Check dependencies
check_dependencies() {
    log INFO "正在检查系统依赖..."
    
    if ! command -v node >/dev/null 2>&1; then
        log ERROR "需要安装 Node.js： https://nodejs.org/"
    fi
    
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [[ "$node_version" -lt 18 ]]; then
        log ERROR "需要 Node.js 18+，当前版本：v$node_version"
    fi
    
    log SUCCESS "Node.js $(node --version) ✓"
    
    if ! command -v npm >/dev/null 2>&1; then
        log ERROR "需要安装 npm"
    fi
    log SUCCESS "依赖检查通过"
}

# Install project dependencies
install_dependencies() {
    log INFO "正在安装项目依赖..."
    
    if [[ ! -d "node_modules" ]]; then
        npm install || log ERROR "依赖安装失败"
        log SUCCESS "依赖安装完成"
    else
        log SUCCESS "依赖已安装"
    fi
}

# Install CLI tools
install_cli_tools() {
    log INFO "正在安装 CLI 工具..."
    
    # Claude CLI
    if ! command -v claude >/dev/null 2>&1; then
        log INFO "正在安装 Claude CLI..."
        npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 || log ERROR "Claude CLI 安装失败"
        log SUCCESS "Claude CLI 安装完成"
    else
        log SUCCESS "已安装 Claude CLI"
    fi
    
    # Optional tools
    for tool in jq; do
        if command -v "$tool" >/dev/null 2>&1; then
            log SUCCESS "$tool 已安装"
        else
            log WARN "未找到 $tool（推荐安装以获得更好体验）"
        fi
    done
}

# Detect shell config
detect_shell_config() {
    case "${SHELL##*/}" in
        zsh) echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
        bash)
            if [[ "$OSTYPE" == "darwin"* ]] && [[ -f "$HOME/.bash_profile" ]]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        fish) echo "$HOME/.config/fish/config.fish" ;;
        *) echo "$HOME/.profile" ;;
    esac
}

# Install shell integration file for development
install_dev_shell_integration() {
    local config_dir="$HOME/.cconfig"
    local integration_file="$config_dir/cconfig.sh"
    local project_dir="$(pwd)"

    # Create config directory
    mkdir -p "$config_dir"

    # Copy shell integration file
    cp "./cconfig.sh" "$integration_file"

    # Record development installation path
    echo "$project_dir" > "$config_dir/.dev_install"

    log SUCCESS "开发环境Shell集成文件已安装"
}

# Setup shell integration
setup_shell_integration() {
    local shell_config
    local integration_file="$HOME/.cconfig/cconfig.sh"
    shell_config="$(detect_shell_config)"

    # 验证路径安全性
    if [[ ! "$shell_config" =~ ^/[a-zA-Z0-9/_.-]+$ ]]; then
        log ERROR "Invalid shell config path detected"
        return 1
    fi

    log INFO "正在配置 Shell 集成到 $(basename "$shell_config")"

    # Remove old configuration
    if [[ -f "$shell_config" ]] && grep -q "# CConfig Integration" "$shell_config" 2>/dev/null; then
        WAS_INTEGRATED_BEFORE=1
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '.bak' '/# CConfig Integration/,/# End CConfig Integration/d' "$shell_config"
        else
            sed -i.bak '/# CConfig Integration/,/# End CConfig Integration/d' "$shell_config"
        fi
        log INFO "已移除旧的集成配置"
    fi

    # Add new simplified configuration
    cat >> "$shell_config" << EOF

# CConfig Integration
[[ -f "$integration_file" ]] && source "$integration_file"
# End CConfig Integration
EOF

    log SUCCESS "Shell 集成配置完成"
}

# Prompt on first setup if no provider configured yet
check_and_prompt_initial_config() {
    local config_dir="$HOME/.cconfig"
    local providers_dir="$config_dir/providers"
    # 在开发环境下，只要未配置任何 Provider，就提示一次
    if [[ ! -d "$providers_dir" ]] || ! ls -1 "$providers_dir"/*.json >/dev/null 2>&1; then
        echo
        log INFO "未检测到任何 API 端点配置"
        echo "💡 现在可运行以下命令添加 Provider:"
        echo "   cconfig add"
    fi
}

# Run tests
run_tests() {
    log INFO "正在运行测试..."
    if npm test >/dev/null 2>&1; then
        log SUCCESS "全部测试通过"
    else
        log WARN "部分测试失败（开发环境仍可能可用）"
    fi
}

# Create development marker
create_dev_marker() {
    echo "$(date): CConfig 开发环境初始化" > .cconfig_dev_install
    log SUCCESS "已标记开发安装"
}

# Main setup
main() {
    echo
    echo "🔧 CConfig 仓库初始化"
    echo "======================"
    echo
    
    check_project_directory
    check_dependencies
    install_dependencies
    install_cli_tools
    install_dev_shell_integration
    setup_shell_integration
    check_and_prompt_initial_config
    run_tests
    create_dev_marker
    
    echo
    log SUCCESS "仓库初始化完成！"
    echo
    echo "🔄 重新加载 Shell："
    echo "   source $(detect_shell_config | sed "s|$HOME|~|g")"
    echo
    echo "🚀 开发常用命令："
    echo "   cconfig add              # 添加 Provider"
    echo "   cconfig list             # 列出 Provider"
    echo "   claude \"Hello!\"          # 与 Claude 对话"
    echo "   claude -P custom \"Hi\"    # 使用指定 Provider"
    echo "   claude --pp \"Quick\"      # 跳过权限检查"
    echo
    echo "🧪 开发："
    echo "   npm test                 # 运行测试"
    echo "   npm run lint             # 代码检查"
    echo "   npm run reset            # 清理并重装依赖"
    echo
}

main "$@"
