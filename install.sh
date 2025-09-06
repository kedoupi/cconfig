#!/bin/bash

# CCVM (Claude Code Version Manager) - 优化安装脚本
# 版本通过 package.json 动态获取

set -euo pipefail

# ============================================================================
# 配置和常量
# ============================================================================

readonly CLAUDE_DIR="${HOME}/.claude"
readonly CCVM_DIR="${CLAUDE_DIR}/ccvm"
readonly GITHUB_REPO="kedoupi/ccvm"
readonly GITHUB_BRANCH="${CCVM_BRANCH:-main}"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$PWD}")" && pwd)"

# 颜色定义
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# ============================================================================
# 日志函数
# ============================================================================

log() {
    local level=$1
    shift
    case "$level" in
        INFO)  echo -e "${BLUE}🔹 [信息]${NC} $*" ;;
        SUCCESS) echo -e "${GREEN}✅ [成功]${NC} $*" ;;
        WARN)  echo -e "${YELLOW}⚠️  [警告]${NC} $*" ;;
        ERROR) echo -e "${RED}❌ [错误]${NC} $*"; exit 1 ;;
        *)     echo "$*" ;;
    esac
}

# ============================================================================
# 工具函数
# ============================================================================

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_version() {
    local cmd=$1
    local version_output
    
    # 获取版本输出
    version_output=$($cmd --version 2>/dev/null) || echo ""
    
    if [[ -z "$version_output" ]]; then
        echo "unknown"
        return
    fi
    
    # 提取版本号（支持多种格式）
    # 格式1: 1.0.100 (Claude Code)
    # 格式2: ccline 1.0.4
    # 格式3: v1.0.0 或 1.0.0
    echo "$version_output" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown"
}

detect_mode() {
    # When run via curl | bash, SCRIPT_DIR will be PWD, so check for dev files there
    if [[ -f "${SCRIPT_DIR}/bin/ccvm.js" && -f "${SCRIPT_DIR}/package.json" ]]; then
        echo "dev"
    else
        echo "prod"
    fi
}

detect_shell_config() {
    local shell_name=$(basename "${SHELL:-/bin/bash}")
    
    case "$shell_name" in
        zsh)  echo "${HOME}/.zshrc" ;;
        bash)
            if [[ "${OSTYPE:-}" == "darwin"* ]]; then
                echo "${HOME}/.bash_profile"
            else
                echo "${HOME}/.bashrc"
            fi
            ;;
        fish) echo "${HOME}/.config/fish/config.fish" ;;
        *)    echo "${HOME}/.profile" ;;
    esac
}

is_interactive() {
    [[ -t 0 && -t 1 ]]
}

backup_directory() {
    local src=$1
    local backup_base=$2
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${backup_base}_${timestamp}"
    
    if [[ -d "$src" ]]; then
        cp -r "$src" "$backup_dir"
        log INFO "已备份到: $backup_dir"
        echo "$backup_dir"
    fi
}

# ============================================================================
# 依赖检查
# ============================================================================

check_node_version() {
    if ! command_exists node; then
        log ERROR "需要 Node.js 18+。请访问: https://nodejs.org/"
    fi
    
    local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [[ "$node_version" -lt 18 ]]; then
        log ERROR "Node.js 版本过低 (v$node_version)，需要 v18+"
    fi
    
    log SUCCESS "Node.js $(node --version) 符合要求"
}

check_dependencies() {
    log INFO "检查系统依赖..."
    
    check_node_version
    
    local mode=$(detect_mode)
    if [[ "$mode" == "prod" ]]; then
        if ! command_exists git; then
            log ERROR "生产模式需要 git"
        fi
        
        if ! command_exists curl && ! command_exists wget; then
            log ERROR "需要 curl 或 wget"
        fi
    fi
    
    if ! command_exists jq; then
        log WARN "建议安装 jq 以获得更好的体验"
    fi
}

# ============================================================================
# 配置迁移
# ============================================================================

migrate_old_config() {
    # 迁移旧的 ~/.ccvm 到新位置
    if [[ -d "${HOME}/.ccvm" && ! -d "$CCVM_DIR" ]]; then
        log INFO "迁移旧配置 ~/.ccvm -> ~/.claude/ccvm..."
        
        mkdir -p "$CCVM_DIR"
        cp -r "${HOME}/.ccvm/"* "$CCVM_DIR/" 2>/dev/null || true
        
        local old_backup=$(backup_directory "${HOME}/.ccvm" "${HOME}/.ccvm_backup")
        rm -rf "${HOME}/.ccvm"
        
        log SUCCESS "配置已迁移，旧配置备份至: $old_backup"
    fi
}

