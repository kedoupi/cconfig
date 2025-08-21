#!/bin/bash

# Claude Code Kit 安装脚本
# 作者: RenYuan <kedoupi@gmail.com>
# 版本: 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
INSTALL_DIR="$HOME/.cc-config"
BIN_DIR="$HOME/.local/bin"
REPO_URL="https://github.com/kedoupi/claude-code-kit"
NODE_MIN_VERSION="14"
CLI_COMMAND="cc-config"

# 日志配置
LOG_FILE="$HOME/.cc-config-install.log"
VERBOSE=${VERBOSE:-false}

# 日志记录函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

log_info() { log "INFO" "$1"; }
log_warn() { log "WARN" "$1"; }
log_error() { log "ERROR" "$1"; }
log_debug() { 
    if [ "$VERBOSE" = true ]; then
        log "DEBUG" "$1"
    fi
}

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}$message${NC}"
    log_info "$message"
}

print_success() { 
    print_message "$GREEN" "✅ $1"
}

print_error() { 
    print_message "$RED" "❌ $1"
    log_error "$1"
}

print_warning() { 
    print_message "$YELLOW" "⚠️  $1"
    log_warn "$1"
}

print_info() { 
    print_message "$BLUE" "ℹ️  $1"
}

print_step() { 
    print_message "$CYAN" "🔧 $1"
}

# 详细模式输出
print_debug() {
    if [ "$VERBOSE" = true ]; then
        print_message "$NC" "🐛 DEBUG: $1"
        log_debug "$1"
    fi
}

