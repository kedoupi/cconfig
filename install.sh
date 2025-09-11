#!/bin/bash
# CConfig 安装脚本
# 适用于从发布包或一键安装方式
# 用法: curl -fsSL https://raw.githubusercontent.com/kedoupi/cconfig/main/install.sh | bash
# 或者: 下载后执行 ./install.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track whether shell integration existed before this run (to detect first install)
WAS_INTEGRATED_BEFORE=0

log() {
    case "$1" in
        INFO) echo -e "${BLUE}ℹ️  $2${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ $2${NC}" ;;
        ERROR) echo -e "${RED}❌ $2${NC}"; exit 1 ;;
    esac
}

# 环境检查
if ! command -v node >/dev/null 2>&1; then
    log ERROR "需要安装 Node.js： https://nodejs.org/"
fi

if ! command -v npm >/dev/null 2>&1; then
    log ERROR "需要安装 npm（随 Node.js 提供）： https://nodejs.org/"
fi

# 检查 Node.js 版本
node_version=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$node_version" -lt 18 ]]; then
    log ERROR "需要 Node.js 18+，当前版本：v$node_version"
fi

# 检测安装模式（开发/全局）
detect_dev_mode() {
    local script_dir
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    [[ -f "${script_dir}/package.json" && -f "${script_dir}/bin/cconfig.js" ]]
}

# 安装 CConfig
if detect_dev_mode; then
    log INFO "检测到开发模式"
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    CCONFIG_CMD="node '${script_dir}/bin/cconfig.js'"
    
    # 如需则安装依赖
    if [[ ! -d "${script_dir}/node_modules" ]]; then
        log INFO "正在安装开发依赖..."
        (cd "$script_dir" && npm install >/dev/null 2>&1)
    fi
    log SUCCESS "开发模式就绪"
else
    log INFO "正在全局安装 CConfig..."
    if npm install -g @kedoupi/cconfig >/dev/null 2>&1; then
        log SUCCESS "CConfig 安装成功"
        CCONFIG_CMD="cconfig"
    else
        log ERROR "CConfig 安装失败"
    fi
fi

# 检测 Shell 配置文件
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

# 配置 Shell 集成
setup_shell_integration() {
    local shell_config
    shell_config="$(detect_shell_config)"
    
    # 验证 shell 配置文件路径安全性
    if [[ ! "$shell_config" =~ ^/[a-zA-Z0-9/_.-]+$ ]]; then
        log ERROR "检测到无效的 Shell 配置文件路径"
        return 1
    fi
    
    log INFO "正在配置 Shell 集成：$(basename "$shell_config")"
    
    # 安全地检查和移除旧配置
    if [[ -f "$shell_config" ]] && grep -q "# CConfig Integration" "$shell_config" 2>/dev/null; then
        WAS_INTEGRATED_BEFORE=1
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '.bak' '/# CConfig Integration/,/# End CConfig Integration/d' "$shell_config"
        else
            sed -i.bak '/# CConfig Integration/,/# End CConfig Integration/d' "$shell_config"
        fi
    fi
    
    # 写入新的集成函数
    cat >> "$shell_config" << EOF

# CConfig Integration
claude() {
    local provider=""
    local args=()
    
    # 解析参数
    while [[ \$# -gt 0 ]]; do
        case \$1 in
            -P|--provider)
                provider="\$2"
                shift 2
                ;;
            --pp)
                args+=("--dangerously-skip-permissions")
                shift
                ;;
            *)
                args+=("\$1")
                shift
                ;;
        esac
    done
    
    # 加载环境变量
    if [[ -n "\$provider" ]]; then
        eval "\$($CCONFIG_CMD env --provider "\$provider" 2>/dev/null)" || {
            echo "❌ 加载 Provider '\$provider' 失败"
            echo "💡 运行：$CCONFIG_CMD list"
            return 1
        }
    else
        eval "\$($CCONFIG_CMD env 2>/dev/null)" || {
            echo "❌ 尚未配置默认 Provider"
            echo "💡 运行：$CCONFIG_CMD add"
            return 1
        }
    fi
    
    # 执行 claude 命令
    command claude "\${args[@]}"
}
# End CConfig Integration
EOF

    log SUCCESS "Shell 集成配置完成"
}

# 如未配置 Provider，则提示用户进行配置
check_and_prompt_initial_config() {
    local config_dir="$HOME/.claude/cconfig"
    local providers_dir="$config_dir/providers"
    # Always prompt when no provider configured (first or subsequent installs)
    if [[ ! -d "$providers_dir" ]] || ! ls -1 "$providers_dir"/*.json >/dev/null 2>&1; then
        echo
        log INFO "未检测到任何 API 端点配置"
        echo "💡 现在可运行以下命令添加 Provider："
        echo "   $CCONFIG_CMD add"
    fi
}

# Main installation
main() {
    echo
    echo "📦 CConfig 安装"
    echo "================"
    echo
    
    # 检查是否安装 claude 命令
    if ! command -v claude >/dev/null 2>&1; then
        log INFO "正在安装 Claude CLI..."
        if npm install -g @anthropic-ai/claude-code >/dev/null 2>&1; then
            log SUCCESS "Claude CLI 安装完成"
        else
            log ERROR "Claude CLI 安装失败，请手动安装： npm install -g @anthropic-ai/claude-code"
        fi
    else
        log SUCCESS "已安装 Claude CLI"
    fi
    
    setup_shell_integration
    check_and_prompt_initial_config
    
    echo
    log SUCCESS "安装完成！"
    echo
    echo "🔄 重新加载 Shell："
    echo "   source $(detect_shell_config | sed "s|$HOME|~|g")"
    echo
    echo "🚀 快速开始："
    echo "   $CCONFIG_CMD add          # 添加一个 Provider"
    echo "   claude \"Hello!\"           # 与 Claude 对话"
    echo "   claude -P custom \"Hi\"     # 使用指定 Provider"
    echo
}

main "$@"
