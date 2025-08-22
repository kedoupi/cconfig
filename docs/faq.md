# Claude Code Kit 常见问题解答 (FAQ)

## 📋 目录

- [安装相关](#安装相关)
- [配置问题](#配置问题)
- [提供商管理](#提供商管理)
- [备份与恢复](#备份与恢复)
- [性能和连接](#性能和连接)
- [安全相关](#安全相关)
- [故障排除](#故障排除)
- [使用技巧](#使用技巧)

## 安装相关

### ❓ Q: 我的系统支持 Claude Code Kit 吗？

**A:** Claude Code Kit 支持以下系统：

✅ **支持的系统:**
- macOS 10.15+ (Catalina 及以上)
- Linux (Ubuntu 18.04+, CentOS 7+, Debian 10+)
- Windows (通过 WSL 2)

✅ **支持的 Shell:**
- bash 4.0+
- zsh 5.0+

✅ **必需的 Node.js 版本:**
- Node.js 18.0+ (推荐使用 22.x LTS)

---

### ❓ Q: 安装过程中提示 "权限被拒绝" 怎么办？

**A:** 这通常是因为缺少写入权限。解决方案：

```bash
# 方法 1: 使用 npm 用户目录安装
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g @kedoupi/claude-code-kit

# 方法 2: 使用 sudo (不推荐，但有时必要)
sudo npm install -g @kedoupi/claude-code-kit

# 方法 3: 从源码安装
git clone https://github.com/claude-code-kit/claude-code-kit.git
cd claude-code-kit && npm install && npm link
```

---

### ❓ Q: 安装后找不到 `cc-config` 命令？

**A:** 这通常是 PATH 配置问题：

```bash
# 1. 检查安装位置
npm list -g claude-code-kit

# 2. 查找 cc-config 位置
which cc-config
find /usr -name "cc-config" 2>/dev/null

# 3. 添加到 PATH (根据实际路径调整)
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 4. 或者使用完整路径测试
/usr/local/bin/cc-config --version
```

---

### ❓ Q: Node.js 版本太低怎么升级？

**A:** 升级 Node.js 的几种方法：

```bash
# 方法 1: 使用 nvm (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 方法 2: 直接下载安装
# 访问 https://nodejs.org 下载最新 LTS 版本

# 方法 3: 使用包管理器 (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 配置问题

### ❓ Q: 为什么我的别名命令不工作？

**A:** 别名不工作的常见原因和解决方法：

```bash
# 1. 检查别名文件是否存在
ls -la ~/.cc-config/aliases.sh

# 2. 检查是否已加载到 shell
grep "aliases.sh" ~/.bashrc ~/.zshrc

# 3. 手动重新生成别名
cc-config doctor --fix

# 4. 手动加载别名 (临时解决)
source ~/.cc-config/aliases.sh

# 5. 添加到 shell 配置文件 (永久解决)
echo "source ~/.cc-config/aliases.sh" >> ~/.zshrc
source ~/.zshrc
```

---

### ❓ Q: 配置文件在哪里，我可以手动编辑吗？

**A:** 配置文件位置和编辑方法：

```bash
# 主要配置目录
~/.cc-config/
├── config.json          # 全局配置
├── providers/            # 提供商配置
│   ├── claude-main.json
│   └── claude-work.json
├── aliases.sh           # 自动生成的别名
└── backups/             # 备份目录

# 安全编辑提供商配置
cc-config provider edit claude-main

# 手动编辑 (高级用户)
nano ~/.cc-config/providers/claude-main.json
# 编辑后重新生成别名
cc-config doctor --fix
```

**⚠️ 注意:** 手动编辑 JSON 文件时要确保格式正确，建议使用工具命令进行编辑。

---

### ❓ Q: 如何重置所有配置？

**A:** 完全重置配置的方法：

```bash
# 方法 1: 安全重置 (保留备份)
cc-config provider list  # 记录当前配置
mv ~/.cc-config ~/.cc-config.backup
cc-config doctor  # 重新初始化

# 方法 2: 完全清空
rm -rf ~/.cc-config
rm -rf ~/.claude
cc-config doctor  # 重新初始化

# 方法 3: 保留提供商配置，只重置其他
cp -r ~/.cc-config/providers ~/.cc-config-providers-backup
rm -rf ~/.cc-config
mkdir -p ~/.cc-config
mv ~/.cc-config-providers-backup ~/.cc-config/providers
cc-config doctor --fix
```

## 提供商管理

### ❓ Q: 我可以配置多少个提供商？

**A:** 理论上没有限制，但推荐做法：

- **个人使用**: 3-5 个提供商足够
- **团队使用**: 5-10 个提供商  
- **系统限制**: 最多 50 个提供商 (可在配置中调整)

```bash
# 查看当前配置的提供商数量
cc-config provider list | grep "Total:"

# 查看系统限制
jq '.settings.maxProviders' ~/.cc-config/config.json
```

---

### ❓ Q: 如何安全地存储和共享团队配置？

**A:** 团队配置管理最佳实践：

```bash
# 1. 创建配置模板 (去除 API 密钥)
mkdir team-templates
jq 'del(.apiKey)' ~/.cc-config/providers/claude-team.json > team-templates/claude-team-template.json

# 2. 版本控制模板
cd team-templates
git init
git add claude-team-template.json
git commit -m "Add team Claude configuration template"

# 3. 团队成员使用模板
git clone <team-config-repo>
cp team-templates/claude-team-template.json ~/.cc-config/providers/claude-team.json
cc-config provider edit claude-team  # 添加个人 API 密钥
```

---

### ❓ Q: 如何在不同项目中使用不同的提供商？

**A:** 项目特定提供商配置：

```bash
# 方法 1: 使用不同的别名
# 项目 A
claude-project-a "项目 A 的问题"

# 项目 B  
claude-project-b "项目 B 的问题"

# 方法 2: 使用环境变量 (高级)
# 在项目目录创建 .envrc
echo "export CLAUDE_PROVIDER=claude-work" > .envrc
# 使用 direnv 自动加载

# 方法 3: 项目配置脚本
echo '#!/bin/bash' > setup-project.sh
echo 'cc-config provider use claude-work' >> setup-project.sh
chmod +x setup-project.sh
```

---

### ❓ Q: 提供商配置时 API 密钥验证失败怎么办？

**A:** API 密钥问题排查：

```bash
# 1. 验证 API 密钥格式
# Anthropic API 密钥格式: sk-ant-api03-...

# 2. 手动测试 API 密钥
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-3-sonnet-20240229","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}' \
     https://api.anthropic.com/v1/messages

# 3. 检查 API 配额和权限
# 登录 Anthropic Console 查看 API 使用情况

# 4. 更新提供商配置
cc-config provider edit claude-main
```

## 备份与恢复

### ❓ Q: 备份多久清理一次，如何调整保留策略？

**A:** 备份管理配置：

```bash
# 查看当前备份保留设置
jq '.settings.backupRetention' ~/.cc-config/config.json

# 修改保留数量 (例如保留 20 个备份)
jq '.settings.backupRetention = 20' ~/.cc-config/config.json > tmp.json && mv tmp.json ~/.cc-config/config.json

# 手动清理旧备份
cd ~/.cc-config/backups
ls -t | tail -n +11 | xargs rm -rf  # 保留最新 10 个

# 查看备份大小
du -sh ~/.cc-config/backups/*
```

---

### ❓ Q: 备份在哪里，我可以手动备份吗？

**A:** 备份位置和手动备份方法：

```bash
# 备份位置
~/.cc-config/backups/
├── 20241201-120000/    # 按时间戳命名
├── 20241201-150000/
└── 20241201-180000/

# 手动创建备份
timestamp=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/.cc-config/backups/$timestamp
cp -r ~/.claude/* ~/.cc-config/backups/$timestamp/

# 创建备份脚本
cat > ~/backup-claude.sh << 'EOF'
#!/bin/bash
timestamp=$(date +%Y%m%d-%H%M%S)
backup_dir="$HOME/.cc-config/backups/$timestamp"
mkdir -p "$backup_dir"
cp -r "$HOME/.claude/"* "$backup_dir/" 2>/dev/null || true
echo "Backup created: $backup_dir"
EOF
chmod +x ~/backup-claude.sh
```

---

### ❓ Q: 恢复备份时出错怎么办？

**A:** 备份恢复故障排除：

```bash
# 1. 检查备份完整性
ls -la ~/.cc-config/backups/20241201-120000/

# 2. 验证备份内容
cc-config doctor  # 检查当前配置
file ~/.cc-config/backups/20241201-120000/*

# 3. 手动恢复 (如果自动恢复失败)
cp -r ~/.cc-config/backups/20241201-120000/* ~/.claude/
cc-config doctor --fix

# 4. 如果恢复后仍有问题
rm -rf ~/.claude
cp -r ~/.cc-config/backups/20241201-120000 ~/.claude
chmod -R 644 ~/.claude/*
cc-config doctor --fix
```

## 性能和连接

### ❓ Q: Claude Code Kit 响应很慢怎么办？

**A:** 性能优化方法：

```bash
# 1. 检查网络连接
ping api.anthropic.com
curl -w "@-" -o /dev/null -s "https://api.anthropic.com/" <<< "time_total: %{time_total}\n"

# 2. 调整超时设置
cc-config provider edit claude-main
# 增加 timeout 值，如 5000000 (5秒)

# 3. 测试不同提供商
time claude-main "测试消息"
time claude-work "测试消息"

# 4. 检查系统资源
top
htop
df -h  # 检查磁盘空间
```

---

### ❓ Q: 连接超时错误怎么解决？

**A:** 连接超时问题排查：

```bash
# 1. 检查网络连接
curl -I https://api.anthropic.com
nslookup api.anthropic.com

# 2. 检查防火墙设置
# macOS
sudo pfctl -sr | grep anthropic

# Linux  
sudo iptables -L | grep anthropic

# 3. 调整超时设置
cc-config provider edit claude-main
# 设置更长的超时时间

# 4. 使用代理 (如果在受限网络环境)
export https_proxy=http://proxy.company.com:8080
claude-main "测试消息"
```

---

### ❓ Q: 为什么某些命令执行很慢？

**A:** 命令执行慢的原因分析：

```bash
# 1. 使用 time 命令分析
time cc-config provider list
time claude-main "Hello"

# 2. 启用调试模式
CC_DEBUG=true cc-config doctor

# 3. 检查磁盘 I/O
iostat 1 5  # Linux
fs_usage | grep cc-config  # macOS

# 4. 优化配置文件
# 减少提供商数量
# 清理无用的备份
find ~/.cc-config/backups -mtime +30 -delete
```

## 安全相关

### ❓ Q: API 密钥安全吗？会被泄露吗？

**A:** API 密钥安全保护措施：

✅ **安全保护:**
- 配置文件权限设置为 600 (仅用户可读写)
- 密钥输入使用静默模式 (不显示在终端)
- 不在日志中记录敏感信息
- 支持环境变量方式传递密钥

```bash
# 检查文件权限
ls -la ~/.cc-config/providers/
# 应该显示: -rw------- (600 权限)

# 手动设置权限 (如果不正确)
chmod 600 ~/.cc-config/providers/*.json
chmod 700 ~/.cc-config/

# 使用环境变量 (更安全)
export CLAUDE_API_KEY="your-api-key"
# 在配置中引用环境变量
```

---

### ❓ Q: 如何在共享环境中安全使用？

**A:** 共享环境安全实践：

```bash
# 1. 使用临时配置
export CC_CONFIG_DIR="/tmp/cc-config-$$"
cc-config provider add
# 使用完后自动清理

# 2. 使用只读模式
chmod -R 444 ~/.cc-config/
# 或者使用 Docker 容器隔离

# 3. 避免在脚本中硬编码密钥
# ❌ 错误做法
echo "claude-main 'question'" > script.sh

# ✅ 正确做法  
read -s -p "Enter API key: " api_key
export CLAUDE_API_KEY="$api_key"
```

---

### ❓ Q: 怎么知道配置文件是否被篡改？

**A:** 配置完整性检查：

```bash
# 1. 使用内置验证
cc-config doctor

# 2. 创建配置文件校验和
cd ~/.cc-config
find . -name "*.json" -exec sha256sum {} \; > checksums.txt

# 3. 定期验证
sha256sum -c checksums.txt

# 4. 监控文件变化 (macOS)
fswatch ~/.cc-config -e ".*" --event Created --event Updated

# 4. 监控文件变化 (Linux)
inotifywait -m ~/.cc-config -e modify,create,delete
```

## 故障排除

### ❓ Q: 运行 `cc-config doctor` 报告多个错误怎么办？

**A:** 逐步解决 doctor 报告的问题：

```bash
# 1. 运行诊断并保存结果
cc-config doctor > diagnostic-report.txt 2>&1

# 2. 分类处理错误
# Node.js 环境问题
node --version  # 确保版本 >= 18

# 依赖项缺失
which jq || brew install jq  # macOS
which jq || sudo apt install jq  # Ubuntu

# 权限问题
sudo chown -R $USER:$USER ~/.cc-config
chmod -R 755 ~/.cc-config

# 3. 尝试自动修复
cc-config doctor --fix

# 4. 如果仍有问题，重新初始化
mv ~/.cc-config ~/.cc-config.backup
cc-config doctor
```

---

### ❓ Q: 错误信息看不懂，如何获取更多调试信息？

**A:** 获取详细调试信息：

```bash
# 1. 启用调试模式
export CC_DEBUG=true
cc-config provider add

# 2. 查看详细状态
cc-config status --detailed

# 3. 检查系统日志
# macOS
tail -f /var/log/system.log | grep cc-config

# Linux
journalctl -f | grep cc-config

# 4. 生成完整诊断报告
cat > collect-debug-info.sh << 'EOF'
#!/bin/bash
echo "=== System Info ===" > debug-report.txt
uname -a >> debug-report.txt
node --version >> debug-report.txt
npm --version >> debug-report.txt

echo -e "\n=== CC-Config Status ===" >> debug-report.txt
cc-config status --detailed >> debug-report.txt 2>&1

echo -e "\n=== Doctor Report ===" >> debug-report.txt
CC_DEBUG=true cc-config doctor >> debug-report.txt 2>&1

echo -e "\n=== File Structure ===" >> debug-report.txt
ls -laR ~/.cc-config >> debug-report.txt 2>&1
EOF
chmod +x collect-debug-info.sh
./collect-debug-info.sh
```

---

### ❓ Q: 升级后出现兼容性问题怎么办？

**A:** 版本兼容性问题解决：

```bash
# 1. 检查版本信息
cc-config --version
npm list -g claude-code-kit

# 2. 备份现有配置
cp -r ~/.cc-config ~/.cc-config-backup-$(date +%Y%m%d)

# 3. 降级到之前版本 (如果需要)
npm install -g @kedoupi/claude-code-kit@0.9.0

# 4. 或者重新安装最新版本
npm uninstall -g claude-code-kit
npm install -g @kedoupi/claude-code-kit

# 5. 迁移旧配置
cc-config doctor --fix
```

## 使用技巧

### ❓ Q: 有没有快捷方式或者提高效率的技巧？

**A:** 实用技巧和快捷方式：

```bash
# 1. 创建常用别名
echo 'alias ccp="cc-config provider"' >> ~/.zshrc
echo 'alias ccl="cc-config provider list"' >> ~/.zshrc
echo 'alias ccd="cc-config doctor"' >> ~/.zshrc

# 2. 快速切换提供商
function use-claude() {
    cc-config provider use "$1"
}

# 3. 批量操作脚本
cat > ~/claude-tools.sh << 'EOF'
#!/bin/bash
# 测试所有提供商
function test-all() {
    for provider in $(cc-config provider list --format=json | jq -r '.[].alias'); do
        echo "Testing $provider..."
        $provider "Hello" || echo "  ✗ Failed"
    done
}

# 备份所有配置
function backup-all() {
    timestamp=$(date +%Y%m%d-%H%M%S)
    tar -czf "claude-config-backup-$timestamp.tar.gz" ~/.cc-config
    echo "Backup saved: claude-config-backup-$timestamp.tar.gz"
}
EOF
source ~/claude-tools.sh
```

---

### ❓ Q: 如何在脚本中使用 Claude Code Kit？

**A:** 脚本集成示例：

```bash
# 1. 基础脚本模板
#!/bin/bash
set -e

# 检查提供商可用性
if ! command -v claude-main &> /dev/null; then
    echo "Error: claude-main provider not configured"
    exit 1
fi

# 使用提供商
response=$(claude-main "$1")
echo "Response: $response"

# 2. 错误处理脚本
#!/bin/bash
function safe_claude() {
    local provider="$1"
    local message="$2"
    local max_retries=3
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if $provider "$message"; then
            return 0
        fi
        retry=$((retry + 1))
        echo "Retry $retry/$max_retries..."
        sleep 2
    done
    
    echo "Failed after $max_retries attempts"
    return 1
}

# 使用
safe_claude claude-main "Your question"

# 3. 配置检查脚本
#!/bin/bash
check_claude_config() {
    # 检查工具是否安装
    if ! command -v cc-config &> /dev/null; then
        echo "❌ Claude Code Kit not installed"
        return 1
    fi
    
    # 检查提供商配置
    local providers=$(cc-config provider list 2>/dev/null | grep -c "✓ Active" || echo "0")
    if [ "$providers" -eq 0 ]; then
        echo "❌ No active providers configured"
        return 1
    fi
    
    echo "✅ Claude Code Kit ready ($providers providers)"
    return 0
}
```

---

### ❓ Q: 如何监控 API 使用情况和成本？

**A:** API 使用监控方法：

```bash
# 1. 创建使用日志
cat > ~/.cc-config/log-usage.sh << 'EOF'
#!/bin/bash
original_claude="$(which claude-main)"
function claude-main() {
    echo "$(date): claude-main called with: $*" >> ~/.cc-config/usage.log
    $original_claude "$@"
}
EOF

# 2. 分析使用模式
cat > ~/analyze-usage.sh << 'EOF'
#!/bin/bash
echo "=== Claude Usage Analysis ==="
echo "Total requests: $(wc -l < ~/.cc-config/usage.log)"
echo "Requests today: $(grep "$(date +%Y-%m-%d)" ~/.cc-config/usage.log | wc -l)"
echo "Most active hours:"
awk '{print substr($4,1,2)}' ~/.cc-config/usage.log | sort | uniq -c | sort -nr
EOF

# 3. 成本估算脚本
function estimate-cost() {
    local requests=$(grep -c "claude-main" ~/.cc-config/usage.log)
    local estimated_tokens=$((requests * 100))  # 估算每请求100 tokens
    local cost=$(echo "scale=4; $estimated_tokens * 0.01 / 1000" | bc)  # 示例价格
    echo "Estimated cost: \$$cost USD"
}
```

---

### ❓ Q: 团队如何标准化 Claude Code Kit 配置？

**A:** 团队标准化最佳实践：

```bash
# 1. 创建团队配置仓库
mkdir team-claude-config
cd team-claude-config

# 2. 标准配置模板
cat > claude-team-template.json << 'EOF'
{
  "alias": "claude-team",
  "baseURL": "https://api.anthropic.com",
  "timeout": 3000000,
  "metadata": {
    "description": "Team standard configuration",
    "team": "development",
    "environment": "production"
  }
}
EOF

# 3. 团队安装脚本
cat > setup-team-config.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Setting up team Claude configuration..."

# 安装 Claude Code Kit
if ! command -v cc-config &> /dev/null; then
    npm install -g @kedoupi/claude-code-kit
fi

# 复制团队模板
cp claude-team-template.json ~/.cc-config/providers/claude-team.json

# 提示用户添加 API 密钥
echo "Please add your API key:"
cc-config provider edit claude-team

echo "✅ Team configuration setup complete!"
EOF

# 4. 版本控制
git init
git add .
git commit -m "Initial team Claude configuration"
```

---

这些常见问题应该能解决大部分用户在使用 Claude Code Kit 时遇到的问题。如果您遇到的问题不在此列表中，请：

1. 查看 [用户手册](user-guide.md) 获取更详细信息
2. 在 [GitHub Issues](https://github.com/claude-code-kit/claude-code-kit/issues) 搜索类似问题
3. 提交新的 issue 并附上详细的错误信息和系统环境

我们会持续更新这个 FAQ 来包含更多用户反馈的问题。