# 执行命令并记录日志
execute_with_log() {
    local cmd="$1"
    local success_msg="$2"
    local error_msg="$3"
    
    log_debug "执行命令: $cmd"
    
    if eval "$cmd" >> "$LOG_FILE" 2>&1; then
        if [ -n "$success_msg" ]; then
            print_debug "$success_msg"
        fi
        return 0
    else
        local exit_code=$?
        if [ -n "$error_msg" ]; then
            print_error "$error_msg"
            log_error "命令失败 (退出码: $exit_code): $cmd"
        fi
        return $exit_code
    fi
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 安全地创建目录
safe_mkdir() {
    local dir="$1"
    local mode="${2:-755}"
    
    if [ ! -d "$dir" ]; then
        if mkdir -p "$dir" && chmod "$mode" "$dir"; then
            log_debug "目录创建成功: $dir (权限: $mode)"
            return 0
        else
            log_error "目录创建失败: $dir"
            return 1
        fi
    else
        log_debug "目录已存在: $dir"
        return 0
    fi
}

# 显示欢迎信息
show_welcome() {
    # 初始化日志文件
    echo "=== Claude Code Kit 安装开始 ===" > "$LOG_FILE"
    log_info "安装程序启动"
    log_info "操作系统: $OSTYPE"
    log_info "用户: $(whoami)"
    log_info "工作目录: $(pwd)"
    log_info "Shell: $SHELL"
    log_info "详细模式: $VERBOSE"
    
    echo ""
    print_message "$CYAN" "╔══════════════════════════════════════╗"
    print_message "$CYAN" "║        Claude Code Kit 安装程序        ║"
    print_message "$CYAN" "║           版本: 1.0.0                 ║"
    print_message "$CYAN" "╚══════════════════════════════════════╝"
    echo ""
    print_info "Claude Code 配置工具集 - 支持多服务商API切换"
    print_info "日志文件: $LOG_FILE"
    if [ "$VERBOSE" = true ]; then
        print_info "详细模式已启用"
    fi
    echo ""
}

# 检查系统要求
check_system() {
    print_step "检查系统环境..."
    
    # 检查操作系统
    if [[ "$OSTYPE" != "darwin"* ]] && [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "不支持的操作系统: $OSTYPE"
        print_info "支持的系统: macOS, Linux"
        exit 1
    fi
    
    print_info "操作系统: $OSTYPE ✓"
    
    # 检查必要工具
    local required_tools=("curl" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            print_error "缺少必要工具: $tool"
            exit 1
        fi
        print_info "$tool: 已安装 ✓"
    done
    
    print_success "系统环境检查通过"
}

# 检查并安装 Node.js
check_nodejs() {
    print_step "检查 Node.js 环境..."
    
    if command -v node &> /dev/null; then
        local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$node_version" -ge "$NODE_MIN_VERSION" ]; then
            print_success "Node.js 版本检查通过: $(node -v)"
            return 0
        else
            print_warning "Node.js 版本过低: $(node -v)，需要 >= v$NODE_MIN_VERSION"
        fi
    else
        print_warning "未找到 Node.js"
    fi
    
    # 提示用户安装 Node.js
    print_info "需要安装或升级 Node.js"
    print_info "推荐安装方式:"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_info "  macOS: brew install node"
        print_info "  或者访问: https://nodejs.org/"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_info "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
        print_info "  CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash - && sudo yum install -y nodejs"
        print_info "  或者访问: https://nodejs.org/"
    fi
    
    echo ""
    read -p "$(print_message "$YELLOW" "是否继续安装? (需要先手动安装Node.js) [y/N]: ")" -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "安装已取消"
        exit 0
    fi
    
    # 再次检查
    if ! command -v node &> /dev/null; then
        print_error "请先安装 Node.js 后重新运行安装脚本"
        exit 1
    fi
}

# 创建安装目录
create_directories() {
    print_step "创建安装目录..."
    
    # 备份现有配置
    if [ -d "$INSTALL_DIR" ]; then
        local backup_name="$INSTALL_DIR.backup-$(date +%Y%m%d-%H%M%S)"
        print_warning "发现现有配置，备份为: $backup_name"
        mv "$INSTALL_DIR" "$backup_name"
    fi
    
    # 创建新目录
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$BIN_DIR"
    
    # 设置权限
    chmod 700 "$INSTALL_DIR"
    
    print_success "目录创建完成"
}

# 下载和安装应用
install_application() {
    print_step "下载 Claude Code Kit..."
    
    local temp_dir=$(mktemp -d)
    local download_url=""
    
    # 尝试从GitHub下载最新版本
    if command -v curl &> /dev/null; then
        # 获取最新release信息
        local latest_release=$(curl -s "https://api.github.com/repos/kedoupi/claude-code-kit/releases/latest" 2>/dev/null || echo "")
        
        if [ -n "$latest_release" ] && echo "$latest_release" | grep -q "tarball_url"; then
            download_url=$(echo "$latest_release" | grep '"tarball_url"' | cut -d '"' -f 4)
            print_info "找到最新版本，正在下载..."
        fi
    fi
    
    # 如果没有找到release，使用git clone
    if [ -z "$download_url" ]; then
        print_info "使用Git克隆仓库..."
        if git clone "$REPO_URL.git" "$temp_dir" 2>/dev/null; then
            print_success "代码下载完成"
        else
            print_error "代码下载失败，请检查网络连接"
            print_info "你也可以手动下载: $REPO_URL"
            exit 1
        fi
    else
        # 下载release版本
        if curl -L "$download_url" | tar -xz -C "$temp_dir" --strip-components=1 2>/dev/null; then
            print_success "Release版本下载完成"
        else
            print_warning "Release下载失败，尝试Git方式..."
            rm -rf "$temp_dir"
            temp_dir=$(mktemp -d)
            if git clone "$REPO_URL.git" "$temp_dir" 2>/dev/null; then
                print_success "代码下载完成"
            else
                print_error "下载失败"
                exit 1
            fi
        fi
    fi
    
    # 检查下载的文件
    if [ ! -f "$temp_dir/package.json" ]; then
        print_error "下载的文件不完整"
        exit 1
    fi
    
    # 安装依赖
    print_step "安装依赖..."
    cd "$temp_dir"
    
    if npm install --production --silent 2>/dev/null; then
        print_success "依赖安装完成"
    else
        print_error "依赖安装失败"
        exit 1
    fi
    
    # 复制文件到安装目录
    print_step "安装文件..."
    cp -r package.json src bin "$INSTALL_DIR/"
    cp -r node_modules "$INSTALL_DIR/"
    
    # 创建可执行文件链接
    local cli_script="$INSTALL_DIR/bin/cc-config.js"
    local cli_link="$BIN_DIR/$CLI_COMMAND"
    
    # 确保可执行权限
    chmod +x "$cli_script"
    
    # 创建符号链接
    ln -sf "$cli_script" "$cli_link"
    
    # 清理临时目录
    rm -rf "$temp_dir"
    
    print_success "应用安装完成"
}

# 初始化配置
initialize_config() {
    print_step "初始化配置..."
    
    # 运行初始化命令
    if "$BIN_DIR/$CLI_COMMAND" init 2>/dev/null; then
        print_success "配置初始化完成"
    else
        print_warning "配置初始化失败，将在首次使用时自动初始化"
    fi
}

# 配置 PATH 环境变量
setup_path() {
    print_step "配置环境变量..."
    
    local shell_name=$(basename "$SHELL")
    local rc_file=""
    
    case $shell_name in
        zsh)
            rc_file="$HOME/.zshrc"
            ;;
        bash)
            rc_file="$HOME/.bashrc"
            ;;
        *)
            print_warning "不支持的 Shell: $shell_name，请手动添加 $BIN_DIR 到 PATH"
            return 0
            ;;
    esac
    
    # 检查PATH是否已包含BIN_DIR
    if echo "$PATH" | grep -q "$BIN_DIR"; then
        print_info "PATH 已包含 $BIN_DIR"
    else
        # 添加 PATH
        local path_line="export PATH=\"$BIN_DIR:\$PATH\""
        
        if ! grep -q "$path_line" "$rc_file" 2>/dev/null; then
            echo "" >> "$rc_file"
            echo "# Claude Code Kit" >> "$rc_file"
            echo "$path_line" >> "$rc_file"
            print_success "PATH 配置已添加到 $rc_file"
        else
            print_info "PATH 配置已存在"
        fi
    fi
}

