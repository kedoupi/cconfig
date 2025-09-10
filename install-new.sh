#!/bin/bash

# CCVM (Claude Code Version Manager) - 轻量化安装脚本
# 负责环境检查、下载准备，然后调用setup.sh进行配置

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
    local version_flag=${2:---version}
    
    if command_exists "$cmd"; then
        "$cmd" "$version_flag" 2>/dev/null | head -n1 | grep -o '[0-9][0-9.]*' | head -n1
    else
        echo "未安装"
    fi
}

detect_mode() {
    # When run via curl | bash, SCRIPT_DIR will be PWD, so check for dev files there
    if [[ -f "$SCRIPT_DIR/package.json" && -f "$SCRIPT_DIR/bin/ccvm.js" ]]; then
        echo "dev"
    else
        echo "prod"
    fi
}

# ============================================================================
# 环境检查
# ============================================================================

check_node_version() {
    if ! command_exists node; then
        log ERROR "需要 Node.js (>=18.0.0)，但未找到 node 命令"
    fi
    
    local node_version
    node_version=$(get_version node)
    local major_version=${node_version%%.*}
    
    if [[ $major_version -lt 18 ]]; then
        log ERROR "需要 Node.js >=18.0.0，当前版本: $node_version"
    fi
    
    log SUCCESS "Node.js 版本检查通过: $node_version"
}

check_dependencies() {
    log INFO "检查系统依赖..."
    
    local missing=()
    
    for cmd in git npm curl; do
        if ! command_exists "$cmd"; then
            missing+=("$cmd")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log ERROR "缺少必需的命令: ${missing[*]}"
    fi
    
    # 检查 Node.js 版本
    check_node_version
    
    log SUCCESS "依赖检查完成"
}

# ============================================================================
# 下载和准备
# ============================================================================

download_and_extract() {
    local mode="$1"
    
    if [[ "$mode" == "dev" ]]; then
        log INFO "开发模式：使用本地代码"
        return 0
    fi
    
    log INFO "生产模式：准备从GitHub下载..."
    
    # 创建临时目录
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # 确保清理临时目录
    trap "rm -rf '$temp_dir'" EXIT
    
    log INFO "下载CCVM代码包..."
    if git clone "https://github.com/${GITHUB_REPO}.git" "$temp_dir"; then
        (cd "$temp_dir" && git checkout "$GITHUB_BRANCH" 2>/dev/null || true)
        log SUCCESS "代码包下载完成"
        
        # 将下载的代码路径传递给setup.sh
        export CCVM_SOURCE_DIR="$temp_dir"
    else
        log ERROR "下载失败：无法克隆代码仓库"
    fi
}

# ============================================================================
# 调用setup.sh
# ============================================================================

call_setup() {
    local mode="$1"
    local setup_script
    
    if [[ "$mode" == "dev" ]]; then
        setup_script="$SCRIPT_DIR/setup.sh"
    else
        setup_script="${CCVM_SOURCE_DIR}/setup.sh"
    fi
    
    if [[ ! -f "$setup_script" ]]; then
        log ERROR "找不到setup.sh脚本: $setup_script"
    fi
    
    log INFO "调用配置脚本进行安装..."
    
    # 调用setup.sh并传递模式参数
    if bash "$setup_script" "$mode"; then
        log SUCCESS "配置脚本执行完成"
    else
        log ERROR "配置脚本执行失败"
    fi
}

# ============================================================================
# 主函数
# ============================================================================

main() {
    echo
    echo "🚀 =================================================="
    echo "   CCVM (Claude Code Version Manager) 安装程序"
    echo "=================================================="
    echo
    
    # 1. 环境检查
    check_dependencies
    
    # 2. 检测安装模式
    local mode
    mode=$(detect_mode)
    log INFO "检测到安装模式: $mode"
    
    # 3. 下载和准备（仅生产模式）
    download_and_extract "$mode"
    
    # 4. 调用setup.sh进行实际配置
    call_setup "$mode"
    
    log SUCCESS "安装完成！"
}

# 执行主函数
main "$@"