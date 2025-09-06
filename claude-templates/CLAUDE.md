# CLAUDE.md - Claude Code Enhanced Configuration

## Language Settings
- **Primary Language**: 始终使用中文回复，除非明确要求使用其他语言
- **Technical Terms**: 可以适当使用英文技术术语，但解释用中文
- **Code Comments**: 根据项目约定使用相应语言

## 开发哲学 (Development Philosophy)

### 核心原则 (Core Principles)
- **快速失败** - 关键配置出错时立即停止
- **日志并继续** - 可选功能出错时记录并继续
- **优雅降级** - 依赖不可用时提供备选方案  
- **优先可用方案** - 选择能工作的实现而非完美的实现

### 质量标准 (Quality Standards)
- 不允许部分实现 - 功能要么完整要么不做
- 避免重复代码 - 重构通用模式和逻辑
- 为每个函数编写测试
- 保持清晰的关注点分离
- 防止资源泄漏并正确处理清理工作
- 维护一致的命名约定

### 行为准则 (Behavioral Guidelines)
- **简洁直接** - 提供清晰、可执行的回复
- **欢迎批评** - 鼓励反馈和持续改进
- **保持质疑** - 质疑假设并验证输入
- **主动澄清** - 需求不明确时主动提问
- **避免过度工程** - 选择简单、可维护的解决方案

## 专业化智能体策略 (Specialized Agent Strategy)

### 智能体使用 (Agent Utilization)
针对特定领域使用专业化子智能体：
- **file-analyzer** - 用于全面的文件读取和分析
- **code-analyzer** - 用于代码调查和模式识别  
- **test-runner** - 用于执行和验证测试
- **architect** - 用于系统设计和技术决策
- **debugger** - 用于系统性问题诊断

### 上下文感知开发 (Context-Aware Development)
自动检测并适应项目环境：

#### 基础项目支持
- **代码开发**：编写、调试、测试、文档
- **Git 管理**：提交分析、分支策略、变更追踪
- **项目维护**：依赖管理、性能优化、安全检查

#### 增强功能检测
- 🎯 **命令系统** - 检测到 `.claude/commands/` 目录时启用
- 🤖 **智能体系统** - 检测到 `.claude/agents/` 目录时启用  
- 📋 **上下文管理** - 检测到 `.claude/context/` 目录时启用
- 📚 **规格文档** - 检测到 `docs/specs/` 目录时启用

## 增强命令系统 (Enhanced Command System)

检测到 `.claude/commands/` 目录时，以下命令可用：

### 核心开发工作流
- `/ask` - 通过深度产品发现对话进行需求分析
- `/specs` - 生成全面的规格文档（需求、设计、任务）
- `/test` - 测试策略专家，调用 test-runner 智能体执行全面测试
- `/commit` - 智能提交管理，包含变更分析和标准化 Git 提交信息

### 项目质量与文档  
- `/docs` - 技术文档专家，调用 doc-writer 智能体生成完整文档
- `/clean-project` - 项目清理专家，安全删除临时文件和开发工件

### 增强分析
- `/think` - 深度分析专家，用于多维度问题解决

### 项目上下文管理
- `/context-create` - 创建标准化的项目上下文文档
- `/context-prime` - 加载并验证项目上下文信息  
- `/context-update` - 根据检测到的变更更新项目上下文

### 外部集成
- `/gemini` - Gemini 搜索与分析专家，用于网络搜索和长文本分析

## 专业化智能体系统 (Specialized Agent System)

检测到 `.claude/agents/` 目录时，以下专业智能体可用：

### 开发专家
- `architect` - 系统架构师，负责技术选型、架构设计和性能规划
- `developer` - 开发协调员和全栈专家，负责跨领域开发
- `backend-dev` - 后端开发专家，专精 API、数据库、服务端逻辑和集成
- `frontend-dev` - 前端开发专家，专精 UI 组件、状态管理、用户体验和优化
- `dependency-manager` - 智能依赖管理，处理版本冲突、安全性和优化

### 质量保障专家  
- `reviewer` - 代码审查专家，进行多维度质量检查和最佳实践验证
- `test-runner` - 测试执行专家，运行测试并生成覆盖率报告
- `code-fixer` - Bug 修复工程师，进行最小化变更的问题解决
- `debugger` - 调试诊断专家，进行系统性问题分析

### 项目管理专家
- `planner` - 项目规划师，进行任务分解和智能体分配
- `doc-writer` - 技术文档专家，生成 API 文档和变更日志

## 上下文管理系统 (Context Management System)

检测到 `.claude/context/` 目录时，启用项目上下文管理：

### 标准上下文文件
- `project-overview.md` - 项目背景和目标
- `tech-context.md` - 技术栈和架构信息
- `project-structure.md` - 目录结构和组件组织
- `development-context.md` - 开发约定和工作流
- `progress.md` - 当前进展和里程碑
- `decisions.md` - 技术决策记录

### 上下文生命周期
1. **初始化** - 使用 `/context-create` 建立项目上下文
2. **加载** - 使用 `/context-prime` 为开发会话加载上下文
3. **维护** - 使用 `/context-update` 保持上下文与项目变更同步

## 规格文档管理 (Specifications Management)

检测到 `docs/specs/` 目录时，启用规格文档管理：

### 文档结构
```
docs/specs/
├── feature-name/
│   ├── requirements.md    # 功能需求和验收标准
│   ├── design.md         # 技术设计和架构
│   └── tasks.md          # 开发任务分解
└── shared/
    ├── architecture.md   # 系统架构概览
    └── conventions.md    # 开发约定和标准
```

### 工作流集成
1. **分析阶段** - 使用 `/ask` 进行需求发现
2. **规格阶段** - 使用 `/specs` 生成全面的文档
3. **实施阶段** - 跟随任务分解，使用合适的智能体
4. **质量阶段** - 使用 `/test` 进行全面验证

## 推荐开发工作流 (Recommended Development Workflow)

### 标准项目流程
1. **需求分析** - 理解和澄清开发需求
2. **方案设计** - 创建技术方案和实施计划
3. **代码实现** - 编写高质量、经过测试的代码
4. **测试验证** - 全面的测试和质量保证
5. **文档更新** - 更新相关文档
6. **代码审查** - 质量检查和优化
7. **部署发布** - 标准化提交和部署

### 增强工作流（当支持时）
```bash
# 项目初始化
/context-create

# 开发会话开始
/context-prime

# 需求分析
/ask "功能需求..."

# 生成规格文档
/specs "基于分析，创建详细规格"

# 使用专业智能体进行开发
# （使用合适的专业智能体）

# 测试和验证
/test

# 文档更新
/docs

# 上下文维护
/context-update
```

## 技术标准 (Technical Standards)

### 代码质量要求
- 遵循项目特定的编码标准和命名约定
- 实施安全最佳实践 - 避免硬编码敏感信息
- 编写高效代码，避免不必要的复杂性
- 维护清晰、有文档的代码和适当的注释

### 测试策略
- **单元测试** - 覆盖核心业务逻辑
- **集成测试** - 验证组件间交互  
- **端到端测试** - 验证关键用户路径

### 文档标准
- **代码注释** - 解释复杂逻辑和设计决策
- **API 文档** - 清晰的接口描述和使用示例
- **README 维护** - 保持项目描述准确和最新

## 环境适配 (Environment Adaptation)

### 项目类型识别
根据项目特征自动调整行为：
- **前端项目** - 关注 UI 组件、状态管理、用户体验
- **后端项目** - 强调 API 设计、数据库、服务架构
- **全栈项目** - 协调前后端开发和集成
- **库/工具项目** - 优先考虑 API 设计和全面文档

### 技术栈适配
自动识别并适应项目技术栈：
- JavaScript/TypeScript, Python, Go, Rust, Java 等
- React, Vue, Angular, Express, FastAPI, Spring 等
- 相应的测试框架、构建工具、部署方法

