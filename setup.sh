#!/bin/bash

# CCVM (Claude Code Version Manager) - 配置安装脚本  
# 由install.sh调用，负责实际的配置和安装工作

set -euo pipefail

# ============================================================================
# 配置和常量
# ============================================================================

readonly CLAUDE_DIR="${HOME}/.claude"
readonly CCVM_DIR="${CLAUDE_DIR}/ccvm"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$PWD}")" && pwd)"

# 颜色定义
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# 安装模式（由install.sh传入）
INSTALL_MODE="${1:-dev}"

# 源代码目录（生产模式下由install.sh设置）
CCVM_SOURCE_DIR="${CCVM_SOURCE_DIR:-$SCRIPT_DIR}"

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
    local version_flag=${2:---version}
    
    if command_exists "$cmd"; then
        "$cmd" "$version_flag" 2>/dev/null | head -n1 | grep -o '[0-9][0-9.]*' | head -n1
    else
        echo "未安装"
    fi
}

detect_shell_config() {
    # 优先使用 $SHELL 变量检测用户的默认shell
    local current_shell="${SHELL##*/}"
    case "$current_shell" in
        zsh)
            echo "${ZDOTDIR:-$HOME}/.zshrc"
            ;;
        bash)
            # 在macOS上优先使用.bash_profile，其他系统使用.bashrc
            if [[ "$OSTYPE" == "darwin"* ]] && [[ -f "$HOME/.bash_profile" ]]; then
                echo "$HOME/.bash_profile"
            elif [[ -f "$HOME/.bashrc" ]]; then
                echo "$HOME/.bashrc"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        fish)
            echo "$HOME/.config/fish/config.fish"
            ;;
        *)
            # 检查当前运行环境的shell版本变量
            if [[ -n "${ZSH_VERSION:-}" ]]; then
                echo "${ZDOTDIR:-$HOME}/.zshrc"
            elif [[ -n "${BASH_VERSION:-}" ]]; then
                if [[ -f "$HOME/.bash_profile" ]]; then
                    echo "$HOME/.bash_profile"
                else
                    echo "$HOME/.bashrc"
                fi
            elif [[ -n "${FISH_VERSION:-}" ]]; then
                echo "$HOME/.config/fish/config.fish"
            else
                # 检查哪个配置文件实际存在并且最近被修改
                local configs=("$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc")
                local newest=""
                local newest_time=0
                
                for config in "${configs[@]}"; do
                    if [[ -f "$config" ]]; then
                        local mtime
                        if [[ "$OSTYPE" == "darwin"* ]]; then
                            mtime=$(stat -f "%m" "$config" 2>/dev/null || echo 0)
                        else
                            mtime=$(stat -c "%Y" "$config" 2>/dev/null || echo 0)
                        fi
                        if [[ $mtime -gt $newest_time ]]; then
                            newest="$config"
                            newest_time=$mtime
                        fi
                    fi
                done
                
                # 如果找到了最近修改的配置文件，使用它
                if [[ -n "$newest" ]]; then
                    echo "$newest"
                else
                    # 最后的默认选择 - 现代用户多用zsh
                    echo "$HOME/.zshrc"
                fi
            fi
            ;;
    esac
}

is_interactive() {
    [[ -t 0 && -t 1 ]] && command_exists tput && [[ $(tput colors) -gt 0 ]]
}

