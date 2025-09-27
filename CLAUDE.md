# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CConfig 是一个专为 Claude API 设计的配置管理 CLI 工具，采用模块化架构，支持多 API 提供商配置管理、环境变量导出和 Shell 集成。

## 核心架构

### 模块结构
- `bin/cconfig.js` - 主 CLI 入口，处理命令解析和用户交互
- `lib/config.js` - 配置管理核心模块（目录、文件操作、验证）
- `lib/providers.js` - 提供商 CRUD 操作
- `lib/error-handler.js` - 统一错误处理和用户友好错误信息
- `lib/validator.js` - 数据验证逻辑

### 数据存储
- 配置目录：`~/.cconfig/`（测试环境使用 `test-temp/`）
- 系统配置：`~/.cconfig/config.json`
- 提供商配置：`~/.cconfig/providers/<alias>.json`
- 类 Unix 系统上提供商文件使用 600 权限保护 API Key

### 测试环境隔离
- 通过 `NODE_ENV=test` 环境变量切换到测试模式
- 测试配置目录自动隔离到 `test-temp/`
- Jest 配置支持测试目录自动清理

## 开发、测试、部署规范

### 常用命令

#### 开发环境设置
```bash
# 安装依赖
npm install

# 本地开发调试
./install.sh  # 自动安装并链接本地 cconfig 函数

# 全局安装本地版本（用于测试）
npm install -g .
```

#### 代码质量检查
```bash
# 运行所有测试
npm test

# 测试覆盖率报告
npm run test:coverage

# 单独运行单元测试
npm test tests/unit/

# 运行特定测试文件
npm test tests/unit/config.test.js

# 代码检查
npm run lint

# 自动修复代码格式问题
npm run lint:fix

# 代码格式化
npm run format

# 检查格式是否符合规范
npm run format:check
```

#### 构建和部署
```bash
# 预发布检查（运行 lint 和格式检查）
npm run prepack

# 清理环境
npm run clean && npm install

# 发布准备
git tag v<version>
git push origin v<version>  # 触发自动发布到 npm
```

### 测试规范

#### 测试目录结构
```
tests/
├── unit/            # 单元测试
├── integration/     # 集成测试
├── performance/     # 性能测试
├── helpers/         # 测试辅助工具
└── setup/          # 测试环境配置
```

#### 测试环境配置
- Jest 全局设置：`tests/setup/jest.setup.js`
- 自动设置 `NODE_ENV=test`
- 每个测试前清理 `test-temp/` 目录
- 30秒测试超时
- 禁用控制台输出噪音（保留 error 和 warn）

#### 测试最佳实践
- 单元测试：测试单个模块功能，模拟外部依赖
- 集成测试：测试 CLI 命令端到端功能
- 使用临时目录进行文件操作测试
- 测试错误处理和边界情况

### 代码规范

#### 模块导入规范
- 优先使用相对路径导入项目内模块
- 第三方库使用包名导入
- 从 `lib/` 目录导入时使用 `require('../lib/modulename')`

#### 错误处理规范
- 使用 `ErrorHandler` 模块处理错误
- 提供中文用户友好错误信息
- 区分系统错误（ENOENT, EACCES）和业务错误
- 优雅退出，避免未处理异常

#### 数据验证
- 使用 `config.validateAlias()` 验证别名格式
- 使用 `config.validateApiUrlSecure()` 验证 URL
- 提供商数据验证使用 `lib/validator.js`

### 发布流程

#### 版本管理
- 遵循语义化版本控制
- 更新 `package.json` 中的版本号
- 创建对应的 Git 标签

#### 自动发布（GitHub Actions）
- 推送 `v*` 标签触发发布流程
- 验证标签版本与 `package.json` 版本一致
- 运行完整测试套件
- 自动发布到 npm（需要 `NPM_TOKEN` secret）

#### 发布准备清单
1. 更新版本号和变更日志
2. 运行 `npm run prepack` 确保代码质量
3. 运行完整测试：`npm test`
4. 创建并推送版本标签

### 开发注意事项

#### 环境变量
- 测试环境：`NODE_ENV=test`
- 配置目录在测试模式下自动切换
- 支持 `CCONFIG_ALLOW_COLOR_IN_PIPES` 控制管道输出颜色

#### 跨平台兼容
- 使用 `path.join()` 处理文件路径
- 通过 `config.isWindows()` 检测系统类型
- Windows 系统跳过文件权限设置

#### Shell 集成
- 支持多种 shell 格式输出（bash, zsh, fish）
- `cconfig.sh` 包含 Shell 集成函数定义
- 环境变量导出使用 `cconfig env` 命令

#### CLI 用户体验
- 使用 `chalk` 提供彩色输出
- 使用 `inquirer` 实现交互式输入
- 使用 `cli-table3` 展示格式化表格
- 支持 TTY 检测自动禁用颜色输出