backup_existing_config() {
    if [[ -d "$CLAUDE_DIR" && ! -f "$CCVM_DIR/.installed_by_ccvm" ]]; then
        local backup_dir="$CCVM_DIR/claude_backup/$(date +%Y%m%d_%H%M%S)"
        
        log INFO "备份现有 Claude 配置..."
        mkdir -p "$backup_dir"
        
        for item in "$CLAUDE_DIR"/*; do
            if [[ -e "$item" && "$(basename "$item")" != "ccvm" ]]; then
                cp -r "$item" "$backup_dir/" 2>/dev/null || true
            fi
        done
        
        log SUCCESS "已备份到: $backup_dir"
    fi
}

install_claude_config() {
    local source_claude_dir=$1
    
    if [[ ! -d "$source_claude_dir" ]]; then
        log INFO "未找到 Claude 配置模板目录，跳过配置安装"
        return 0
    fi
    
    log INFO "安装 Claude Code 增强配置 (agents, commands, settings)..."
    
    # 确保 ~/.claude 目录存在
    mkdir -p "$CLAUDE_DIR"
    
    # 复制 .claude 目录内容到 ~/.claude/
    for item in "$source_claude_dir"/*; do
        if [[ -e "$item" ]]; then
            local item_name=$(basename "$item")
            local target_path="$CLAUDE_DIR/$item_name"
            
            if [[ -e "$target_path" ]]; then
                log INFO "合并配置: $item_name"
                if [[ -d "$item" ]]; then
                    # 对于目录，创建目录并复制内容
                    mkdir -p "$target_path"
                    # 检查目录是否有内容再复制
                    if [[ -n $(find "$item" -mindepth 1 -maxdepth 1 2>/dev/null) ]]; then
                        cp -r "$item"/* "$target_path/" 2>/dev/null || true
                    fi
                else
                    # 对于文件，直接覆盖（已经做了备份）
                    cp "$item" "$target_path" 2>/dev/null || true
                fi
            else
                # 新文件/目录直接复制
                cp -r "$item" "$CLAUDE_DIR/" 2>/dev/null || true
                log INFO "已安装: $item_name"
            fi
        fi
    done
    
    log SUCCESS "Claude Code 增强配置已安装到 ~/.claude/ (包含 agents, commands, context 等)"
}

# ============================================================================
# 核心安装
# ============================================================================

# 备份和恢复函数已简化，因为不再需要
# 生产模式现在只更新代码文件，自动保留用户配置

install_dev_mode() {
    log INFO "开发模式：链接到 $SCRIPT_DIR"
    
    echo "$SCRIPT_DIR" > "$CCVM_DIR/dev_path"
    
    # 安装 Claude Code 增强配置
    install_claude_config "$SCRIPT_DIR/claude-templates"
    
    log INFO "安装开发依赖..."
    (cd "$SCRIPT_DIR" && npm install --loglevel=error >/dev/null 2>&1) && log SUCCESS "依赖已安装" || log WARN "依赖安装失败"
}

install_prod_mode() {
    log INFO "生产模式：从 GitHub 更新..."
    
    local temp_dir="${CCVM_DIR}.tmp.$$"
    
    if git clone "https://github.com/${GITHUB_REPO}.git" "$temp_dir"; then
        (cd "$temp_dir" && git checkout "$GITHUB_BRANCH" 2>/dev/null || true)
        
        # 确保目标目录存在
        mkdir -p "$CCVM_DIR"
        
        # 只更新代码文件，保留用户配置
        log INFO "更新代码文件..."
        
        # 要更新的目录和文件列表（移除 .claude，单独处理）
        local update_items=("bin" "src" "tests" "tools" "package.json" "package-lock.json" "README.md" "LICENSE")
        
        for item in "${update_items[@]}"; do
            if [[ -e "$temp_dir/$item" ]]; then
                # 如果是目录，先删除旧的再复制新的
                if [[ -d "$temp_dir/$item" ]]; then
                    rm -rf "$CCVM_DIR/$item" 2>/dev/null || true
                fi
                cp -r "$temp_dir/$item" "$CCVM_DIR/" 2>/dev/null || true
                log INFO "已更新: $item"
            fi
        done
        
        # 安装 Claude Code 增强配置
        install_claude_config "$temp_dir/claude-templates"
        
        # 清理临时目录
        rm -rf "$temp_dir"
        
        log INFO "安装依赖..."
        (cd "$CCVM_DIR" && npm install --production --loglevel=error >/dev/null 2>&1) || \
            (cd "$CCVM_DIR" && npm install --loglevel=error >/dev/null 2>&1) || \
            log ERROR "依赖安装失败"
    else
        log ERROR "克隆仓库失败"
    fi
}

install_ccvm() {
    local mode=$(detect_mode)
    log INFO "安装模式: $mode"
    
    # 确保目录结构（不会覆盖已存在的配置）
    mkdir -p "$CLAUDE_DIR"
    mkdir -p "$CCVM_DIR/providers"
    mkdir -p "$CCVM_DIR/backups"
    mkdir -p "$CCVM_DIR/mcp"
    
    
    # 根据模式安装
    if [[ "$mode" == "dev" ]]; then
        install_dev_mode
    else
        install_prod_mode
    fi
    
    # 创建安装标记
    echo "$(date): CCVM installation" > "$CCVM_DIR/.installed_by_ccvm"
    
    log SUCCESS "CCVM 核心安装完成"
}

# ============================================================================
# Shell 配置
# ============================================================================

get_ccvm_bin_path() {
    if [[ -f "$CCVM_DIR/dev_path" ]]; then
        echo "$(cat "$CCVM_DIR/dev_path")/bin/ccvm.js"
    else
        echo "$CCVM_DIR/bin/ccvm.js"
    fi
}

create_shell_functions() {
    local shell_config=$(detect_shell_config)
    local ccvm_bin=$(get_ccvm_bin_path)
    
    log INFO "配置 shell 函数: $(basename "$shell_config")"
    
    # 清理旧配置
    if [[ -f "$shell_config" ]] && grep -q "CCVM (Claude Code Version Manager)" "$shell_config"; then
        log INFO "清理旧配置..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '.bak' '/# CCVM (Claude Code Version Manager)/,$d' "$shell_config"
        else
            sed -i.bak '/# CCVM (Claude Code Version Manager)/,$d' "$shell_config"
        fi
    fi
    
    # 添加新配置
    cat >> "$shell_config" << 'EOF'

# CCVM (Claude Code Version Manager)
ccvm() {
    node "CCVM_BIN_PATH" "$@"
}

claude() {
    # Parse temporary provider and arguments
    local provider=""
    local args=()
    
    # Argument parsing loop
    while [[ $# -gt 0 ]]; do
        case $1 in
            -P|--provider)
                if [[ -z "$2" || "$2" =~ ^- ]]; then
                    echo "❌ 错误: -P/--provider 需要指定 Provider 名称" >&2
                    echo "💡 用法: claude -P <provider> <prompt>" >&2
                    return 1
                fi
                provider="$2"
                shift 2
                ;;
            --pp)
                # Handle --pp shortcut
                args+=("--dangerously-skip-permissions")
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # Load environment variables
    if [[ -n "$provider" ]]; then
        # Temporary provider mode
        eval "$(ccvm env --provider "$provider" 2>/dev/null)"
        local env_exit_code=$?
        if [[ $env_exit_code -ne 0 ]]; then
            echo "❌ 无法加载 Provider '$provider' 配置" >&2
            echo "💡 运行 'ccvm list' 查看可用的 Provider" >&2
            return 1
        fi
    else
        # Default provider mode
        eval "$(ccvm env 2>/dev/null)"
        if [[ $? -ne 0 ]]; then
            echo "❌ 无法加载 CCVM 配置" >&2
            echo "💡 运行: ccvm add" >&2
            return 1
        fi
    fi
    
    # Execute native claude command
    command claude "${args[@]}"
}
EOF
    
    # 替换路径占位符
    sed -i.tmp "s|CCVM_BIN_PATH|$ccvm_bin|g" "$shell_config"
    rm -f "${shell_config}.tmp"
    
    log SUCCESS "Shell 函数已配置"
}

# ============================================================================
# CLI 工具安装
# ============================================================================

install_npm_package() {
    local package=$1
    local cmd=${2:-$(echo "$package" | cut -d/ -f2 | cut -d@ -f1)}
    
    log INFO "检查 $cmd..."
    
    if command_exists "$cmd"; then
        local current_version
        current_version=$(get_version "$cmd") || current_version="unknown"
        log INFO "当前版本: ${current_version}，检查更新..."
        
        if npm update -g "$package" --silent >/dev/null 2>&1; then
            local new_version
            new_version=$(get_version "$cmd") || new_version="unknown"
            if [[ "${current_version}" != "${new_version}" ]]; then
                log SUCCESS "$cmd 已更新: ${current_version} → ${new_version}"
            else
                log SUCCESS "$cmd 已是最新版本: ${current_version}"
            fi
        else
            log WARN "$cmd 更新失败，当前版本: ${current_version}"
        fi
    else
        log INFO "安装 $cmd..."
        if npm install -g "$package" --silent >/dev/null 2>&1; then
            local installed_version
            installed_version=$(get_version "$cmd") || installed_version="已安装"
            log SUCCESS "$cmd 安装成功: ${installed_version}"
        else
            log WARN "$cmd 安装失败，可稍后手动安装: npm install -g $package"
            return 1
        fi
    fi
    
    return 0
}

install_cli_tools() {
    install_npm_package "@anthropic-ai/claude-code" "claude" || \
        log ERROR "Claude Code CLI 是必需的"
    
    install_npm_package "@cometix/ccline" "ccline" || true
    
    install_npm_package "ccusage" "ccusage" || true
}

# ============================================================================
# 初始配置
# ============================================================================

has_existing_providers() {
    local count=0
    
    if [[ -d "$CCVM_DIR/providers" ]]; then
        for file in "$CCVM_DIR/providers"/*.json; do
            [[ -f "$file" ]] && ((count++)) || true
        done
    fi
    
    [[ $count -gt 0 ]]
}

setup_first_provider() {
    if has_existing_providers; then
        log INFO "检测到现有 provider 配置，跳过初始设置"
        return 0
    fi
    
    if ! is_interactive; then
        log INFO "非交互式环境，跳过 provider 配置"
        echo
        echo "安装后请运行："
        echo "  1. source $(detect_shell_config | sed "s|$HOME|~|g")"
        echo "  2. ccvm add"
        return 0
    fi
    
    echo
    log INFO "配置第一个 provider..."
    echo -n "是否现在配置？[Y/n]: "
    read -r response
    
    if [[ "$response" =~ ^[Nn]$ ]]; then
        log INFO "跳过配置，稍后运行 'ccvm add'"
        return 0
    fi
    
    local ccvm_bin=$(get_ccvm_bin_path)
    if node "$ccvm_bin" add; then
        log SUCCESS "Provider 配置完成！"
        
        # 设置为默认
        local first_provider=$(ls -1 "$CCVM_DIR/providers"/*.json 2>/dev/null | head -1 | xargs basename | sed 's/\.json$//')
        if [[ -n "$first_provider" ]]; then
            node "$ccvm_bin" use "$first_provider" >/dev/null 2>&1 || true
            log SUCCESS "已设置默认 provider: $first_provider"
        fi
    fi
}

# ============================================================================
# 完成信息
# ============================================================================

show_completion() {
    local mode=$(detect_mode)
    local shell_config=$(detect_shell_config | sed "s|$HOME|~|g")
    
    echo
    echo "🎉 =================================================="
    log SUCCESS "CCVM 安装完成！"
    echo "=================================================="
    echo
    
    echo -e "${GREEN}✨ 已完成:${NC}"
    echo "  ✅ CCVM 核心 ($mode 模式)"
    echo "  ✅ Shell 函数 (ccvm + claude)"
    echo "  ✅ Claude Code CLI"
    echo "  ✅ ccusage (使用统计分析工具)"
    echo
    
    echo -e "${YELLOW}🔄 激活配置:${NC}"
    echo "  source $shell_config"
    echo
    
    echo -e "${BLUE}🚀 快速开始:${NC}"
    if has_existing_providers; then
        echo "  ccvm status              # 查看状态"
        echo "  claude \"Hello Claude!\"   # 开始对话"
        echo "  ccusage                  # 查看使用统计"
    else
        echo "  ccvm add                 # 添加配置"
        echo "  ccvm status              # 查看状态"
        echo "  ccusage                  # 查看使用统计"
    fi
    echo
    
    echo -e "${BLUE}📖 更多信息:${NC}"
    echo "  GitHub: https://github.com/$GITHUB_REPO"
    echo
}

# ============================================================================
# 主函数
# ============================================================================

main() {
    echo "🚀 =================================================="
    echo "   CCVM (Claude Code Version Manager)"
    echo "   智能 Claude API 配置管理"
    echo "=================================================="
    echo
    
    # 执行安装步骤
    check_dependencies
    migrate_old_config
    backup_existing_config
    install_ccvm
    create_shell_functions
    install_cli_tools
    setup_first_provider
    show_completion
}

# 执行主函数
if [[ "${BASH_SOURCE[0]:-$0}" == "${0}" ]]; then
    main "$@"
fi