# ============================================================================
# 配置安装函数 - 从install.sh迁移
# ============================================================================

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
        log INFO "检测到现有 provider 配置"
        
        # 显示现有的providers
        local provider_count=0
        local default_provider=""
        
        if [[ -d "$CCVM_DIR/providers" ]]; then
            for file in "$CCVM_DIR/providers"/*.json; do
                if [[ -f "$file" ]]; then
                    ((provider_count++)) || true
                    local provider_name=$(basename "$file" .json)
                    echo "  ✅ $provider_name"
                fi
            done
        fi
        
        if [[ -f "$CCVM_DIR/config.json" ]] && command_exists jq; then
            default_provider=$(jq -r '.defaultProvider // ""' "$CCVM_DIR/config.json" 2>/dev/null)
            if [[ -n "$default_provider" ]]; then
                log INFO "默认 provider: $default_provider"
            fi
        fi
        
        log SUCCESS "已保留 $provider_count 个现有配置"
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

show_completion() {
    local shell_config=$(detect_shell_config | sed "s|$HOME|~|g")
    
    echo
    echo "🎉 =================================================="
    log SUCCESS "CCVM 安装完成！"
    echo "=================================================="
    echo
    
    echo -e "${GREEN}✨ 已完成:${NC}"
    echo "  ✅ CCVM 核心 ($INSTALL_MODE 模式)"
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
    echo "  GitHub: https://github.com/kedoupi/ccvm"
    echo
}

# ============================================================================
# 主配置流程
# ============================================================================

# ============================================================================
# 安装模式函数
# ============================================================================

install_dev_mode() {
    log INFO "开发模式：链接到 $CCVM_SOURCE_DIR"
    
    echo "$CCVM_SOURCE_DIR" > "$CCVM_DIR/dev_path"
    
    # 安装 Claude Code 增强配置
    install_claude_config "$CCVM_SOURCE_DIR/claude-templates"
    
    # 检查是否已有node_modules
    if [[ ! -d "$CCVM_SOURCE_DIR/node_modules" ]]; then
        log INFO "安装开发依赖..."
        (cd "$CCVM_SOURCE_DIR" && npm install --loglevel=error >/dev/null 2>&1) && log SUCCESS "依赖已安装" || log WARN "依赖安装失败"
    else
        log INFO "开发依赖已存在，跳过安装"
    fi
}

install_prod_mode() {
    log INFO "生产模式：安装到系统目录..."
    
    # 源代码已经由install.sh下载到CCVM_SOURCE_DIR
    if [[ ! -d "$CCVM_SOURCE_DIR" ]]; then
        log ERROR "源代码目录不存在: $CCVM_SOURCE_DIR"
    fi
    
    # 确保目标目录存在
    mkdir -p "$CCVM_DIR"
    
    # 只更新代码文件，保留用户配置
    log INFO "复制代码文件..."
    
    # 要复制的目录和文件列表
    local copy_items=("bin" "src" "tests" "tools" "package.json" "package-lock.json" "README.md" "LICENSE")
    
    for item in "${copy_items[@]}"; do
        if [[ -e "$CCVM_SOURCE_DIR/$item" ]]; then
            # 如果是目录，先删除旧的再复制新的
            if [[ -d "$CCVM_SOURCE_DIR/$item" ]]; then
                rm -rf "$CCVM_DIR/$item" 2>/dev/null || true
            fi
            cp -r "$CCVM_SOURCE_DIR/$item" "$CCVM_DIR/" 2>/dev/null || true
            log INFO "已复制: $item"
        fi
    done
    
    # 安装 Claude Code 增强配置
    install_claude_config "$CCVM_SOURCE_DIR/claude-templates"
    
    log INFO "安装依赖..."
    (cd "$CCVM_DIR" && npm install --production --loglevel=error >/dev/null 2>&1) || \
        (cd "$CCVM_DIR" && npm install --loglevel=error >/dev/null 2>&1) || \
        log ERROR "依赖安装失败"
}

install_ccvm() {
    log INFO "安装 CCVM 核心..."
    mkdir -p "$CCVM_DIR"
    
    if [[ "$INSTALL_MODE" == "dev" ]]; then
        install_dev_mode
    else
        install_prod_mode
    fi
    
    log SUCCESS "CCVM 核心安装完成"
}

main() {
    log "INFO" "开始CCVM配置安装..."
    log "INFO" "安装模式: $INSTALL_MODE"
    
    # 1. 安装 CCVM 核心
    install_ccvm
    
    # 2. 安装 CLI 工具
    install_cli_tools
    
    # 3. 配置 Shell 函数
    create_shell_functions
    
    # 4. 设置第一个 provider（如果需要）
    setup_first_provider
    
    # 5. 显示完成信息
    show_completion
    
    log "SUCCESS" "CCVM配置完成！"
}

# 执行主函数
main "$@"