# Repository Guidelines

## 项目结构与模块组织
- CLI 入口为 `bin/cconfig.js`，负责交互式命令；核心逻辑集中在 `lib/config.js` 与 `lib/providers.js`，用于迁移配置、读写凭据以及抽象云供应商。
- 单元测试位于 `tests/unit/`，集成测试存放在 `tests/integration/`，公共测试工具放在 `tests/helpers/`；Jest 初始化脚本为 `tests/setup/jest.setup.js`。
- 根目录包含安装脚本 `install.sh` 与 Shell 集成脚本 `cconfig.sh`，覆盖率报告输出到 `coverage/`。

## 构建、测试与开发命令
- `npm run start -- <command>`：调用 CLI，例如 `npm run start -- doctor` 检查环境。
- `npm test` / `npm run test:watch`：运行完整或增量 Jest 套件。
- `npm run test:coverage`：生成终端与 HTML 覆盖率报告。
- `npm run lint`、`npm run lint:fix`、`npm run format`：执行 ESLint 检查、自动修复及 Prettier 格式化。
- `npm run reset` 或 `npm run prepare`：重置依赖并重新安装 Husky 钩子。

## 代码风格与命名约定
- 保持两空格缩进、单引号、尾随逗号，使用 CommonJS `require`/`module.exports`。
- 文件名采用小写短横或驼峰，函数使用动词开头的 `camelCase`，常量使用全大写加下划线。
- 提交前运行 ESLint 与 Prettier，确保工作树干净。

## 测试指南
- 全面使用 Jest；新增测试放在 `tests/unit/` 或 `tests/integration/`，命名为 `*.test.js`。
- Jest 会通过环境变量 `CCONFIG_HOME` 自动把配置写到 `tests/test-temp/.cconfig`，运行测试无需修改本地 `~/.cconfig`。
- 涉及文件系统或凭据的逻辑优先编写集成测试，确保覆盖 `~/.cconfig/` 行为。
- 提交前建议执行 `npm run test:coverage` 以监控覆盖率基线。

## 提交与拉取请求指引
- 遵循 Conventional Commits（例如 `feat`, `fix`, `docs`），消息需概述范围与动机。
- PR 描述应包含变更摘要、测试步骤、潜在影响，涉及 CLI 的修改附终端输出或录屏。
- 在合并前确认 CI 通过且没有未提交的本地修改。

## 安全与配置提示
- 默认配置目录为 `~/.cconfig/`，首次运行会自动迁移旧版 `~/.config/claude/cconfig/` 数据。
- 确保密钥文件权限不高于 `600`，避免将真实凭据写入测试或示例。
- 发布前可运行 `npm run start -- doctor` 进行环境与安全自检。
