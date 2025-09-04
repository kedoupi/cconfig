# 临时Provider切换功能 - 需求规格

## 功能概述

为CCVM的claude命令添加临时Provider切换功能，允许用户在不修改默认配置的情况下，通过命令行参数临时指定特定的API Provider，提升多Provider环境下的使用效率和灵活性。

## 背景介绍

当前CCVM通过 `ccvm use provider-name` 设置默认Provider，然后 `claude "prompt"` 使用该默认配置。但在实际使用中，用户经常需要根据不同的任务临时切换到不同的Provider（如不同服务商、不同模型、不同环境），频繁使用 `ccvm use` 会中断工作流程，降低效率。

## 用户故事

### 主要用户故事

**US1: 临时Provider切换**
- **As a** CCVM用户  
- **I want** 通过命令行参数临时指定Provider
- **So that** 我可以在不修改默认配置的情况下灵活切换API服务商

**US2: 简洁参数设计**
- **As a** 命令行用户
- **I want** 使用简短的参数（如-P）指定Provider
- **So that** 我可以快速输入命令而不中断思路

**US3: 参数兼容性**
- **As a** claude命令用户
- **I want** 新参数与现有claude命令参数无冲突
- **So that** 我可以组合使用各种参数而不会出错

### 辅助用户故事

**US4: 错误处理**
- **As a** 用户
- **I want** 当指定不存在的Provider时获得清晰的错误提示
- **So that** 我可以快速修正错误并继续工作

**US5: 向后兼容**
- **As a** 现有用户
- **I want** 原有的claude命令使用方式保持不变
- **So that** 我的现有工作流程不受影响

## EARS格式验收标准

### 核心功能验收标准

**AC1: 临时Provider参数解析**
- **Given** 用户已配置多个Provider (anthropic, custom-api)
- **When** 用户执行 `claude -P custom-api "分析代码"`
- **Then** 系统应使用custom-api的配置执行命令
- **And** 默认Provider保持为anthropic不变
- **And** 下次执行 `claude "其他命令"` 仍使用anthropic

**AC2: 长参数支持**
- **Given** 用户偏好使用完整参数名
- **When** 用户执行 `claude --provider custom-api "翻译文档"`
- **Then** 系统行为应与 `-P` 参数完全一致

**AC3: 参数组合使用**
- **Given** 用户需要结合其他claude参数
- **When** 用户执行 `claude -P backup-api --debug "调试问题"`
- **Then** 系统应正确传递所有参数给原生claude命令
- **And** 使用backup-api的配置执行

### 错误处理验收标准

**AC4: 不存在的Provider处理**
- **Given** 用户指定了不存在的Provider
- **When** 用户执行 `claude -P nonexistent "test"`
- **Then** 系统应显示错误信息："Provider 'nonexistent' 未找到"
- **And** 提示可用的Provider列表
- **And** 命令执行失败，退出码非0

**AC5: 环境加载失败处理**
- **Given** 指定的Provider配置损坏或无法加载
- **When** 系统尝试加载该Provider环境变量
- **Then** 系统应显示详细错误信息
- **And** 建议用户检查Provider配置

### 性能和兼容性验收标准

**AC6: 参数冲突检查**
- **Given** claude命令已有参数：-d, -p, -c, -r, -v, -h
- **When** 系统解析命令行参数
- **Then** `-P` 和 `--provider` 不应与现有参数冲突
- **And** 参数解析应正确识别和分离CCVM参数与claude参数

**AC7: 向后兼容性**
- **Given** 用户未使用新的临时Provider参数
- **When** 用户执行传统的 `claude "prompt"` 命令
- **Then** 系统行为应与之前完全一致
- **And** 使用当前默认Provider配置

## 边界情况和约束条件

### 边界情况

1. **Provider名称包含特殊字符**: 确保正确解析包含短横线、下划线的Provider别名
2. **参数顺序变化**: 支持 `claude -P provider prompt` 和 `claude prompt -P provider` 等不同顺序
3. **空参数处理**: `claude -P "" "prompt"` 应给出明确错误提示
4. **Provider认证失败**: 临时Provider认证失败时的降级或错误处理机制

### 技术约束

1. **Shell兼容性**: 支持bash, zsh, fish等主要shell环境
2. **参数解析限制**: Shell函数的参数解析能力有限，需要简单可靠的解析逻辑
3. **环境变量隔离**: 临时环境变量不应影响全局或后续命令执行
4. **性能要求**: 参数解析和Provider切换应在50ms内完成

### 安全约束

1. **Provider验证**: 必须验证指定的Provider存在且配置有效
2. **参数注入防护**: 防止通过Provider名称进行命令注入攻击
3. **权限继承**: 临时Provider的权限和配置应与原Provider一致

## 非功能需求

### 性能要求
- 参数解析延迟 < 50ms
- Provider配置加载延迟 < 100ms
- 总命令启动开销 < 200ms

### 用户体验要求
- 错误信息清晰易懂，提供具体的修复建议
- 参数提示和帮助信息完整准确
- 与现有claude命令使用习惯保持一致

### 维护性要求
- 代码修改点最小化，减少对现有功能的影响
- 测试覆盖率达到90%以上
- 文档更新完整，包含使用示例和故障排除指南