# Claude Code 配置工具集 - 系统设计文档

## 架构概览

### 系统架构图
```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code Kit                        │
├─────────────────────────────────────────────────────────────┤
│  GitHub Repository (claude-code-kit)                       │
│  ├── install.sh              # 主安装脚本                    │
│  ├── .claude/                # 配置模板目录                  │
│  │   ├── settings.json       # 基础设置模板                  │
│  │   ├── CLAUDE.md          # 全局配置模板                   │
│  │   ├── commands/          # 自定义命令                     │
│  │   ├── agents/            # Agent 配置                    │
│  │   └── output-styles/     # 输出样式                      │
│  └── tools/                 # 工具目录                       │
│      └── cc-config          # 配置管理CLI                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ install
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    用户系统配置                              │
├─────────────────────────────────────────────────────────────┤
│  ~/.cc-config/              # 工具数据目录                   │
│  ├── providers/             # 服务商配置                     │
│  │   ├── default.json       # 默认服务商                     │
│  │   └── cc.json           # 自定义服务商                    │
│  ├── aliases.sh            # 自动生成的别名                  │
│  ├── backups/              # 配置备份                       │
│  │   ├── 20250121143022/    # 时间戳备份目录                 │
│  │   └── 20250122091205/    │                               │
│  └── history.json          # 备份历史记录                    │
│                                                             │
│  ~/.claude/                 # Claude Code 配置目录           │
│  ├── settings.json         # 运行时配置                      │
│  ├── CLAUDE.md            # 用户全局配置                     │
│  ├── commands/             # 自定义命令                      │
│  ├── agents/               # Agent 配置                     │
│  └── output-styles/        # 输出样式                       │
│                                                             │
│  ~/.zshrc 或 ~/.bashrc     # Shell 配置                     │
│  └── source ~/.cc-config/aliases.sh                        │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件设计

### 1. 安装系统 (install.sh)

#### 职责
- Node.js 环境检测和安装
- Claude Code CLI 安装和更新
- 配置模板部署
- 服务商配置向导
- Shell 别名集成

#### 核心流程
```bash
# 1. 环境检测
check_nodejs_version() {
    # 检测 Node.js 版本，最低要求 v18
    # 如果不满足，使用 NVM 安装 v22
}

# 2. Claude Code 安装
install_claude_code() {
    # npm install -g @anthropic-ai/claude-code
    # 验证安装成功
}

# 3. 配置部署
deploy_configurations() {
    # 备份现有配置
    backup_existing_config
    # 复制配置模板
    copy_template_configs
    # 创建工具目录
    setup_cc_config_directory
}

# 4. 服务商配置
setup_providers() {
    # 配置默认服务商
    configure_default_provider
    # 可选配置第二服务商
    configure_additional_provider
}

# 5. Shell 集成
setup_shell_integration() {
    # 检测 shell 类型
    detect_shell
    # 添加 source 命令到 shell 配置
    add_aliases_source
}
```

#### 技术实现
```bash
#!/bin/bash
set -euo pipefail

# 颜色输出函数
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
error() { echo -e "\033[31m[ERROR]\033[0m $1"; exit 1; }

# 主安装流程
main() {
    info "开始安装 Claude Code Kit..."
    
    check_nodejs_version
    install_claude_code
    deploy_configurations
    setup_providers
    setup_shell_integration
    
    success "安装完成！请运行 'source ~/.zshrc' 使配置生效"
}
```

### 2. 配置管理 CLI (cc-config)

#### 架构设计
```javascript
// tools/cc-config (Node.js CLI)
const { Command } = require('commander');

class CCConfig {
    constructor() {
        this.configDir = path.join(os.homedir(), '.cc-config');
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.providersDir = path.join(this.configDir, 'providers');
        this.backupsDir = path.join(this.configDir, 'backups');
        this.aliasesFile = path.join(this.configDir, 'aliases.sh');
    }
    
    async init() {
        // 确保目录结构存在
        await this.ensureDirectories();
    }
}
```

#### 命令结构
```bash
# 服务商管理
cc-config provider add      # 添加新服务商
cc-config provider list     # 列出所有服务商
cc-config provider edit     # 编辑服务商配置
cc-config provider remove   # 删除服务商配置