# 验证安装
verify_installation() {
    print_step "验证安装..."
    
    # 检查命令是否可用
    if command -v "$CLI_COMMAND" &> /dev/null; then
        local version=$("$CLI_COMMAND" --version 2>/dev/null || echo "unknown")
        print_success "命令验证成功: $CLI_COMMAND v$version"
    else
        print_warning "命令未找到，可能需要重新加载Shell配置"
        print_info "请运行: export PATH=\"$BIN_DIR:\$PATH\""
    fi
    
    # 检查配置目录
    if [ -d "$INSTALL_DIR" ]; then
        print_success "配置目录验证成功: $INSTALL_DIR"
    else
        print_error "配置目录不存在"
        exit 1
    fi
}

# 显示完成信息
show_completion() {
    echo ""
    print_success "🎉 Claude Code Kit 安装完成！"
    echo ""
    print_info "📁 安装目录: $INSTALL_DIR"
    print_info "🔧 命令工具: $CLI_COMMAND"
    print_info "📋 配置目录: $HOME/.cc-config"
    echo ""
    print_message "$YELLOW" "📝 下一步操作:"
    echo "  1. 重新加载Shell配置或重启终端"
    echo "     source ~/.zshrc  (zsh)"
    echo "     source ~/.bashrc (bash)"
    echo ""
    echo "  2. 查看帮助信息"
    echo "     $CLI_COMMAND --help"
    echo ""
    echo "  3. 添加你的第一个服务商"
    echo "     $CLI_COMMAND provider add"
    echo ""
    echo "  4. 生成和安装别名"
    echo "     $CLI_COMMAND alias install"
    echo ""
    print_message "$CYAN" "📚 更多信息:"
    echo "  GitHub: $REPO_URL"
    echo "  问题反馈: $REPO_URL/issues"
    echo ""
}

