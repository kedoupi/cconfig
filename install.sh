#!/bin/bash

# CCVM (Claude Code Version Manager) - 统一安装脚本
# Claude API 提供商管理器
# 版本: 1.0.0

set -euo pipefail

# 输出颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无色

# 基础配置
CCVM_DIR="${HOME}/.ccvm"
GITHUB_REPO="kedoupi/claude-code-kit"
GITHUB_BRANCH="main"

# 基础日志函数
info() {
    echo -e "${BLUE}🔹 [信息]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ [成功]${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠️  [警告]${NC} $1"
}

error() {
    echo -e "${RED}❌ [错误]${NC} $1"
    exit 1
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检测安装模式
detect_mode() {
    # 检查是否在项目开发目录中
    if [ -f "bin/ccvm.js" ] && [ -f "package.json" ] && [ -d ".git" ]; then
        echo "dev"
    else
        echo "prod"
    fi
}

# 检测用户的 shell
detect_shell() {
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    
    case "$shell_name" in
        "zsh")
            echo "${HOME}/.zshrc"
            ;;
        "bash")
            if [[ "$OSTYPE" == "darwin"* ]]; then
                echo "${HOME}/.bash_profile"
            else
                echo "${HOME}/.bashrc"  
            fi
            ;;
        "fish")
            echo "${HOME}/.config/fish/config.fish"
            ;;
        *)
            warn "未知的 shell: $shell_name，将使用 ~/.profile"
            echo "${HOME}/.profile"
            ;;
    esac
}

# 检查依赖
check_dependencies() {
    info "检查系统依赖..."
    
    # 检查 Node.js
    if ! command_exists node; then
        error "未找到 Node.js。请先安装 Node.js 18+ 版本: https://nodejs.org/"
    fi
    
    local node_version
    node_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    
    if [ "$node_version" -lt "18" ]; then
        error "Node.js 版本过旧 (当前: v$node_version)，需要 18+ 版本"
    fi
    
    success "Node.js 版本 $(node --version) 兼容"
    
    # 生产模式需要额外检查
    local mode=$(detect_mode)
    if [ "$mode" = "prod" ]; then
        # 检查下载工具
        if ! command_exists curl && ! command_exists wget; then
            error "需要 curl 或 wget 来下载文件"
        fi
        
        # 检查 git
        if ! command_exists git; then
            error "需要 git 来克隆仓库"
        fi
    fi
    
    # 检查 jq (用于 provider 配置)
    if ! command_exists jq; then
        warn "建议安装 jq 以获得更好的体验: brew install jq (macOS) 或 apt install jq (Ubuntu)"
    fi
}

# 备份现有的 Claude 配置
backup_claude_config() {
    if [ -d "${HOME}/.claude" ]; then
        local backup_dir="${CCVM_DIR}/claude_backup/$(date +%Y%m%d_%H%M%S)"
        
        info "备份现有 Claude 配置..."
        mkdir -p "$backup_dir"
        cp -r "${HOME}/.claude/"* "$backup_dir/" 2>/dev/null || true
        
        success "已备份现有配置到: $backup_dir"
        warn "如需恢复: cp -r $backup_dir/* ~/.claude/"
    fi
}