# 配置管理
cc-config update            # 更新配置模板
cc-config history           # 查看和恢复备份

# 系统管理
cc-config status            # 查看系统状态
cc-config version           # 查看版本信息
```

### 3. 服务商配置系统

#### 数据模型
```json
// Provider 配置结构
{
    "alias": "cc",
    "baseURL": "https://api.anthropic.com",
    "apiKey": "sk-ant-xxxxx",
    "timeout": "3000000"
}

// 历史记录结构
{
    "backups": [
        {
            "timestamp": "20250121143022",
            "description": "安装前备份",
            "size": "2.4MB"
        }
    ]
}
```

#### 别名生成器
```javascript
class AliasGenerator {
    constructor(configDir) {
        this.configDir = configDir;
        this.providersDir = path.join(configDir, 'providers');
        this.aliasesFile = path.join(configDir, 'aliases.sh');
    }
    
    async generateAliases() {
        const providers = await this.loadProviders();
        const aliases = this.buildAliasContent(providers);
        await fs.writeFile(this.aliasesFile, aliases);
    }
    
    buildAliasContent(providers) {
        const header = `# Claude Code Kit - Auto-generated aliases
# This file is automatically generated. Do not edit manually.

_load_claude_config() {
    local config_file="$1"
    if [ -f "$config_file" ]; then
        export ANTHROPIC_AUTH_TOKEN=$(jq -r ".apiKey" "$config_file")
        export ANTHROPIC_BASE_URL=$(jq -r ".baseURL" "$config_file") 
        export API_TIMEOUT_MS=$(jq -r ".timeout // \\"3000000\\"" "$config_file")
    fi
}

`;
        
        const aliases = providers.map(provider => 
            `alias ${provider.alias}='_load_claude_config "$HOME/.cc-config/providers/${provider.alias}.json" && claude'`
        ).join('\n');
        
        return header + aliases + '\n';
    }
}
```

### 4. 备份和恢复系统

#### 备份策略
```javascript
class BackupManager {
    async createBackup(description = "手动备份") {
        const timestamp = this.generateTimestamp();
        const backupDir = path.join(this.backupsDir, timestamp);
        
        // 创建备份目录
        await fs.mkdir(backupDir, { recursive: true });
        
        // 备份 ~/.claude 目录
        await this.copyDirectory(this.claudeDir, path.join(backupDir, 'claude'));
        
        // 记录备份信息
        await this.recordBackup(timestamp, description);
        
        return timestamp;
    }
    
    async restoreBackup(timestamp) {
        const backupDir = path.join(this.backupsDir, timestamp, 'claude');
        
        if (!await this.exists(backupDir)) {
            throw new Error(`备份 ${timestamp} 不存在`);
        }
        
        // 创建当前状态备份
        await this.createBackup("恢复前自动备份");
        
        // 恢复配置
        await this.removeDirectory(this.claudeDir);
        await this.copyDirectory(backupDir, this.claudeDir);
    }
}
```

## 数据流设计

### 1. 安装流程数据流
```
用户执行安装命令
    ↓
检测系统环境 (Node.js, Shell)
    ↓
下载配置模板 (GitHub)
    ↓
备份现有配置 → ~/.cc-config/backups/
    ↓
部署新配置 → ~/.claude/
    ↓
配置服务商 → ~/.cc-config/providers/
    ↓
生成别名文件 → ~/.cc-config/aliases.sh
    ↓
更新 Shell 配置 → ~/.zshrc
    ↓
安装完成
```

### 2. 多服务商切换流程
```
用户执行命令 (如: cc "问题")
    ↓
Shell 解析别名
    ↓
_load_claude_config 函数执行
    ↓
读取服务商配置 (~/.cc-config/providers/cc.json)
    ↓
设置环境变量 (ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL)
    ↓
调用 claude 命令
    ↓
Claude Code 读取环境变量
    ↓
连接对应服务商 API
```

### 3. 配置更新流程
```
用户执行 cc-config update
    ↓
检查远程版本
    ↓
创建当前配置备份
    ↓
下载最新配置模板
    ↓
保留用户服务商配置
    ↓
更新 ~/.claude/ 配置文件
    ↓
重新生成 aliases.sh
    ↓
更新完成通知
```

## 接口设计

### 1. CLI 接口规范

#### Provider 管理接口
```bash
# 添加服务商
cc-config provider add
# 交互式输入：
# - 命令别名
# - Base URL  
# - API Key

# 列出服务商
cc-config provider list
# 输出格式：
# 别名    服务商URL                     状态
# cc      https://api.anthropic.com   活跃
# gpt     https://api.openai.com      活跃

# 编辑服务商
cc-config provider edit <alias>
# 进入交互式编辑模式

# 删除服务商
cc-config provider remove <alias>
# 确认删除并更新别名
```

#### 配置管理接口
```bash
# 更新配置
cc-config update [--force]
# --force: 强制更新，跳过确认

# 查看历史
cc-config history
# 交互式选择备份进行恢复

# 查看状态
cc-config status
# 显示：
# - 当前版本
# - 配置服务商数量
# - 最后更新时间
# - 备份数量
```

### 2. 配置文件接口

#### Provider 配置格式
```json
{
    "alias": "string",      // 命令别名
    "baseURL": "string",    // API 基础URL
    "apiKey": "string",     // API 密钥
    "timeout": "string"     // 超时时间(可选)
}
```

#### 历史记录格式
```json
{
    "version": "1.0",
    "backups": [
        {
            "timestamp": "string",      // 时间戳
            "description": "string",    // 备份描述
            "size": "string",          // 备份大小
            "claude_version": "string" // Claude Code 版本
        }
    ]
}
```

## 错误处理策略

### 1. 安装错误处理
```bash
# Node.js 安装失败
handle_nodejs_error() {
    error "Node.js 安装失败，请手动安装 Node.js 18+ 后重试"
    info "手动安装指南: https://nodejs.org/"
}

# 网络连接错误
handle_network_error() {
    error "网络连接失败，请检查网络设置后重试"
    info "可尝试使用代理或稍后重试"
}

# 权限错误
handle_permission_error() {
    error "权限不足，请确保有写入用户目录的权限"
    info "请检查 ~/.cc-config 和 ~/.claude 目录权限"
}
```

### 2. 配置错误处理
```javascript
class ConfigValidator {
    validateProvider(config) {
        const required = ['alias', 'baseURL', 'apiKey'];
        const missing = required.filter(key => !config[key]);
        
        if (missing.length > 0) {
            throw new ValidationError(`缺少必需字段: ${missing.join(', ')}`);
        }
        
        if (!this.isValidURL(config.baseURL)) {
            throw new ValidationError('无效的 Base URL 格式');
        }
        
        if (!this.isValidAlias(config.alias)) {
            throw new ValidationError('别名只能包含字母、数字和连字符');
        }
    }
}
```

### 3. 恢复机制
```javascript
class RecoveryManager {
    async handleCorruptConfig() {
        // 检测配置文件损坏
        if (await this.isConfigCorrupt()) {
            info('检测到配置文件损坏，尝试自动恢复...');
            
            // 尝试从备份恢复
            const latestBackup = await this.getLatestBackup();
            if (latestBackup) {
                await this.restoreBackup(latestBackup);
                success('已从备份恢复配置');
            } else {
                // 重新初始化配置
                await this.reinitializeConfig();
                warn('已重新初始化配置，请重新添加服务商');
            }
        }
    }
}
```

## 测试策略

### 1. 单元测试
```javascript
// tests/unit/provider-manager.test.js
describe('ProviderManager', () => {
    test('should add provider successfully', async () => {
        const manager = new ProviderManager(testConfigDir);
        const provider = {
            alias: 'test',
            baseURL: 'https://api.test.com',
            apiKey: 'test-key'
        };
        
        await manager.addProvider(provider);
        const saved = await manager.getProvider('test');
        
        expect(saved).toEqual(provider);
    });
    
    test('should validate provider config', () => {
        const manager = new ProviderManager(testConfigDir);
        
        expect(() => {
            manager.validateProvider({ alias: 'test' });
        }).toThrow('缺少必需字段');
    });
});
```

### 2. 集成测试
```bash
# tests/integration/install.test.sh
test_full_installation() {
    # 在干净环境中测试完整安装流程
    setup_clean_environment
    
    # 执行安装
    ./install.sh <<EOF
test-key
https://api.test.com
EOF
    
    # 验证安装结果
    assert_file_exists ~/.claude/settings.json
    assert_file_exists ~/.cc-config/providers/default.json
    assert_command_exists claude
    
    cleanup_test_environment
}
```

### 3. 端到端测试
```bash
# tests/e2e/workflow.test.sh
test_complete_workflow() {
    # 1. 安装
    run_installation
    
    # 2. 添加服务商
    cc-config provider add <<EOF
cc
https://api.anthropic.com
sk-ant-test-key
EOF
    
    # 3. 测试命令
    output=$(cc "test message" 2>&1)
    assert_contains "$output" "API call"
    
    # 4. 更新配置
    cc-config update
    
    # 5. 恢复备份
    cc-config history <<EOF
1
EOF
    
    assert_success "完整工作流测试通过"
}
```

## 性能考虑

### 1. 启动性能
- 别名函数应尽可能轻量，避免复杂计算
- 配置文件读取使用缓存机制
- 环境变量设置优化，减少子进程开销

### 2. 存储优化
- 配置文件使用压缩格式
- 备份文件使用增量备份策略
- 自动清理过期备份文件

### 3. 网络优化
- 配置更新支持增量下载
- 使用 CDN 加速配置分发
- 支持离线模式操作

## 安全考虑

### 1. 敏感信息保护
```bash
# API Key 输入保护
read_api_key() {
    echo -n "请输入 API Key: "
    read -s api_key
    echo
}

# 配置文件权限设置
secure_config_files() {
    chmod 600 ~/.cc-config/providers/*.json
    chmod 700 ~/.cc-config/
}
```

### 2. 输入验证
```javascript
class SecurityValidator {
    sanitizeInput(input) {
        // 防止命令注入
        return input.replace(/[;&|`$()]/g, '');
    }
    
    validateURL(url) {
        // URL 格式验证
        const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
        return urlPattern.test(url);
    }
}
```

### 3. 访问控制
- 配置文件仅用户可读写
- 备份文件访问权限限制
- 临时文件安全清理

## 扩展性设计

### 1. 插件系统预留
```javascript
class PluginManager {
    constructor() {
        this.plugins = new Map();
    }
    
    async loadPlugin(name) {
        // 预留插件加载机制
        const plugin = await import(`./plugins/${name}`);
        this.plugins.set(name, plugin);
    }
}
```

### 2. 配置模板扩展
- 支持自定义配置模板
- 支持配置模板版本管理
- 支持社区配置模板分享

### 3. 服务商扩展
- 支持自定义认证方式
- 支持服务商特定配置
- 支持服务商健康检查

## 部署策略

### 1. 分发机制
```bash
# GitHub Releases 自动构建
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Package release
        run: tar -czf claude-code-kit.tar.gz .claude/ tools/ install.sh
      - name: Create release
        uses: actions/create-release@v1
```

### 2. 版本管理
- 语义化版本控制 (SemVer)
- 配置模板版本兼容性检查
- 自动更新通知机制

### 3. 质量保证
- 自动化测试流水线
- 多平台兼容性测试
- 用户接受度测试

## 监控和维护

### 1. 使用统计
```javascript
class UsageTracker {
    async trackInstallation() {
        // 匿名使用统计
        const stats = {
            platform: os.platform(),
            version: await this.getVersion(),
            timestamp: Date.now()
        };
        
        // 可选的遥测数据收集
        if (await this.getUserConsent()) {
            await this.sendStats(stats);
        }
    }
}
```

### 2. 错误报告
- 自动错误日志收集
- 用户反馈收集机制
- 问题追踪和修复流程

### 3. 维护自动化
- 定期配置模板更新
- 自动化兼容性测试
- 社区反馈处理流程

## 下一步
设计评审通过后，将基于此设计文档创建详细的开发任务清单，包括具体的实现步骤和测试计划。