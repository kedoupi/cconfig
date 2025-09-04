# 临时Provider切换功能 - 技术设计文档

## 架构概览

### 系统架构
临时Provider切换功能采用**最小侵入式架构**，通过扩展现有的两个关键组件实现：

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Shell claude  │    │  ccvm env        │    │  Native claude  │
│   Function      │───▶│  Command         │───▶│  Command        │
│                 │    │  (Extended)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │  Provider Config │
         │              │  Loading         │
         │              └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    参数解析流程                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. 解析 -P/--provider 参数                                        │
│ 2. 分离CCVM参数与claude参数                                       │
│ 3. 调用 ccvm env --provider <name>                              │
│ 4. 加载环境变量                                                    │
│ 5. 执行 command claude <remaining_args>                         │
└─────────────────────────────────────────────────────────────────┘
```

### 技术选型理由

**Shell函数扩展 vs 独立工具**
- ✅ **选择**: 扩展现有shell函数
- **理由**: 保持透明性，用户仍然使用熟悉的 `claude` 命令
- **优势**: 零学习成本，完全向后兼容

**参数解析策略**
- ✅ **选择**: Shell原生参数解析（while case循环）
- **理由**: 简单可靠，不引入额外依赖
- **优势**: 跨shell兼容性好，易于调试

## 核心组件设计

### 1. Shell函数增强 (install.sh:349-366)

#### 原始设计
```bash
claude() {
    eval "$(ccvm env 2>/dev/null)"
    command claude "$@"
}
```

#### 增强设计
```bash
claude() {
    # 临时Provider和参数分离
    local provider=""
    local args=()
    
    # 参数解析逻辑
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
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # 环境变量加载
    if [[ -n "$provider" ]]; then
        # 临时Provider模式
        eval "$(ccvm env --provider "$provider" 2>/dev/null)"
        local env_exit_code=$?
        if [[ $env_exit_code -ne 0 ]]; then
            echo "❌ 无法加载 Provider '$provider' 配置" >&2
            echo "💡 运行 'ccvm list' 查看可用的 Provider" >&2
            return 1
        fi
    else
        # 默认Provider模式
        eval "$(ccvm env 2>/dev/null)"
        if [[ $? -ne 0 ]]; then
            echo "❌ 无法加载 CCVM 配置" >&2
            echo "💡 运行: ccvm add" >&2
            return 1
        fi
    fi
    
    # 执行原生claude命令
    command claude "${args[@]}"
}
```

#### 关键设计决策
1. **参数验证**: 检查provider参数不为空且不以-开头
2. **错误处理**: 详细的错误信息和修复建议
3. **状态隔离**: 每次执行后临时环境变量自动清理
4. **向后兼容**: 无provider参数时行为完全一致

### 2. ccvm env 命令扩展 (bin/ccvm.js:732-775)

#### 接口设计
```javascript
program
  .command('env')
  .description('输出当前默认或指定 Provider 的环境变量')
  .option('--shell <shell>', 'Shell format (bash, zsh, fish)', 'bash')
  .option('--provider <alias>', '指定特定的 Provider') // 新增选项
  .action(async (options) => {
    // 实现逻辑
  });
```

#### 核心逻辑流程
```javascript
async function handleEnvCommand(options) {
    // 1. 初始化配置管理器
    await configManager.init();
    
    // 2. 确定目标Provider
    let targetProvider;
    if (options.provider) {
        // 临时Provider模式
        targetProvider = options.provider;
        
        // 验证Provider存在性
        const provider = await providerManager.getProvider(targetProvider);
        if (!provider) {
            throw new Error(`Provider '${targetProvider}' 未找到`);
        }
    } else {
        // 默认Provider模式
        const config = await configManager.getConfig();
        targetProvider = config.defaultProvider;
        
        if (!targetProvider) {
            throw new Error('没有配置默认 Provider');
        }
    }
    
    // 3. 加载Provider配置
    const providerConfig = await providerManager.getProvider(targetProvider);
    
    // 4. 输出环境变量
    outputEnvironmentVariables(providerConfig, options.shell);
}
```

#### 环境变量输出格式
```javascript
function outputEnvironmentVariables(providerConfig, shell) {
    const vars = {
        ANTHROPIC_AUTH_TOKEN: providerConfig.apiKey,
        ANTHROPIC_BASE_URL: providerConfig.baseURL,
        API_TIMEOUT_MS: providerConfig.timeout || '3000000'
    };
    
    if (shell === 'fish') {
        Object.entries(vars).forEach(([key, value]) => {
            console.log(`set -x ${key} "${value}";`);
        });
    } else {
        // bash/zsh format
        Object.entries(vars).forEach(([key, value]) => {
            console.log(`export ${key}="${value}";`);
        });
    }
}
```

### 3. 错误处理与用户体验

#### 错误分类与处理策略
```javascript
const ERROR_TYPES = {
    PROVIDER_NOT_FOUND: {
        code: 'PROVIDER_NOT_FOUND',
        message: (provider) => `Provider '${provider}' 未找到`,
        suggestion: '运行 ccvm list 查看可用的 Provider',
        exitCode: 1
    },
    NO_DEFAULT_PROVIDER: {
        code: 'NO_DEFAULT_PROVIDER', 
        message: '没有配置默认 Provider',
        suggestion: '运行: ccvm add',
        exitCode: 1
    },
    INVALID_PROVIDER_CONFIG: {
        code: 'INVALID_PROVIDER_CONFIG',
        message: (provider) => `Provider '${provider}' 配置无效`,
        suggestion: '运行 ccvm doctor 检查配置',
        exitCode: 1
    }
};
```

#### 用户友好的错误输出
```bash
# Shell函数错误输出示例
echo "❌ 无法加载 Provider 'nonexistent' 配置" >&2
echo "💡 运行 'ccvm list' 查看可用的 Provider:" >&2
ccvm list --quiet 2>/dev/null | sed 's/^/   /' >&2
return 1
```

## 数据流程设计

### 命令执行流程图

```mermaid
graph TD
    A[用户输入: claude -P custom-api "prompt"] --> B[Shell函数解析参数]
    B --> C{是否有-P参数?}
    C -->|是| D[提取provider名称]
    C -->|否| E[使用默认模式]
    D --> F[调用: ccvm env --provider custom-api]
    E --> G[调用: ccvm env]
    F --> H[验证Provider存在性]
    G --> I[加载默认Provider]
    H --> J{Provider存在?}
    J -->|否| K[输出错误信息并退出]
    J -->|是| L[加载Provider配置]
    I --> M[设置环境变量]
    L --> M
    M --> N[执行: command claude "prompt"]
    N --> O[返回结果给用户]
    K --> P[用户修正错误]