# 安装 CCVM
install_ccvm() {
    local mode=$(detect_mode)
    
    info "检测到安装模式: $mode"
    
    # 智能处理现有安装
    if [ -d "$CCVM_DIR" ]; then
        warn "发现现有 CCVM 配置，正在保留用户数据..."
        
        # 备份用户配置数据
        local backup_temp="${CCVM_DIR}_backup_$(date +%s)"
        local user_data_dirs=("providers" "backups")
        local user_data_files=("config.json")
        
        # 创建临时备份目录
        mkdir -p "$backup_temp"
        
        # 备份用户数据目录
        for dir in "${user_data_dirs[@]}"; do
            if [ -d "$CCVM_DIR/$dir" ]; then
                cp -r "$CCVM_DIR/$dir" "$backup_temp/"
                info "已备份用户数据: $dir"
            fi
        done
        
        # 备份用户配置文件
        for file in "${user_data_files[@]}"; do
            if [ -f "$CCVM_DIR/$file" ]; then
                cp "$CCVM_DIR/$file" "$backup_temp/"
                info "已备份配置文件: $file"
            fi
        done
        
        # 清理旧安装，但保留备份
        rm -rf "$CCVM_DIR"
        
        # 创建新的基础目录
        mkdir -p "$CCVM_DIR"
        
        # 恢复用户数据
        if [ -d "$backup_temp" ]; then
            cp -r "$backup_temp"/* "$CCVM_DIR/" 2>/dev/null || true
            rm -rf "$backup_temp"
            success "用户配置已恢复"
        fi
    else
        # 全新安装
        info "全新安装 CCVM..."
    fi
    
    # 确保基础目录结构存在
    mkdir -p "$CCVM_DIR/providers"
    mkdir -p "$CCVM_DIR/backups"
    
    if [ "$mode" = "dev" ]; then
        # 开发模式：记录开发路径，不复制代码
        local dev_path="$(pwd)"
        info "开发模式：链接到 $dev_path"
        
        echo "$dev_path" > "$CCVM_DIR/dev_path"
        
        # 只复制 .claude 配置模板
        if [ -d ".claude" ]; then
            cp -r ".claude" "$CCVM_DIR/"
            success "已复制 Claude 配置模板"
        fi
        
        # 在开发目录安装依赖
        info "安装开发依赖..."
        npm install || warn "依赖安装失败，但不影响基本功能"
        
    else
        # 生产模式：克隆完整仓库
        info "生产模式：从 GitHub 克隆..."
        
        git clone "https://github.com/${GITHUB_REPO}.git" "$CCVM_DIR" || error "克隆仓库失败"
        
        # 切换到指定分支
        cd "$CCVM_DIR"
        git checkout "$GITHUB_BRANCH" 2>/dev/null || true
        
        # 安装依赖
        info "安装 Node.js 依赖..."
        npm install --production --silent || error "依赖安装失败"
    fi
    
    success "CCVM 核心安装完成"
}

# 同步 Claude 配置
sync_claude_config() {
    local claude_template_dir
    local mode=$(detect_mode)
    
    if [ "$mode" = "dev" ]; then
        claude_template_dir="$(cat "$CCVM_DIR/dev_path")/.claude"
    else
        claude_template_dir="$CCVM_DIR/.claude"
    fi
    
    if [ -d "$claude_template_dir" ]; then
        info "同步 Claude 配置..."
        
        # 确保目标目录存在
        mkdir -p "${HOME}/.claude"
        
        # 复制配置文件
        cp -r "$claude_template_dir/"* "${HOME}/.claude/" 2>/dev/null || true
        
        success "Claude 配置已同步"
    else
        warn "未找到 Claude 配置模板，跳过同步"
    fi
}

# 创建 shell 函数
create_shell_function() {
    local shell_config
    shell_config=$(detect_shell)
    
    info "配置 shell 函数: $(basename "$shell_config")"
    
    # 确定 CCVM 可执行文件路径
    local ccvm_bin_path
    if [ -f "$CCVM_DIR/dev_path" ]; then
        # 开发模式：使用开发目录的 bin
        ccvm_bin_path="$(cat "$CCVM_DIR/dev_path")/bin/ccvm.js"
        info "开发模式：使用 $ccvm_bin_path"
    else
        # 生产模式：使用安装目录的 bin
        ccvm_bin_path="$CCVM_DIR/bin/ccvm.js"
    fi
    
    # 创建 shell 函数内容
    local function_content
    read -r -d '' function_content << EOF || true

# CCVM (Claude Code Version Manager) - Shell 函数
ccvm() {
    node "$ccvm_bin_path" "\$@"
    
    # 如果是 provider CRUD 操作，重新加载 aliases
    if [[ "\$1" == "provider" && ("\$2" == "add" || "\$2" == "remove" || "\$2" == "edit") ]]; then
        source ~/.ccvm/aliases.sh 2>/dev/null || true
    fi
}

# 加载现有的 provider aliases
if [ -f ~/.ccvm/aliases.sh ]; then
    source ~/.ccvm/aliases.sh
fi
EOF
    
    # 检查是否已经配置
    if [ -f "$shell_config" ]; then
        if grep -q "CCVM (Claude Code Version Manager)" "$shell_config"; then
            warn "Shell 配置已存在，正在清理旧配置..."
            
            # 使用更精确的清理方式，只删除完整的 CCVM 配置块
            # 从 "# CCVM (Claude Code Version Manager)" 开始，到文件末尾或下一个主要配置块
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS 使用 BSD sed - 删除从 CCVM 标记到文件末尾的所有内容
                sed -i '.bak' '/# CCVM (Claude Code Version Manager)/,$d' "$shell_config"
            else
                # Linux 使用 GNU sed
                sed -i.bak '/# CCVM (Claude Code Version Manager)/,$d' "$shell_config"
            fi
            
            # 确保文件以空行结尾
            if [ -s "$shell_config" ] && [ "$(tail -c1 "$shell_config" | wc -l)" -eq 0 ]; then
                echo "" >> "$shell_config"
            fi
            
            info "已清理旧的 CCVM 配置"
        fi
    fi
    
    # 添加到 shell 配置文件
    echo "$function_content" >> "$shell_config"
    
    success "Shell 函数已添加到 $(basename "$shell_config")"
}

# 安装 Claude Code CLI (如果需要)
install_claude_cli() {
    info "检查 Claude Code CLI..."
    
    if command_exists claude; then
        success "Claude Code CLI 已安装: $(claude --version 2>/dev/null || echo '版本未知')"
    else
        info "安装 Claude Code CLI..."
        npm install -g @anthropic-ai/claude-code || error "Claude Code CLI 安装失败"
        success "Claude Code CLI 安装成功"
    fi
}

# 引导配置第一个 Provider
setup_first_provider() {
    # 检查是否已有 provider 配置
    if [ -d "$CCVM_DIR/providers" ] && [ "$(ls -A "$CCVM_DIR/providers" 2>/dev/null | grep -c '\.json$')" -gt 0 ]; then
        info "检测到现有 provider 配置，跳过初始配置向导"
        return 0
    fi
    
    echo
    echo -e "${BLUE}🎯 首次使用配置向导${NC}"
    echo "=================================================="
    
    info "为了让您快速开始使用，我们来配置第一个 Claude API provider"
    echo
    
    # 询问是否要配置
    echo -e "${YELLOW}是否现在配置第一个 provider？ (推荐) [Y/n]:${NC}"
    read -r setup_provider
    
    if [[ "$setup_provider" =~ ^[Nn]$ ]]; then
        info "跳过初始配置，您稍后可运行 'ccvm provider add' 来添加"
        return 0
    fi
    
    # 确定 CCVM 可执行文件路径
    local ccvm_bin_path
    if [ -f "$CCVM_DIR/dev_path" ]; then
        ccvm_bin_path="$(cat "$CCVM_DIR/dev_path")/bin/ccvm.js"
    else
        ccvm_bin_path="$CCVM_DIR/bin/ccvm.js"
    fi
    
    # 运行交互式 provider 添加
    info "启动 provider 配置向导..."
    echo
    
    # 直接调用 ccvm provider add
    if node "$ccvm_bin_path" provider add; then
        success "首个 provider 配置完成！"
        
        # 检查是否成功添加了 provider
        local provider_count=$(ls -1 "$CCVM_DIR/providers"/*.json 2>/dev/null | wc -l)
        if [ "$provider_count" -gt 0 ]; then
            # 获取第一个 provider 的别名
            local first_provider=$(ls -1 "$CCVM_DIR/providers"/*.json 2>/dev/null | head -1 | xargs basename | sed 's/\.json$//')
            
            # 设置为默认 provider
            if node "$ccvm_bin_path" provider use "$first_provider" >/dev/null 2>&1; then
                success "已将 '$first_provider' 设置为默认 provider"
                
                # 生成 aliases
                node "$ccvm_bin_path" provider list >/dev/null 2>&1 || true
                
                echo
                echo -e "${GREEN}🎊 恭喜！现在您可以使用以下命令:${NC}"
                echo "  $first_provider \"Hello Claude!\""
                echo "  ccvm status"
                echo
            else
                warn "provider 添加成功，但设置默认 provider 时出现问题"
            fi
        fi
    else
        warn "provider 配置被取消或失败，您可以稍后运行 'ccvm provider add'"
    fi
}

# 显示安装完成信息
show_completion_info() {
    local mode=$(detect_mode)
    
    echo
    echo "🎉 =================================================="
    success "CCVM 安装完成！"
    echo "=================================================="
    echo
    echo -e "${GREEN}✨ 已为您准备就绪:${NC}"
    
    if [ "$mode" = "dev" ]; then
        echo "  ✅ 开发模式：链接到当前项目目录"
        echo "  ✅ 代码修改实时生效，无需重新安装"
    else
        echo "  ✅ 生产模式：完整安装到 ~/.ccvm"
    fi
    
    echo "  ✅ Shell 函数已配置 (ccvm 命令)"
    echo "  ✅ Claude Code CLI 已就绪"
    echo "  ✅ Claude 配置已同步"
    echo
    echo -e "${YELLOW}🔄 重启终端或运行以下命令来启用:${NC}"
    echo "  source $(detect_shell | sed "s|${HOME}|~|g")"
    echo
    echo -e "${BLUE}🚀 接下来的步骤:${NC}"
    
    # 检查是否已配置 provider
    if [ -d "$CCVM_DIR/providers" ] && [ "$(ls -A "$CCVM_DIR/providers" 2>/dev/null | grep -c '\.json$')" -gt 0 ]; then
        # 已配置 provider 的情况
        echo "  1️⃣  ccvm status               # 查看当前配置状态"  
        echo "  2️⃣  ccvm provider list       # 查看所有 providers"
        echo "  3️⃣  重启终端后使用您的 provider 命令"
        echo "  4️⃣  ccvm --help              # 查看完整帮助"
    else
        # 未配置 provider 的情况
        echo "  1️⃣  ccvm --help               # 查看帮助"
        echo "  2️⃣  ccvm provider add        # 添加第一个 provider"
        echo "  3️⃣  cc-xxx \"Hello!\"           # 使用您的 provider"
        echo "  4️⃣  ccvm provider list       # 查看所有 providers"
    fi
    echo
    
    if [ "$mode" = "dev" ]; then
        echo -e "${BLUE}🔧 开发模式提示:${NC}"
        echo "  • 修改代码后立即生效，无需重新安装"
        echo "  • 要切换到生产模式：删除 ~/.ccvm 后在其他目录运行安装脚本"
        echo
    fi
    
    echo -e "${BLUE}📖 文档和支持:${NC}"
    echo "  🌐 GitHub: https://github.com/kedoupi/claude-code-kit"
    echo "  🐛 问题报告: https://github.com/kedoupi/claude-code-kit/issues"
    echo
}

# 主安装函数
main() {
    local mode=$(detect_mode)
    
    echo "🚀 =================================================="
    echo "      CCVM (Claude Code Version Manager)"  
    echo "      Claude API 提供商管理器"
    echo "      版本 1.0.0"
    
    if [ "$mode" = "dev" ]; then
        echo "      模式: 开发模式 🔧"
    else
        echo "      模式: 生产模式 📦"
    fi
    
    echo "=================================================="
    echo
    
    info "欢迎使用 CCVM 安装程序！"
    echo -e "${BLUE}📦 将要安装的内容:${NC}"
    echo "  • CCVM 核心工具"
    echo "  • Shell 函数包装器"  
    echo "  • Claude Code CLI (如果未安装)"
    echo "  • 自定义 Claude 配置"
    echo
    
    # 安装步骤
    echo -e "${BLUE}步骤 1/7:${NC} 检查系统依赖"
    check_dependencies
    
    echo -e "${BLUE}步骤 2/7:${NC} 备份现有配置"
    backup_claude_config
    
    echo -e "${BLUE}步骤 3/7:${NC} 安装 CCVM 核心"
    install_ccvm
    
    echo -e "${BLUE}步骤 4/7:${NC} 同步 Claude 配置"
    sync_claude_config
    
    echo -e "${BLUE}步骤 5/7:${NC} 创建 Shell 函数"
    create_shell_function
    
    echo -e "${BLUE}步骤 6/7:${NC} 安装 Claude Code CLI"
    install_claude_cli
    
    echo -e "${BLUE}步骤 7/7:${NC} 配置首个 Provider"
    setup_first_provider
    
    show_completion_info
}

# 如果脚本直接执行则运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi