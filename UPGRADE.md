# 🚀 升级指南 - Update 功能上线！

## 📦 v1.0.2 新功能：自动配置更新

我们很高兴地宣布 Claude Code Kit 现在支持自动配置更新功能！🎉

### ⬆️ 如何升级

如果你之前安装了 `@kedoupi/claude-code-kit`，请运行以下命令升级：

```bash
# 升级到最新版本
npm update -g @kedoupi/claude-code-kit

# 验证升级成功
cc-config --version  # 应该显示 1.0.2
```

### 🆕 新增功能：`cc-config update`

升级后，你将获得强大的配置自动更新功能：

#### 1. 检查配置更新
```bash
cc-config update --check
```

输出示例：
```
🔍 Update Check Results

Local version:  1.0.0
Remote version: 1.0.2

✨ Updates available!
Run "cc-config update" to install the latest version.
```

#### 2. 交互式更新
```bash
cc-config update
```

系统会：
- 📋 显示可用更新信息
- ❓ 询问是否确认更新
- 📦 自动创建配置备份
- ⬇️ 从 GitHub 下载最新配置
- 🔄 智能合并保留你的个人设置
- ✅ 完成更新并显示摘要

#### 3. 强制更新（跳过确认）
```bash
cc-config update --force
```

### 🛡️ 安全特性

- **自动备份**：每次更新前自动创建备份
- **智能合并**：保留你的 API 配置、UI 设置等个人偏好
- **回滚机制**：更新失败时自动回滚
- **版本验证**：确保配置完整性和兼容性

### 📦 备份管理

查看和恢复备份：
```bash
cc-config history
```

### 🔄 配置更新原理

当开发团队在 GitHub 仓库更新以下配置时：
- 🤖 Agent 定义 (`.claude/agents/`)
- ⌨️ 命令模板 (`.claude/commands/`)  
- 🎨 输出样式 (`.claude/output-styles/`)
- ⚙️ 系统设置 (`.claude/settings.json`)

你只需运行 `cc-config update` 即可获取最新功能！

### 🆕 配置分发流程

```
开发者 → GitHub → 用户本机
    ↓        ↓         ↓
修改配置  git push   cc-config update
```

### 💡 使用建议

1. **定期检查**：建议每周运行一次 `cc-config update --check`
2. **谨慎更新**：重要项目前建议先在测试环境验证
3. **备份管理**：定期清理旧备份节省磁盘空间
4. **问题反馈**：遇到问题请访问 [Issues](https://github.com/kedoupi/claude-code-kit/issues)

### 📈 版本历史

- **v1.0.2**：新增 update 命令，支持自动配置更新
- **v1.0.1**：完善提供商管理和备份功能
- **v1.0.0**：初始发布版本

---

🎉 享受自动更新带来的便利，让你的 Claude Code 配置始终保持最新状态！