```

### 状态管理设计

```javascript
// Provider配置缓存策略
class ProviderCache {
    constructor(ttl = 60000) { // 1分钟缓存
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    async getProvider(alias) {
        const cached = this.cache.get(alias);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }
        
        const provider = await this.loadProviderFromDisk(alias);
        this.cache.set(alias, {
            data: provider,
            timestamp: Date.now()
        });
        
        return provider;
    }
}
```

## 接口定义

### ccvm env 命令接口

```typescript
interface EnvCommandOptions {
    shell?: 'bash' | 'zsh' | 'fish';
    provider?: string; // Provider别名
}

interface EnvCommandOutput {
    // 输出到stdout的环境变量设置语句
    environmentStatements: string[];
    
    // 错误时输出到stderr
    errorMessage?: string;
    exitCode: number;
}
```

### Shell函数接口

```bash
# claude函数参数解析结果
declare -A PARSED_ARGS=(
    ["provider"]=""        # -P或--provider参数值
    ["remaining_args"]=""  # 传递给原生claude的参数
)
```

## 测试策略

### 单元测试覆盖

1. **参数解析测试**
   ```javascript
   describe('ccvm env --provider', () => {
     test('应正确解析provider参数', async () => {
       const result = await parseEnvCommand(['env', '--provider', 'test']);
       expect(result.provider).toBe('test');
     });
   });
   ```

2. **错误处理测试**
   ```javascript
   test('不存在的provider应返回错误', async () => {
     await expect(
       handleEnvCommand({ provider: 'nonexistent' })
     ).rejects.toThrow('Provider \'nonexistent\' 未找到');
   });
   ```

### 集成测试场景

1. **完整命令流程测试**
   ```bash
   # 测试脚本示例
   test_temp_provider_switch() {
     # 设置测试环境
     ccvm add --non-interactive test-provider api-key base-url
     
     # 测试临时切换
     output=$(claude -P test-provider "test prompt")
     
     # 验证结果
     assert_contains "$output" "expected_response"
   }
   ```

2. **Shell兼容性测试**
   ```bash
   # 多Shell环境测试
   for shell in bash zsh fish; do
     test_shell_compatibility "$shell"
   done
   ```

### 性能测试指标

```javascript
// 性能基准测试
const PERFORMANCE_BENCHMARKS = {
    parameterParsing: {
        maxTime: 50, // ms
        test: () => measureTime(() => parseClaudeArgs(['-P', 'test', 'prompt']))
    },
    providerLoading: {
        maxTime: 100, // ms  
        test: () => measureTime(() => loadProvider('test-provider'))
    },
    totalOverhead: {
        maxTime: 200, // ms
        test: () => measureTime(() => executeFullFlow())
    }
};
```

## 安全考虑

### 参数注入防护

```bash
# 参数验证函数
validate_provider_name() {
    local provider="$1"
    
    # 检查空值
    if [[ -z "$provider" ]]; then
        return 1
    fi
    
    # 检查特殊字符（防止命令注入）
    if [[ "$provider" =~ [;\|\&\$\`\(\)] ]]; then
        echo "❌ Provider名称包含非法字符: $provider" >&2
        return 1
    fi
    
    # 检查长度限制
    if [[ ${#provider} -gt 64 ]]; then
        echo "❌ Provider名称过长: $provider" >&2
        return 1
    fi
    
    return 0
}
```

### 环境变量隔离

```bash
# 确保环境变量不泄露到全局
claude() {
    (
        # 在子shell中执行，自动清理环境变量
        local provider="$extracted_provider"
        
        if [[ -n "$provider" ]]; then
            eval "$(ccvm env --provider "$provider")"
        else
            eval "$(ccvm env)"
        fi
        
        command claude "$@"
    )
}
```

## 实施注意事项

### 向后兼容性保障

1. **现有行为保持**：无参数时的claude命令行为完全不变
2. **渐进式部署**：可以分阶段部署，先部署ccvm env扩展，再部署shell函数
3. **回滚策略**：保留原有shell函数作为备份

### 部署顺序

1. **Phase 1**: 扩展 `ccvm env` 命令支持 `--provider` 参数
2. **Phase 2**: 更新 shell 函数支持参数解析
3. **Phase 3**: 更新安装脚本和文档
4. **Phase 4**: 添加测试覆盖和监控

### 监控和日志

```javascript
// 可选的使用统计
const logUsage = (provider, isTemporary) => {
    const stats = {
        timestamp: Date.now(),
        provider: provider,
        temporary: isTemporary,
        shell: process.env.SHELL
    };
    
    // 可选择性记录到 ~/.claude/ccvm/usage.log
    if (config.enableUsageLogging) {
        fs.appendFileSync(usageLogPath, JSON.stringify(stats) + '\n');
    }
};
```