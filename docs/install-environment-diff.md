# install.sh 测试环境与线上环境差异分析

## 环境检测机制

### 检测逻辑（第68-75行）
```bash
detect_mode() {
    # When run via curl | bash, SCRIPT_DIR will be PWD, so check for dev files there
    if [[ -f "${SCRIPT_DIR}/bin/ccvm.js" && -f "${SCRIPT_DIR}/package.json" ]]; then
        echo "dev"
    else
        echo "prod"
    fi
}
```

**关键变量**：
- `SCRIPT_DIR`: `$(cd "$(dirname "${BASH_SOURCE[0]:-$PWD}")" && pwd)`
  - 本地执行: 脚本所在的实际目录
  - curl执行: 当前工作目录（PWD）

## 两种模式的核心差异

### 1. 开发模式（Dev Mode）
触发条件：存在 `bin/ccvm.js` 和 `package.json` 文件

| 特性 | 实现方式 | 影响 |
|------|---------|------|
| **安装方式** | 符号链接 | 直接使用源代码目录 |
| **代码位置** | `$SCRIPT_DIR`（开发目录） | 修改立即生效 |
| **依赖安装** | `npm install`（全部依赖） | 包含开发依赖 |
| **配置标记** | 写入 `dev_path` 文件 | 记录开发路径 |
| **更新方式** | 无需更新 | 直接使用最新代码 |

```bash
install_dev_mode() {
    log INFO "开发模式：链接到 $SCRIPT_DIR"
    echo "$SCRIPT_DIR" > "$CCVM_DIR/dev_path"
    install_claude_config "$SCRIPT_DIR/claude-templates"
    (cd "$SCRIPT_DIR" && npm install --loglevel=error)
}
```

### 2. 生产模式（Prod Mode）
触发条件：不存在开发文件（通过curl安装）

| 特性 | 实现方式 | 影响 |
|------|---------|------|
| **安装方式** | 完整复制 | 独立安装到 `~/.claude/ccvm` |
| **代码来源** | GitHub仓库 | 拉取指定分支 |
| **依赖安装** | `npm install --production` | 仅生产依赖 |
| **配置保留** | 只更新代码文件 | 保留用户配置 |
| **更新方式** | 重新运行安装脚本 | 增量更新 |

```bash
install_prod_mode() {
    log INFO "生产模式：从 GitHub 更新..."
    # 克隆到临时目录
    git clone "https://github.com/${GITHUB_REPO}.git" "$temp_dir"
    # 只更新代码文件，保留配置
    local update_items=("bin" "src" "tests" "tools" "package.json" ...)
    # 安装生产依赖
    npm install --production
}
```

## 不同安装方式的行为差异

### 1. 本地开发安装
```bash
# 在项目目录执行
./install.sh
```

**执行流程**：
1. `SCRIPT_DIR` = 项目实际路径（如 `/Users/kedoupi/Coding/kedoupi/ccvm`）
2. 检测到 `bin/ccvm.js` 和 `package.json` → **开发模式**
3. 创建 `~/.claude/ccvm/dev_path` 指向开发目录
4. Shell函数中的 `ccvm` 直接调用开发目录的代码
5. 无需复制文件，修改立即生效

### 2. Curl 在线安装
```bash
curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh | bash
```

**执行流程**：
1. `SCRIPT_DIR` = `$PWD`（当前工作目录）
2. 不存在开发文件 → **生产模式**
3. 从GitHub克隆完整代码到 `~/.claude/ccvm`
4. 安装生产依赖
5. Shell函数调用安装目录的代码

### 3. 本地测试Curl行为
```bash
# 模拟curl安装环境
cd /tmp
bash /path/to/ccvm/install.sh
```

**执行流程**：
1. `SCRIPT_DIR` = `/tmp`（当前目录）
2. 不存在开发文件 → **生产模式**（即使源码在本地）
3. 行为与curl安装相同

## 关键差异点总结

### 依赖管理差异

| 环境 | 命令 | 包含内容 |
|------|------|----------|
| **开发环境** | `npm install` | 所有依赖（包括Jest、ESLint等） |
| **生产环境** | `npm install --production` | 仅运行时依赖 |

### 文件系统差异

| 项目 | 开发模式 | 生产模式 |
|------|----------|----------|
| **代码位置** | 开发目录 | `~/.claude/ccvm` |
| **执行路径** | `$(cat dev_path)/bin/ccvm.js` | `~/.claude/ccvm/bin/ccvm.js` |
| **配置保留** | N/A | providers目录不被覆盖 |
| **更新方式** | git pull | 重新运行install.sh |

### 环境检查差异

```bash
# 生产模式额外检查（第133-142行）
if [[ "$mode" == "prod" ]]; then
    if ! command_exists git; then
        log ERROR "生产模式需要 git"
    fi
    if ! command_exists curl && ! command_exists wget; then
        log ERROR "需要 curl 或 wget"
    fi
fi
```

### Provider配置处理差异

| 场景 | 处理方式 |
|------|----------|
| **首次安装** | 提示配置第一个provider |
| **更新安装** | 检测并保留现有providers |
| **开发模式** | 使用开发目录的测试配置 |

## 潜在问题和注意事项

### 1. 路径问题
- **问题**：nvm等版本管理器改变npm全局路径
- **影响**：Chrome MCP等需要找到 `mcp-server-stdio.js`
- **解决**：增强路径检测逻辑（已修复）

### 2. 配置迁移
- **问题**：旧版本 `~/.ccvm` 到新版本 `~/.claude/ccvm`
- **处理**：自动迁移并备份

### 3. 权限问题
- **开发模式**：使用当前用户权限
- **生产模式**：需要npm全局安装权限

### 4. 网络依赖
- **开发模式**：仅npm依赖需要网络
- **生产模式**：GitHub克隆 + npm都需要网络

## 测试建议

### 测试开发模式
```bash
# 在项目目录
./install.sh
ccvm status
```

### 测试生产模式
```bash
# 清理环境
rm -rf ~/.claude/ccvm

# 模拟curl安装
cd /tmp
bash /path/to/ccvm/install.sh

# 或真实curl安装
curl -fsSL https://raw.githubusercontent.com/kedoupi/ccvm/main/install.sh | bash
```

### 测试更新场景
```bash
# 保留配置的更新
# 1. 先正常安装并配置provider
# 2. 再次运行安装脚本
# 3. 验证provider是否保留
```

## 调试技巧

### 1. 查看安装模式
```bash
# 在install.sh中添加调试输出
echo "SCRIPT_DIR: $SCRIPT_DIR"
echo "检测文件: bin/ccvm.js = $(test -f "${SCRIPT_DIR}/bin/ccvm.js" && echo "存在" || echo "不存在")"
echo "检测文件: package.json = $(test -f "${SCRIPT_DIR}/package.json" && echo "存在" || echo "不存在")"
```

### 2. 验证安装结果
```bash
# 检查是开发链接还是独立安装
if [[ -f ~/.claude/ccvm/dev_path ]]; then
    echo "开发模式，链接到: $(cat ~/.claude/ccvm/dev_path)"
else
    echo "生产模式，安装在: ~/.claude/ccvm"
fi
```

### 3. 检查依赖差异
```bash
# 开发环境
ls ~/.claude/ccvm/node_modules | wc -l  # 更多包

# 生产环境  
ls ~/.claude/ccvm/node_modules | wc -l  # 更少包
```