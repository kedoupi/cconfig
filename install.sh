#!/bin/bash

# Claude Code Kit - 简化安装脚本
# 此脚本只安装基础工具，配置由 cc-config 自动处理
# 版本: 3.0.0 - 极简版本

set -euo pipefail

# 输出颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无色

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

# 检查 Node.js 版本
check_nodejs() {
    info "检查 Node.js 安装状态..."
    
    if ! command_exists node; then
        error "未找到 Node.js。请先安装 Node.js 18+ 版本: https://nodejs.org/"
    fi
    
    local current_version
    current_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    
    if [ "$current_version" -lt "18" ]; then
        error "Node.js 版本 $current_version 过旧，需要 18+ 版本"
    fi
    
    success "Node.js 版本 $(node --version) 兼容"
}

# 安装 Claude Code CLI
install_claude_code() {
    info "安装 Claude Code CLI..."
    
    if command_exists claude; then
        info "Claude Code 已安装，正在更新..."
        npm update -g @anthropic-ai/claude-code >/dev/null 2>&1 || true
    else
        npm install -g @anthropic-ai/claude-code || error "Claude Code CLI 安装失败"
    fi
    
    success "Claude Code CLI 安装成功"
}

# 安装 cc-config 工具
install_cc_config() {
    info "安装 cc-config 管理工具..."
    
    npm install -g @kedoupi/claude-code-kit || error "cc-config 工具安装失败"
    
    # 验证安装
    if command_exists cc-config; then
        success "cc-config 工具安装成功"
        info "cc-config 版本: $(cc-config --version 2>/dev/null || echo '未知')"
    else
        error "cc-config 工具安装验证失败"
    fi
}

# 主安装函数
main() {
    echo "🚀 =================================================="
    echo "      Claude Code Kit - 简化安装程序"
    echo "      版本 3.0.0 - 极简版本"
    echo "=================================================="
    echo
    
    info "欢迎使用 Claude Code Kit 安装程序！"
    echo -e "${BLUE}📦 将要安装的内容:${NC}"
    echo "  • Claude Code CLI (最新版本)"
    echo "  • cc-config 管理工具"
    echo "  • 配置将在首次使用时自动同步"
    echo
    
    # 简单的 3 步安装
    echo -e "${BLUE}步骤 1/3:${NC} 检查 Node.js"
    check_nodejs
    
    echo -e "${BLUE}步骤 2/3:${NC} 安装 Claude Code CLI"  
    install_claude_code
    
    echo -e "${BLUE}步骤 3/3:${NC} 安装 cc-config 工具"
    install_cc_config
    
    echo
    echo "🎉 =================================================="
    success "Claude Code Kit 安装完成！"
    echo "=================================================="
    echo
    echo -e "${GREEN}✨ 已为您准备就绪:${NC}"
    echo "  ✅ Claude Code CLI 已安装并就绪"
    echo "  ✅ cc-config 工具已安装并就绪"
    echo "  ✅ 配置将在首次使用时自动同步"
    echo
    echo -e "${BLUE}🚀 接下来的步骤:${NC}"
    echo "  1️⃣  运行: cc-config provider add"
    echo "  2️⃣  配置将自动设置"
    echo "  3️⃣  使用您的别名开始与 Claude 对话"
    echo
    echo -e "${BLUE}📚 需要帮助?${NC}"
    echo "  🌐 文档: https://github.com/kedoupi/claude-code-kit"
    echo "  🐛 报告问题: https://github.com/kedoupi/claude-code-kit/issues"
    echo
}

# 如果脚本直接执行则运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi