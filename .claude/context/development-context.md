---
created: 2025-09-06
version: 1.0.0
author: Claude (context-creation)
---

# 开发上下文和工作流

## 开发环境设置

### 环境要求
- **Node.js**: >=18.0.0
- **npm**: 最新稳定版
- **Git**: 版本控制
- **编辑器**: VS Code (推荐，已配置相关扩展支持)

### 本地开发设置
```bash
# 克隆项目
git clone https://github.com/kedoupi/ccvm.git
cd ccvm

# 安装依赖
npm install

# 全局安装进行测试
npm install -g .

# 运行测试
npm test
```

## 代码规范和质量控制

### 代码风格
- **ESLint**: 代码质量检查 (`npm run lint`)
- **Prettier**: 代码格式化 (`npm run format`)
- **约定**: 遵循 JavaScript Standard Style
- **文件命名**: PascalCase (类)、camelCase (函数)、kebab-case (测试文件)

### 代码质量标准
```javascript
// 测试覆盖率要求
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### Pre-commit 钩子
```bash
# 自动运行的检查
husky + lint-staged
├── ESLint 检查和自动修复
├── Prettier 格式化
└── 测试运行
```

## 开发工作流

### 分支策略
```
main                    # 主分支，稳定版本
├── feature/*          # 功能开发分支
├── bugfix/*           # 错误修复分支
├── hotfix/*           # 热修复分支
└── release/*          # 发布准备分支
```

### 提交规范
```bash
# 使用约定式提交格式
feat(scope): 添加新功能
fix(scope): 修复错误
docs(scope): 更新文档
refactor(scope): 代码重构
test(scope): 添加或更新测试
chore(scope): 构建过程或辅助工具的变动

# 示例
feat(mcp): 添加 Context7 MCP 服务支持
fix(provider): 修复 URL 验证逻辑错误
docs: 更新 API 文档和使用说明
```

### 开发循环
```
1. 需求分析 → 2. 分支创建 → 3. 代码实现 → 4. 测试编写 → 5. 质量检查 → 6. 代码审查 → 7. 合并发布
```

## 测试策略和实践

### 测试分层
```
Unit Tests (单元测试)
├── src/core/*.test.js      # 核心模块测试
├── src/utils/*.test.js     # 工具函数测试
└── bin/*.test.js          # CLI 命令测试

Integration Tests (集成测试)
├── CLI 端到端测试
├── 配置文件操作测试
└── 系统集成测试

Performance Tests (性能测试)
└── 启动时间和内存使用基准测试
```

### 测试命令
```bash
# 基本测试
npm test

# 监听模式测试
npm run test:watch

# 覆盖率测试
npm run test:coverage

# 集成测试
npm run test:integration

# 性能测试
npm run test:performance
```

### 测试最佳实践
```javascript
// 使用描述性测试名称
describe('ProviderManager', () => {
  describe('when adding a new provider', () => {
    it('should validate URL format and save with correct permissions', () => {
      // 测试实现
    });
  });
});

// Mock 外部依赖
jest.mock('fs-extra');
jest.mock('inquirer');

// 使用测试工具
const { createTestProvider, cleanupTestFiles } = require('../helpers/testUtils');
```

## 调试和故障排除

### 调试工具
```bash
# 启用调试日志
DEBUG=ccvm:* ccvm <command>

# 详细输出
ccvm status --detailed

# 系统诊断
ccvm doctor --fix
```

### 常见开发问题

#### 1. 文件权限问题
```bash
# 检查配置文件权限
ls -la ~/.claude/ccvm/providers/

# 修复权限
chmod 600 ~/.claude/ccvm/providers/*.json
```

#### 2. 环境变量问题
```bash
# 测试环境变量输出
ccvm env

# 验证 Shell 集成
eval "$(ccvm env)"
echo $ANTHROPIC_AUTH_TOKEN
```

#### 3. MCP 服务配置问题
```bash
# 查看 MCP 服务状态
ccvm mcp

# 重置 MCP 配置
rm ~/.claude/ccvm/mcp.json
ccvm mcp
```

## 构建和发布流程

### 版本管理
```bash
# 更新版本号
npm version patch|minor|major

# 构建检查
npm run prepack  # = lint + test + format:check

# 本地测试
npm pack
npm install -g ./kedoupi-ccvm-1.1.0.tgz
```

### 发布清单
```bash
# 发布前检查清单
□ 所有测试通过
□ 代码质量检查通过
□ 文档已更新
□ 版本号已更新
□ CHANGELOG.md 已更新
□ 本地测试通过

# 发布命令
npm publish --access public
```

## 开发工具和辅助脚本

### package.json 脚本
```bash
# 开发脚本
npm run start          # 启动应用
npm run lint          # 代码检查
npm run lint:fix      # 自动修复代码问题
npm run format        # 代码格式化
npm run clean         # 清理依赖和临时文件
npm run reset         # 重置项目 (clean + install)

# 构建脚本
npm run build         # 构建 (CLI 工具无构建步骤)
npm run size          # 统计代码行数
npm run docs          # 生成 API 文档
```

### 辅助工具
```
tools/
├── integration-test.js    # 集成测试执行器
└── scripts/
    └── test-security.js   # 安全测试脚本

scripts/
└── test-security.js      # 安全检查脚本
```

## IDE 配置和扩展

### VS Code 推荐扩展
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.test-adapter-converter"
  ]
}
```

### VS Code 设置
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.preferences.quoteStyle": "single",
  "typescript.preferences.quoteStyle": "single"
}
```

## 协作和代码审查

### Pull Request 流程
```
1. Fork 项目并创建功能分支
2. 实现功能并编写测试
3. 确保所有检查通过
4. 创建 Pull Request
5. 等待代码审查
6. 根据反馈修改
7. 合并到主分支
```

### 代码审查标准
```
□ 功能实现是否符合需求
□ 代码质量和可读性
□ 测试覆盖率和质量
□ 文档是否完整和准确
□ 安全性考虑
□ 性能影响
□ 向后兼容性
```

## 文档维护

### 文档类型
```
项目文档
├── README.md              # 项目介绍和快速开始
├── CLAUDE.md             # Claude Code 项目指令
├── docs/mcp-guide.md     # MCP 服务使用指南
└── .claude/context/      # 项目上下文文档

API 文档
└── docs/api/             # JSDoc 生成的 API 文档

规格文档
└── docs/specs/           # 功能规格和设计文档
```

### 文档更新流程
```
1. 代码变更时同步更新相关文档
2. 定期审查和更新文档准确性
3. 确保示例代码可运行
4. 维护文档版本控制
```

## 性能优化指南

### 关键性能指标
```
启动时间: < 500ms
内存使用: < 50MB
配置加载: < 100ms
命令响应: < 200ms
```

### 优化策略
```
□ 懒加载非关键模块
□ 缓存配置文件读取
□ 异步操作优化
□ 减少不必要的文件 I/O
□ 优化依赖包大小
```

## 安全开发实践

### 安全检查清单
```
□ API 密钥安全存储 (600 权限)
□ HTTPS 强制 (本地网络除外)
□ 输入验证和清理
□ 路径遍历防护
□ 错误信息不泄露敏感信息
□ 依赖安全扫描
```

### 安全测试
```bash
# 运行安全检查
npm audit
npm audit fix

# 自定义安全测试
node scripts/test-security.js
```