# 错误处理和恢复
handle_error() {
    local exit_code=$?
    local line_number=${BASH_LINENO[0]}
    
    log_error "安装失败，退出码: $exit_code，行号: $line_number"
    
    print_error "安装过程中发生错误 (行号: $line_number)"
    echo ""
    
    print_info "🔍 错误诊断信息:"
    if [ -f "$LOG_FILE" ]; then
        echo "📄 详细日志: $LOG_FILE"
        echo "📋 最近的日志条目:"
        tail -10 "$LOG_FILE" | while IFS= read -r line; do
            echo "   $line"
        done
    fi
    
    echo ""
    print_info "🛠️  常见问题解决方案:"
    echo "  1. 网络连接问题 - 检查网络连接和防火墙设置"
    echo "  2. 权限问题 - 确保用户有写入权限"
    echo "  3. Node.js版本 - 确保Node.js版本 >= $NODE_MIN_VERSION"
    echo "  4. 磁盘空间 - 检查磁盘空间是否足够"
    echo ""
    
    print_info "🔄 如果问题持续存在:"
    echo "  1. 运行详细模式: VERBOSE=true bash install.sh"
    echo "  2. 清理后重试: rm -rf '$INSTALL_DIR' && bash install.sh"
    echo "  3. 手动安装: 查看项目 README.md"
    echo "  4. 报告问题: $REPO_URL/issues"
    echo ""
    
    # 尝试清理不完整的安装
    cleanup_on_error
    
    exit $exit_code
}

# 错误清理函数
cleanup_on_error() {
    print_step "清理不完整的安装..."
    
    # 只清理明显有问题的文件，保留用户数据
    if [ -d "$INSTALL_DIR/node_modules" ] && [ ! -f "$INSTALL_DIR/package.json" ]; then
        log_warn "清理不完整的node_modules目录"
        rm -rf "$INSTALL_DIR/node_modules" 2>/dev/null || true
    fi
    
    # 移除可能的破损符号链接
    if [ -L "$BIN_DIR/$CLI_COMMAND" ] && [ ! -e "$BIN_DIR/$CLI_COMMAND" ]; then
        log_warn "清理破损的符号链接"
        rm -f "$BIN_DIR/$CLI_COMMAND" 2>/dev/null || true
    fi
    
    log_info "清理完成"
}

# 网络连接检查
check_network() {
    print_debug "检查网络连接..."
    
    local test_urls=(
        "https://api.github.com"
        "https://registry.npmjs.org"
        "https://nodejs.org"
    )
    
    for url in "${test_urls[@]}"; do
        if execute_with_log "curl -s --max-time 10 '$url' >/dev/null" "" ""; then
            log_debug "网络连接正常: $url"
            return 0
        fi
    done
    
    print_warning "网络连接可能有问题，这可能影响安装过程"
    log_warn "所有网络连接测试都失败了"
    
    echo ""
    read -p "$(print_message "$YELLOW" "是否继续安装? [y/N]: ")" -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "安装已取消"
        exit 0
    fi
}

# 磁盘空间检查
check_disk_space() {
    print_debug "检查磁盘空间..."
    
    local required_mb=100  # 至少需要100MB
    local available_mb
    
    if command_exists df; then
        available_mb=$(df -m "$HOME" | awk 'NR==2 {print $4}')
        if [ "$available_mb" -lt "$required_mb" ]; then
            print_warning "磁盘空间不足，需要至少 ${required_mb}MB，当前可用 ${available_mb}MB"
            log_warn "磁盘空间不足: 可用 ${available_mb}MB, 需要 ${required_mb}MB"
            return 1
        else
            log_debug "磁盘空间充足: ${available_mb}MB 可用"
        fi
    else
        log_debug "无法检查磁盘空间，df命令不可用"
    fi
    
    return 0
}

# 命令行参数解析
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            --log-file)
                LOG_FILE="$2"
                shift 2
                ;;
            *)
                print_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 显示帮助信息
show_help() {
    echo "Claude Code Kit 安装脚本"
    echo ""
    echo "用法: bash install.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -v, --verbose     启用详细输出模式"
    echo "  -h, --help        显示此帮助信息"
    echo "  --log-file FILE   指定日志文件路径"
    echo ""
    echo "环境变量:"
    echo "  VERBOSE=true      启用详细模式"
    echo ""
    echo "示例:"
    echo "  bash install.sh"
    echo "  VERBOSE=true bash install.sh"
    echo "  bash install.sh --verbose --log-file /tmp/install.log"
}

# 主安装流程
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 设置错误处理
    trap handle_error ERR
    set -eE  # 启用错误退出和ERR陷阱继承
    
    show_welcome
    check_network
    check_disk_space
    check_system
    check_nodejs
    create_directories
    install_application
    initialize_config
    setup_path
    verify_installation
    show_completion
    
    # 安装成功日志
    log_info "=== 安装成功完成 ==="
}

# 运行主程序
main "$@"