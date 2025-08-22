# Claude Code Kit 使用示例集合

## 📋 目录

- [基础使用示例](#基础使用示例)
- [多提供商配置示例](#多提供商配置示例)
- [团队协作示例](#团队协作示例)
- [高级配置示例](#高级配置示例)
- [脚本集成示例](#脚本集成示例)
- [CI/CD 集成示例](#cicd-集成示例)
- [故障排除示例](#故障排除示例)
- [自动化脚本示例](#自动化脚本示例)

## 基础使用示例

### 示例 1: 第一次安装和配置

```bash
# 场景：全新安装 Claude Code Kit
# 目标：5分钟内完成安装并开始使用

# 步骤 1: 安装
curl -fsSL https://raw.githubusercontent.com/claude-code-kit/claude-code-kit/main/install.sh | bash

# 步骤 2: 验证安装
cc-config --version
# 输出: Claude Code Kit Configuration Manager 1.0.0

# 步骤 3: 运行系统检查
cc-config doctor
# 确保所有检查项都是 ✅

# 步骤 4: 配置第一个提供商
cc-config provider add

# 交互式配置:
# ? Provider alias (command name): claude-personal
# ? API Base URL: https://api.anthropic.com
# ? API Key: [您的API密钥]
# ? Request timeout (ms): 3000000

# 步骤 5: 重新加载 shell
source ~/.zshrc  # 或 source ~/.bashrc

# 步骤 6: 测试配置
claude-personal "你好！请介绍一下你自己。"

# 预期输出：Claude 的回复
```

### 示例 2: 查看和管理现有配置

```bash
# 场景：检查当前配置状态
# 目标：了解系统中配置的所有提供商

# 查看所有提供商
cc-config provider list
# 输出示例:
# 📡 Configured API Providers
# 
# Alias           Base URL                        Status
# ──────────────────────────────────────────────────────────
# claude-personal https://api.anthropic.com       ✓ Active
# 
# 💡 Total: 1 provider(s) configured

# 查看特定提供商详情
cc-config provider show claude-personal
# 输出示例:
# 📡 Provider Information: claude-personal
# 
# Configuration:
#   Alias: claude-personal
#   Base URL: https://api.anthropic.com
#   Timeout: 3000000ms
#   Created: 2024-12-01T12:00:00Z

# 查看系统状态
cc-config status
# 输出包括系统信息、配置信息、目录状态等

# 详细状态
cc-config status --detailed
# 包含提供商详情和备份统计
```

## 多提供商配置示例

### 示例 3: 配置工作和个人环境

```bash
# 场景：设置工作和个人两套 Claude 配置
# 目标：根据使用场景切换不同的配置

# 步骤 1: 配置工作环境
cc-config provider add
# 配置信息:
# Alias: claude-work
# Base URL: https://api.anthropic.com
# API Key: [工作API密钥]

# 步骤 2: 配置个人环境
cc-config provider add
# 配置信息:
# Alias: claude-personal
# Base URL: https://api.anthropic.com
# API Key: [个人API密钥]

# 步骤 3: 验证配置
cc-config provider list
# 现在应该看到两个提供商

# 步骤 4: 分别使用
# 工作相关问题
claude-work "请帮我审查这段代码的安全性"

# 个人项目问题
claude-personal "推荐一些学习 Python 的资源"

# 步骤 5: 设置默认提供商
cc-config provider use claude-work
# 现在工作配置成为默认选择
```

### 示例 4: 多环境配置 (开发/测试/生产)

```bash
# 场景：为不同环境配置不同的 Claude 设置
# 目标：实现环境隔离和配置管理

# 开发环境配置
cc-config provider add
# Alias: claude-dev
# Base URL: https://api.anthropic.com
# API Key: [开发环境API密钥]
# Timeout: 5000000  # 开发环境可以设置更长超时

# 测试环境配置
cc-config provider add
# Alias: claude-test
# Base URL: https://api.anthropic.com
# API Key: [测试环境API密钥]
# Timeout: 3000000

# 生产环境配置
cc-config provider add
# Alias: claude-prod
# Base URL: https://api.anthropic.com
# API Key: [生产环境API密钥]
# Timeout: 10000000  # 生产环境设置更长超时

# 创建环境切换脚本
cat > ~/switch-claude-env.sh << 'EOF'
#!/bin/bash
case "$1" in
    dev)
        cc-config provider use claude-dev
        echo "✅ Switched to development environment"
        ;;
    test)
        cc-config provider use claude-test
        echo "✅ Switched to testing environment"
        ;;
    prod)
        cc-config provider use claude-prod
        echo "✅ Switched to production environment"
        ;;
    *)
        echo "Usage: $0 {dev|test|prod}"
        echo "Current providers:"
        cc-config provider list
        ;;
esac
EOF

chmod +x ~/switch-claude-env.sh

# 使用示例
~/switch-claude-env.sh dev   # 切换到开发环境
claude-dev "开发环境测试"

~/switch-claude-env.sh prod  # 切换到生产环境
claude-prod "生产环境查询"
```

## 团队协作示例

### 示例 5: 团队标准化配置

```bash
# 场景：为团队创建标准化的 Claude 配置
# 目标：确保团队成员使用一致的配置

# 步骤 1: 创建团队配置仓库
mkdir team-claude-config
cd team-claude-config

# 步骤 2: 创建配置模板
cat > claude-team-template.json << 'EOF'
{
  "alias": "claude-team",
  "baseURL": "https://api.anthropic.com",
  "timeout": 3000000,
  "metadata": {
    "description": "Team standard configuration",
    "team": "development",
    "environment": "shared",
    "maintainer": "devops@company.com"
  }
}
EOF

# 步骤 3: 创建团队安装脚本
cat > setup-team-claude.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Setting up team Claude configuration..."

# 检查 Claude Code Kit 是否安装
if ! command -v cc-config &> /dev/null; then
    echo "Installing Claude Code Kit..."
    npm install -g @kedoupi/claude-code-kit
fi

# 创建提供商配置目录
mkdir -p ~/.cc-config/providers

# 复制团队模板
cp claude-team-template.json ~/.cc-config/providers/claude-team.json

echo "✅ Team template installed!"
echo "📝 Please add your API key:"
read -s -p "Enter your API key: " api_key
echo

# 更新配置文件中的 API 密钥
if command -v jq &> /dev/null; then
    jq --arg key "$api_key" '.apiKey = $key' ~/.cc-config/providers/claude-team.json > tmp.json
    mv tmp.json ~/.cc-config/providers/claude-team.json
else
    echo "⚠️  Please manually edit ~/.cc-config/providers/claude-team.json to add your API key"
fi

# 重新生成别名
cc-config doctor --fix

echo "🎉 Team configuration setup complete!"
echo "💡 Test with: claude-team 'Hello from team config'"
EOF

chmod +x setup-team-claude.sh

# 步骤 4: 创建使用文档
cat > README.md << 'EOF'
# Team Claude Configuration

## 快速开始

1. 克隆此仓库:
   ```bash
   git clone <repo-url>
   cd team-claude-config
   ```

2. 运行安装脚本:
   ```bash
   ./setup-team-claude.sh
   ```

3. 测试配置:
   ```bash
   claude-team "Hello from team config"
   ```

## 团队规范

- 使用 `claude-team` 作为标准命令
- 超时设置: 3000000ms (3秒)
- 问题反馈: devops@company.com

## 更新配置

```bash
git pull
./setup-team-claude.sh
```
EOF

# 步骤 5: 版本控制
git init
git add .
git commit -m "Initial team Claude configuration"
git remote add origin <your-team-repo>
git push -u origin main
```

### 示例 6: 共享配置模板

```bash
# 场景：创建可复用的配置模板
# 目标：不同团队或项目快速复制配置

# 创建模板目录
mkdir -p ~/claude-templates

# 创建基础模板
cat > ~/claude-templates/anthropic-basic.json << 'EOF'
{
  "alias": "claude-basic",
  "baseURL": "https://api.anthropic.com",
  "timeout": 3000000,
  "metadata": {
    "template": "anthropic-basic",
    "description": "Basic Anthropic Claude configuration"
  }
}
EOF

# 创建高性能模板
cat > ~/claude-templates/anthropic-performance.json << 'EOF'
{
  "alias": "claude-fast",
  "baseURL": "https://api.anthropic.com",
  "timeout": 10000000,
  "metadata": {
    "template": "anthropic-performance",
    "description": "High-performance Claude configuration for long tasks"
  }
}
EOF

# 创建模板应用脚本
cat > ~/apply-template.sh << 'EOF'
#!/bin/bash

TEMPLATE_DIR="$HOME/claude-templates"
CONFIG_DIR="$HOME/.cc-config/providers"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <template-name> <provider-alias>"
    echo "Available templates:"
    ls "$TEMPLATE_DIR"/*.json | xargs -n1 basename | sed 's/.json$//'
    exit 1
fi

template="$1"
alias="$2"

template_file="$TEMPLATE_DIR/$template.json"
config_file="$CONFIG_DIR/$alias.json"

if [ ! -f "$template_file" ]; then
    echo "❌ Template not found: $template"
    exit 1
fi

# 复制模板并更新别名
jq --arg alias "$alias" '.alias = $alias' "$template_file" > "$config_file"

echo "✅ Template applied: $template -> $alias"
echo "📝 Please add your API key:"
cc-config provider edit "$alias"
EOF

chmod +x ~/apply-template.sh

# 使用模板
~/apply-template.sh anthropic-basic my-claude
~/apply-template.sh anthropic-performance claude-heavy
```

## 高级配置示例

### 示例 7: 自定义超时和重试机制

```bash
# 场景：为不同类型的任务配置不同的超时设置
# 目标：优化性能和用户体验

# 快速响应配置 (短超时)
cc-config provider add
# Alias: claude-quick
# Timeout: 5000  # 5秒，适合简单问题

# 标准配置
cc-config provider add
# Alias: claude-standard
# Timeout: 30000  # 30秒，适合一般问题

# 长时间任务配置
cc-config provider add
# Alias: claude-long
# Timeout: 300000  # 5分钟，适合复杂分析

# 创建智能路由脚本
cat > ~/smart-claude.sh << 'EOF'
#!/bin/bash

message="$1"
length=${#message}

if [ $length -lt 50 ]; then
    echo "Using quick provider for short message..."
    claude-quick "$message"
elif [ $length -lt 500 ]; then
    echo "Using standard provider for medium message..."
    claude-standard "$message"
else
    echo "Using long provider for complex message..."
    claude-long "$message"
fi
EOF

chmod +x ~/smart-claude.sh

# 使用示例
~/smart-claude.sh "Hello"  # 使用 claude-quick
~/smart-claude.sh "Please analyze this code and provide detailed feedback..."  # 使用 claude-long
```

### 示例 8: 配置文件加密和安全

```bash
# 场景：在敏感环境中保护 API 密钥
# 目标：加密存储配置文件

# 创建加密配置脚本
cat > ~/secure-claude-config.sh << 'EOF'
#!/bin/bash

SECURE_DIR="$HOME/.cc-config-secure"
CONFIG_DIR="$HOME/.cc-config"

# 加密配置
encrypt_config() {
    if [ ! -d "$CONFIG_DIR" ]; then
        echo "❌ No configuration found to encrypt"
        return 1
    fi
    
    mkdir -p "$SECURE_DIR"
    tar -czf - -C "$CONFIG_DIR" . | gpg -c > "$SECURE_DIR/config.tar.gz.gpg"
    echo "✅ Configuration encrypted to $SECURE_DIR/config.tar.gz.gpg"
}

# 解密配置
decrypt_config() {
    if [ ! -f "$SECURE_DIR/config.tar.gz.gpg" ]; then
        echo "❌ No encrypted configuration found"
        return 1
    fi
    
    mkdir -p "$CONFIG_DIR"
    gpg -d "$SECURE_DIR/config.tar.gz.gpg" | tar -xzf - -C "$CONFIG_DIR"
    echo "✅ Configuration decrypted to $CONFIG_DIR"
}

# 安全清理
cleanup_config() {
    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "$CONFIG_DIR"
        echo "✅ Configuration cleaned up"
    fi
}

case "$1" in
    encrypt)
        encrypt_config
        ;;
    decrypt)
        decrypt_config
        ;;
    cleanup)
        cleanup_config
        ;;
    *)
        echo "Usage: $0 {encrypt|decrypt|cleanup}"
        ;;
esac
EOF

chmod +x ~/secure-claude-config.sh

# 使用示例
# 加密当前配置
~/secure-claude-config.sh encrypt

# 清理明文配置
~/secure-claude-config.sh cleanup

# 需要使用时解密
~/secure-claude-config.sh decrypt
cc-config provider list

# 使用完后再次清理
~/secure-claude-config.sh cleanup
```

## 脚本集成示例

### 示例 9: 代码审查自动化

```bash
# 场景：将 Claude 集成到代码审查流程
# 目标：自动化代码质量检查

# 创建代码审查脚本
cat > ~/code-review.sh << 'EOF'
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> [file2] ..."
    exit 1
fi

echo "🔍 Starting automated code review..."

for file in "$@"; do
    if [ ! -f "$file" ]; then
        echo "❌ File not found: $file"
        continue
    fi
    
    echo "📝 Reviewing: $file"
    
    # 获取文件内容和扩展名
    content=$(cat "$file")
    extension="${file##*.}"
    
    # 构建审查请求
    prompt="请审查以下 $extension 代码，重点关注：
1. 代码质量和可读性
2. 潜在的 bug 和安全问题
3. 性能优化建议
4. 最佳实践建议

代码内容：
\`\`\`$extension
$content
\`\`\`"
    
    # 调用 Claude 进行审查
    echo "🤖 AI Review for $file:"
    echo "----------------------------------------"
    if claude-work "$prompt"; then
        echo "✅ Review completed for $file"
    else
        echo "❌ Review failed for $file"
    fi
    echo
done

echo "🎉 Code review completed!"
EOF

chmod +x ~/code-review.sh

# 使用示例
~/code-review.sh src/main.js src/utils.js

# 集成到 git hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# 获取将要提交的文件
files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|py|go|java)$')

if [ ! -z "$files" ]; then
    echo "Running automated code review..."
    ~/code-review.sh $files
    
    echo "Continue with commit? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Commit cancelled"
        exit 1
    fi
fi
EOF

chmod +x .git/hooks/pre-commit
```

### 示例 10: 文档生成自动化

```bash
# 场景：自动生成和更新项目文档
# 目标：保持文档与代码同步

# 创建文档生成脚本
cat > ~/generate-docs.sh << 'EOF'
#!/bin/bash

PROJECT_DIR="$1"
DOCS_DIR="$PROJECT_DIR/docs"

if [ -z "$PROJECT_DIR" ] || [ ! -d "$PROJECT_DIR" ]; then
    echo "Usage: $0 <project-directory>"
    exit 1
fi

mkdir -p "$DOCS_DIR"
cd "$PROJECT_DIR"

echo "📚 Generating project documentation..."

# 1. 生成 README
echo "🔄 Generating README.md..."
readme_prompt="基于以下项目结构和代码，生成一个专业的 README.md 文档：

项目结构：
$(find . -type f -name "*.js" -o -name "*.py" -o -name "*.go" | head -20)

主要文件内容：
$(find . -name "package.json" -o -name "requirements.txt" -o -name "go.mod" | xargs cat 2>/dev/null)

请包含：
1. 项目描述
2. 安装说明
3. 使用示例
4. API 文档（如果适用）
5. 贡献指南"

claude-work "$readme_prompt" > README.md

# 2. 生成 API 文档
if [ -f "package.json" ]; then
    echo "🔄 Generating API documentation..."
    api_prompt="分析以下 JavaScript 项目，生成 API 文档：

$(find . -name "*.js" | head -10 | xargs cat)

请生成详细的 API 文档，包括：
1. 函数签名
2. 参数说明
3. 返回值
4. 使用示例"
    
    claude-work "$api_prompt" > "$DOCS_DIR/api.md"
fi

# 3. 生成变更日志
echo "🔄 Updating CHANGELOG.md..."
if [ -d ".git" ]; then
    recent_commits=$(git log --oneline -10)
    changelog_prompt="基于以下 git 提交记录，更新 CHANGELOG.md：

最近提交：
$recent_commits

请按照 Keep a Changelog 格式更新文档。"
    
    claude-work "$changelog_prompt" > CHANGELOG.md
fi

echo "✅ Documentation generation completed!"
echo "📄 Generated files:"
ls -la README.md CHANGELOG.md "$DOCS_DIR"/ 2>/dev/null || true
EOF

chmod +x ~/generate-docs.sh

# 使用示例
~/generate-docs.sh ~/my-project

# 集成到构建流程
cat > ~/update-docs-on-push.sh << 'EOF'
#!/bin/bash
# 在 git push 后自动更新文档

# 检查是否有新的提交
if git diff --quiet HEAD^ HEAD; then
    echo "No changes detected"
    exit 0
fi

echo "🔄 Updating documentation after push..."
~/generate-docs.sh "$(pwd)"

# 提交文档更新
if ! git diff --quiet; then
    git add README.md CHANGELOG.md docs/
    git commit -m "docs: Update documentation [auto-generated]"
    git push
    echo "✅ Documentation updated and pushed"
fi
EOF

chmod +x ~/update-docs-on-push.sh
```

## CI/CD 集成示例

### 示例 11: GitHub Actions 集成

```yaml
# 场景：在 CI/CD 流程中使用 Claude Code Kit
# 目标：自动化测试和文档生成

# .github/workflows/claude-integration.yml
name: Claude Integration

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  code-review:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install Claude Code Kit
      run: npm install -g @kedoupi/claude-code-kit
      
    - name: Configure Claude provider
      env:
        CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
      run: |
        # 创建配置目录
        mkdir -p ~/.cc-config/providers
        
        # 创建提供商配置
        cat > ~/.cc-config/providers/claude-ci.json << EOF
        {
          "alias": "claude-ci",
          "baseURL": "https://api.anthropic.com",
          "apiKey": "$CLAUDE_API_KEY",
          "timeout": 30000
        }
        EOF
        
        # 生成别名
        cc-config doctor --fix
        
    - name: Run code review
      run: |
        # 获取变更的文件
        changed_files=$(git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -E '\.(js|py|go|java)$' || true)
        
        if [ ! -z "$changed_files" ]; then
          echo "Running Claude code review on changed files..."
          for file in $changed_files; do
            if [ -f "$file" ]; then
              echo "Reviewing $file..."
              review_result=$(claude-ci "请审查以下代码文件 $file 的质量、安全性和最佳实践：$(cat $file)")
              echo "## Review for $file" >> review_results.md
              echo "$review_result" >> review_results.md
              echo "" >> review_results.md
            fi
          done
        else
          echo "No code files changed"
        fi
        
    - name: Comment PR with review
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          if (fs.existsSync('review_results.md')) {
            const review = fs.readFileSync('review_results.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🤖 Claude Code Review\n\n${review}`
            });
          }

  update-docs:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install Claude Code Kit
      run: npm install -g @kedoupi/claude-code-kit
      
    - name: Configure Claude provider
      env:
        CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
      run: |
        mkdir -p ~/.cc-config/providers
        cat > ~/.cc-config/providers/claude-docs.json << EOF
        {
          "alias": "claude-docs",
          "baseURL": "https://api.anthropic.com",
          "apiKey": "$CLAUDE_API_KEY",
          "timeout": 60000
        }
        EOF
        cc-config doctor --fix
        
    - name: Generate documentation
      run: |
        # 生成 README
        project_info=$(cat package.json 2>/dev/null || echo "{}")
        file_structure=$(find . -name "*.js" -o -name "*.py" | head -20)
        
        readme_content=$(claude-docs "基于以下项目信息生成专业的 README.md：
        
        项目信息：$project_info
        文件结构：$file_structure
        
        请包含安装、使用、API文档等部分。")
        
        echo "$readme_content" > README.md
        
        # 生成 CHANGELOG
        if [ -d ".git" ]; then
          recent_commits=$(git log --oneline -20)
          changelog_content=$(claude-docs "基于以下提交记录生成 CHANGELOG.md：
          
          $recent_commits
          
          请按照 Keep a Changelog 格式。")
          
          echo "$changelog_content" > CHANGELOG.md
        fi
        
    - name: Commit and push if changed
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        
        if ! git diff --quiet; then
          git add README.md CHANGELOG.md
          git commit -m "docs: Auto-update documentation [skip ci]"
          git push
        fi
```

### 示例 12: Jenkins 流水线集成

```groovy
// 场景：Jenkins 流水线中使用 Claude Code Kit
// 目标：质量检查和自动化测试

pipeline {
    agent any
    
    environment {
        CLAUDE_API_KEY = credentials('claude-api-key')
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    // 安装 Claude Code Kit
                    sh '''
                        npm install -g @kedoupi/claude-code-kit
                        
                        # 配置提供商
                        mkdir -p ~/.cc-config/providers
                        cat > ~/.cc-config/providers/claude-jenkins.json << EOF
{
  "alias": "claude-jenkins",
  "baseURL": "https://api.anthropic.com",
  "apiKey": "${CLAUDE_API_KEY}",
  "timeout": 45000
}
EOF
                        
                        # 生成别名
                        cc-config doctor --fix
                    '''
                }
            }
        }
        
        stage('Code Quality Check') {
            steps {
                script {
                    // 使用 Claude 进行代码质量检查
                    sh '''
                        echo "Running Claude code quality check..."
                        
                        # 获取变更的文件
                        changed_files=$(git diff --name-only HEAD~1 HEAD | grep -E '\\.(js|py|java)$' || true)
                        
                        if [ ! -z "$changed_files" ]; then
                            for file in $changed_files; do
                                if [ -f "$file" ]; then
                                    echo "Analyzing $file..."
                                    claude-jenkins "分析以下代码的质量问题并给出改进建议：$(cat $file)" > "quality_report_${file//\//_}.txt"
                                fi
                            done
                        fi
                    '''
                    
                    // 归档质量报告
                    archiveArtifacts artifacts: 'quality_report_*.txt', allowEmptyArchive: true
                }
            }
        }
        
        stage('Generate Test Cases') {
            steps {
                script {
                    sh '''
                        echo "Generating test cases with Claude..."
                        
                        # 找到主要的源码文件
                        main_files=$(find src -name "*.js" | head -5)
                        
                        for file in $main_files; do
                            echo "Generating tests for $file..."
                            test_content=$(claude-jenkins "为以下代码生成详细的单元测试：$(cat $file)")
                            test_file="tests/generated_$(basename $file .js)_test.js"
                            mkdir -p tests
                            echo "$test_content" > "$test_file"
                        done
                    '''
                }
            }
        }
        
        stage('Security Analysis') {
            steps {
                script {
                    sh '''
                        echo "Running security analysis..."
                        
                        # 分析潜在的安全问题
                        security_files=$(find . -name "*.js" -o -name "*.py" | grep -v node_modules | head -10)
                        
                        for file in $security_files; do
                            echo "Security check: $file"
                            security_report=$(claude-jenkins "分析以下代码的安全漏洞和潜在风险：$(cat $file)")
                            echo "File: $file" >> security_report.md
                            echo "$security_report" >> security_report.md
                            echo "---" >> security_report.md
                        done
                    '''
                    
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'security_report.md',
                        reportName: 'Security Analysis Report'
                    ])
                }
            }
        }
    }
    
    post {
        always {
            // 清理配置
            sh 'rm -rf ~/.cc-config/providers/claude-jenkins.json'
        }
        
        failure {
            // 发送失败通知
            sh '''
                failure_report=$(claude-jenkins "生成构建失败报告，包含可能的原因和解决建议")
                echo "$failure_report" > build_failure_report.txt
            '''
            archiveArtifacts artifacts: 'build_failure_report.txt'
        }
    }
}
```

## 故障排除示例

### 示例 13: 诊断和修复常见问题

```bash
# 场景：系统出现问题时的诊断和修复流程
# 目标：快速定位和解决问题

# 创建综合诊断脚本
cat > ~/claude-troubleshoot.sh << 'EOF'
#!/bin/bash

echo "🔧 Claude Code Kit 故障排除工具"
echo "================================"

# 收集系统信息
collect_system_info() {
    echo "📊 收集系统信息..."
    
    cat > system_info.txt << INFO
System Information
==================
Date: $(date)
OS: $(uname -a)
Node.js: $(node --version 2>/dev/null || echo "Not installed")
npm: $(npm --version 2>/dev/null || echo "Not installed")
Shell: $SHELL
User: $USER
Home: $HOME

Claude Code Kit
===============
Version: $(cc-config --version 2>/dev/null || echo "Not installed")
Config Directory: $HOME/.cc-config
Claude Directory: $HOME/.claude

INFO
    
    echo "✅ 系统信息收集完成"
}

# 检查安装状态
check_installation() {
    echo "🔍 检查安装状态..."
    
    # 检查 cc-config 命令
    if command -v cc-config &> /dev/null; then
        echo "✅ cc-config 命令可用"
    else
        echo "❌ cc-config 命令不可用"
        echo "   解决方案: npm install -g @kedoupi/claude-code-kit"
        return 1
    fi
    
    # 检查配置目录
    if [ -d "$HOME/.cc-config" ]; then
        echo "✅ 配置目录存在"
    else
        echo "❌ 配置目录不存在"
        echo "   解决方案: cc-config doctor"
        return 1
    fi
    
    # 检查别名文件
    if [ -f "$HOME/.cc-config/aliases.sh" ]; then
        echo "✅ 别名文件存在"
    else
        echo "❌ 别名文件不存在"
        echo "   解决方案: cc-config doctor --fix"
        return 1
    fi
    
    return 0
}

# 检查提供商配置
check_providers() {
    echo "🔍 检查提供商配置..."
    
    provider_count=$(ls ~/.cc-config/providers/*.json 2>/dev/null | wc -l)
    if [ "$provider_count" -eq 0 ]; then
        echo "❌ 没有配置的提供商"
        echo "   解决方案: cc-config provider add"
        return 1
    else
        echo "✅ 发现 $provider_count 个提供商"
    fi
    
    # 测试每个提供商
    for provider_file in ~/.cc-config/providers/*.json; do
        if [ -f "$provider_file" ]; then
            alias_name=$(jq -r '.alias' "$provider_file" 2>/dev/null)
            if [ "$alias_name" != "null" ] && [ ! -z "$alias_name" ]; then
                echo "  📡 测试提供商: $alias_name"
                if timeout 10 $alias_name "test" &>/dev/null; then
                    echo "    ✅ $alias_name 工作正常"
                else
                    echo "    ❌ $alias_name 连接失败"
                    echo "       检查 API 密钥和网络连接"
                fi
            fi
        fi
    done
    
    return 0
}

# 修复常见问题
fix_common_issues() {
    echo "🔧 尝试修复常见问题..."
    
    # 修复权限问题
    echo "  🔒 修复文件权限..."
    chmod -R 755 ~/.cc-config 2>/dev/null || true
    chmod 600 ~/.cc-config/providers/*.json 2>/dev/null || true
    
    # 重新生成别名
    echo "  🔄 重新生成别名..."
    if command -v cc-config &> /dev/null; then
        cc-config doctor --fix
    fi
    
    # 检查 shell 配置
    echo "  🐚 检查 shell 配置..."
    if ! grep -q "aliases.sh" ~/.bashrc ~/.zshrc 2>/dev/null; then
        shell_config=""
        if [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
            shell_config="~/.zshrc"
        else
            shell_config="~/.bashrc"
        fi
        
        echo "    添加别名加载到 $shell_config"
        echo "source ~/.cc-config/aliases.sh" >> "$shell_config"
    fi
    
    echo "✅ 常见问题修复完成"
}

# 生成诊断报告
generate_report() {
    echo "📋 生成诊断报告..."
    
    cat > diagnostic_report.txt << REPORT
Claude Code Kit 诊断报告
======================
生成时间: $(date)

$(cat system_info.txt)

检查结果
========
$(cc-config doctor 2>&1 || echo "doctor 命令执行失败")

提供商列表
==========
$(cc-config provider list 2>&1 || echo "无法获取提供商列表")

配置文件
========
$(find ~/.cc-config -name "*.json" -exec echo "File: {}" \; -exec cat {} \; 2>/dev/null || echo "无法读取配置文件")

建议操作
========
1. 运行: cc-config doctor --fix
2. 重新加载 shell: source ~/.zshrc
3. 测试提供商: claude-[alias] "test"
4. 如果问题持续，请提交 issue 并附上此报告

REPORT
    
    echo "✅ 诊断报告已生成: diagnostic_report.txt"
}

# 主流程
main() {
    collect_system_info
    
    if check_installation; then
        check_providers
    fi
    
    fix_common_issues
    generate_report
    
    echo ""
    echo "🎉 故障排除完成！"
    echo "📄 请查看 diagnostic_report.txt 获取详细信息"
    echo "💡 如果问题仍然存在，请在 GitHub 上提交 issue"
}

main "$@"
EOF

chmod +x ~/claude-troubleshoot.sh

# 使用示例
~/claude-troubleshoot.sh
```

## 自动化脚本示例

### 示例 14: 定期维护脚本

```bash
# 场景：定期维护 Claude Code Kit 配置
# 目标：保持系统健康和性能

# 创建维护脚本
cat > ~/claude-maintenance.sh << 'EOF'
#!/bin/bash

MAINTENANCE_LOG="$HOME/.cc-config/maintenance.log"
BACKUP_RETENTION=30  # 保留30天的备份

log_message() {
    echo "$(date): $1" | tee -a "$MAINTENANCE_LOG"
}

# 清理旧备份
cleanup_old_backups() {
    log_message "开始清理旧备份..."
    
    backup_dir="$HOME/.cc-config/backups"
    if [ -d "$backup_dir" ]; then
        # 删除超过保留期的备份
        find "$backup_dir" -type d -mtime +$BACKUP_RETENTION -exec rm -rf {} \; 2>/dev/null || true
        
        remaining_backups=$(ls "$backup_dir" | wc -l)
        log_message "清理完成，剩余 $remaining_backups 个备份"
    fi
}

# 更新配置
update_configuration() {
    log_message "检查配置更新..."
    
    # 创建备份
    timestamp=$(date +%Y%m%d-%H%M%S)
    backup_dir="$HOME/.cc-config/backups/maintenance-$timestamp"
    mkdir -p "$backup_dir"
    cp -r "$HOME/.claude/"* "$backup_dir/" 2>/dev/null || true
    
    # 运行更新
    if cc-config update --force; then
        log_message "配置更新成功"
    else
        log_message "配置更新失败，已恢复备份"
        cp -r "$backup_dir/"* "$HOME/.claude/" 2>/dev/null || true
    fi
}

# 验证配置
validate_configuration() {
    log_message "验证配置状态..."
    
    if cc-config doctor --fix; then
        log_message "配置验证成功"
        return 0
    else
        log_message "配置验证失败"
        return 1
    fi
}

# 测试提供商
test_providers() {
    log_message "测试所有提供商..."
    
    provider_list=$(cc-config provider list 2>/dev/null | grep -E "^[a-zA-Z]" | awk '{print $1}' || true)
    
    for provider in $provider_list; do
        if timeout 30 $provider "test connection" &>/dev/null; then
            log_message "提供商 $provider: 正常"
        else
            log_message "提供商 $provider: 连接失败"
        fi
    done
}

# 生成健康报告
generate_health_report() {
    report_file="$HOME/.cc-config/health_report_$(date +%Y%m%d).txt"
    
    cat > "$report_file" << REPORT
Claude Code Kit 健康报告
====================
生成时间: $(date)

系统状态
========
$(cc-config status --detailed)

磁盘使用
========
配置目录大小: $(du -sh ~/.cc-config 2>/dev/null || echo "Unknown")
Claude 目录大小: $(du -sh ~/.claude 2>/dev/null || echo "Unknown")

备份统计
========
备份数量: $(ls ~/.cc-config/backups 2>/dev/null | wc -l)
最新备份: $(ls -t ~/.cc-config/backups | head -1)

维护历史
========
$(tail -10 "$MAINTENANCE_LOG" 2>/dev/null || echo "无维护记录")

REPORT
    
    log_message "健康报告已生成: $report_file"
}

# 主维护流程
main() {
    log_message "开始定期维护..."
    
    cleanup_old_backups
    
    if validate_configuration; then
        test_providers
        update_configuration
    else
        log_message "跳过更新，配置验证失败"
    fi
    
    generate_health_report
    
    log_message "定期维护完成"
}

main "$@"
EOF

chmod +x ~/claude-maintenance.sh

# 创建 cron 任务（每周日凌晨2点运行）
cat > ~/setup-claude-cron.sh << 'EOF'
#!/bin/bash

# 添加到 crontab
(crontab -l 2>/dev/null; echo "0 2 * * 0 $HOME/claude-maintenance.sh") | crontab -

echo "✅ 已设置每周维护任务"
echo "💡 查看任务: crontab -l"
echo "💡 查看日志: tail -f ~/.cc-config/maintenance.log"
EOF

chmod +x ~/setup-claude-cron.sh

# 运行设置
~/setup-claude-cron.sh
```

### 示例 15: 监控和报警脚本

```bash
# 场景：监控 Claude Code Kit 状态并发送报警
# 目标：及时发现和处理问题

# 创建监控脚本
cat > ~/claude-monitor.sh << 'EOF'
#!/bin/bash

MONITOR_LOG="$HOME/.cc-config/monitor.log"
ALERT_THRESHOLD=3  # 连续失败3次后报警

log_monitor() {
    echo "$(date): $1" | tee -a "$MONITOR_LOG"
}

# 检查服务状态
check_service_health() {
    local provider="$1"
    local failures=0
    
    # 尝试多次连接
    for i in {1..3}; do
        if timeout 30 $provider "health check" &>/dev/null; then
            log_monitor "✅ $provider: 健康检查通过 (尝试 $i/3)"
            return 0
        else
            failures=$((failures + 1))
            log_monitor "❌ $provider: 健康检查失败 (尝试 $i/3)"
            sleep 5
        fi
    done
    
    return $failures
}

# 检查配置完整性
check_config_integrity() {
    if ! cc-config doctor &>/dev/null; then
        log_monitor "❌ 配置完整性检查失败"
        return 1
    fi
    
    log_monitor "✅ 配置完整性检查通过"
    return 0
}

# 发送报警
send_alert() {
    local message="$1"
    local severity="$2"
    
    # 记录报警
    log_monitor "🚨 ALERT [$severity]: $message"
    
    # 发送邮件报警（如果配置了）
    if command -v mail &>/dev/null && [ ! -z "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "Claude Code Kit Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # 发送 Slack 通知（如果配置了）
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Claude Code Kit Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK" &>/dev/null
    fi
    
    # 记录到系统日志
    logger "Claude Code Kit Alert [$severity]: $message"
}

# 性能监控
monitor_performance() {
    local provider="$1"
    local start_time=$(date +%s%N)
    
    if $provider "performance test" &>/dev/null; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))  # 转换为毫秒
        
        log_monitor "⏱️  $provider: 响应时间 ${duration}ms"
        
        # 检查是否超过阈值（例如5秒）
        if [ $duration -gt 5000 ]; then
            send_alert "$provider 响应时间过长: ${duration}ms" "WARNING"
        fi
        
        return 0
    else
        log_monitor "❌ $provider: 性能测试失败"
        return 1
    fi
}

# 主监控流程
monitor_all() {
    log_monitor "开始监控检查..."
    
    local total_failures=0
    local critical_failures=0
    
    # 检查配置完整性
    if ! check_config_integrity; then
        critical_failures=$((critical_failures + 1))
        send_alert "配置完整性检查失败" "CRITICAL"
    fi
    
    # 检查所有提供商
    provider_list=$(cc-config provider list 2>/dev/null | grep -E "^[a-zA-Z]" | awk '{print $1}' || true)
    
    for provider in $provider_list; do
        if ! check_service_health "$provider"; then
            total_failures=$((total_failures + 1))
            send_alert "$provider 健康检查失败" "WARNING"
        else
            # 健康检查通过，进行性能监控
            monitor_performance "$provider"
        fi
    done
    
    # 检查是否需要发送汇总报警
    if [ $total_failures -gt 0 ] || [ $critical_failures -gt 0 ]; then
        summary="监控检查完成: $total_failures 个提供商失败, $critical_failures 个严重问题"
        send_alert "$summary" "SUMMARY"
    else
        log_monitor "✅ 所有监控检查通过"
    fi
    
    log_monitor "监控检查完成"
}

# 连续监控模式
continuous_monitor() {
    local interval="${1:-300}"  # 默认5分钟
    
    log_monitor "启动连续监控模式 (间隔: ${interval}秒)"
    
    while true; do
        monitor_all
        sleep "$interval"
    done
}

# 命令行参数处理
case "$1" in
    "once")
        monitor_all
        ;;
    "continuous")
        continuous_monitor "$2"
        ;;
    "test-alert")
        send_alert "测试报警消息" "TEST"
        ;;
    *)
        echo "Usage: $0 {once|continuous [interval]|test-alert}"
        echo "  once: 运行一次监控检查"
        echo "  continuous [interval]: 连续监控 (默认300秒间隔)"
        echo "  test-alert: 测试报警功能"
        ;;
esac
EOF

chmod +x ~/claude-monitor.sh

# 创建监控配置
cat > ~/claude-monitor-config.sh << 'EOF'
#!/bin/bash

# 监控配置
export ALERT_EMAIL="admin@company.com"
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 设置监控 cron 任务（每5分钟检查一次）
(crontab -l 2>/dev/null | grep -v claude-monitor; echo "*/5 * * * * $HOME/claude-monitor.sh once") | crontab -

echo "✅ 监控配置完成"
echo "📧 报警邮箱: $ALERT_EMAIL"
echo "📱 Slack 通知: 已配置"
echo "⏰ 监控频率: 每5分钟"
EOF

chmod +x ~/claude-monitor-config.sh

# 使用示例
# 运行一次检查
~/claude-monitor.sh once

# 启动连续监控
~/claude-monitor.sh continuous 60  # 每分钟检查一次

# 测试报警
~/claude-monitor.sh test-alert
```

这些示例涵盖了 Claude Code Kit 的各种使用场景，从基础安装到高级集成，从个人使用到团队协作。每个示例都包含详细的说明和可执行的代码，用户可以根据自己的需求进行调整和使用。

---

## 📚 更多资源

- [快速开始指南](quick-start.md) - 5分钟快速上手
- [用户手册](user-guide.md) - 详细功能说明  
- [FAQ](faq.md) - 常见问题解答
- [GitHub 仓库](https://github.com/claude-code-kit/claude-code-kit) - 源码和更新

如果您有更多使用场景的建议或者想要分享您的配置经验，欢迎在 GitHub 上提交 issue 或 PR！