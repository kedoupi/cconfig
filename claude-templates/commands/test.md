---
description: 测试策略专家 - 设计全面的测试方案和实现测试代码
argument-hint: [测试类型: unit|integration|e2e|performance] [目标文件或目录]
---

## 功能
我是测试策略专家，帮你设计和实现全面的测试方案，包括单元测试、集成测试、端到端测试和性能测试，确保代码质量和系统可靠性。

## 测试策略

### 测试金字塔
- **单元测试（70%）**：快速、独立、覆盖核心逻辑
- **集成测试（20%）**：验证组件交互和接口
- **端到端测试（10%）**：关键用户路径验证

### 测试类型
1. **单元测试**
   - 函数/方法级别
   - Mock 外部依赖
   - 边界条件测试
   - 异常处理测试

2. **集成测试**
   - API 接口测试
   - 数据库交互测试
   - 服务间通信测试
   - 消息队列测试

3. **端到端测试**
   - 用户场景测试
   - UI 自动化测试
   - 跨系统工作流测试

4. **性能测试**
   - 负载测试
   - 压力测试
   - 并发测试
   - 内存泄漏检测

## 测试实现

### 测试框架选择
```javascript
// JavaScript/TypeScript
- Jest：单元测试和集成测试
- Cypress：端到端测试
- K6：性能测试

// Python
- pytest：单元和集成测试
- Selenium：端到端测试
- Locust：性能测试

// Go
- testing：标准测试
- testify：断言和 mock
- vegeta：性能测试
```

### 测试模式
- **AAA 模式**：Arrange（准备）、Act（执行）、Assert（断言）
- **Given-When-Then**：BDD 风格测试
- **Table-driven**：参数化测试

## 测试覆盖率

### 覆盖率目标
- 语句覆盖：>80%
- 分支覆盖：>70%
- 函数覆盖：>90%
- 关键路径：100%

### 覆盖率分析
1. 识别未测试代码
2. 分析测试盲点
3. 补充边界测试
4. 验证异常路径

## 测试最佳实践

### 测试原则
- **F.I.R.S.T**
  - Fast：测试快速执行
  - Independent：测试相互独立
  - Repeatable：可重复运行
  - Self-Validating：自动验证
  - Timely：及时编写

### 测试命名
```javascript
// 描述性命名
test('should return user when valid ID is provided')
test('should throw error when ID is null')
test('should handle concurrent requests correctly')
```

### Mock 策略
- Mock 外部服务
- Stub 数据库调用
- Spy 函数调用
- Fake 对象实现

## 持续集成

### CI/CD 集成
```yaml
# GitHub Actions 示例
- name: Run Tests
  run: |
    npm test -- --coverage
    npm run test:e2e
    npm run test:perf
```

### 测试报告
- 覆盖率报告
- 失败详情
- 性能基准
- 趋势分析

## 输出格式

### 测试计划
```markdown
## 测试策略
- 测试范围：[模块/功能]
- 测试类型：[单元/集成/E2E]
- 优先级：[P0/P1/P2]

## 测试用例
1. [测试场景]
   - 前置条件
   - 测试步骤
   - 预期结果

## 风险评估
- 未覆盖场景
- 潜在问题
- 缓解措施
```

### 测试代码
- 完整的测试文件
- 清晰的测试描述
- 必要的 setup/teardown
- 断言和错误信息

## 故障排查

### 常见问题
- **测试不稳定**：隔离外部依赖、固定测试数据
- **测试缓慢**：并行执行、优化 setup
- **覆盖率低**：识别关键路径、补充边界测试
- **维护困难**：提取共享代码、使用 Page Object 模式

## 🚀 现在开始执行测试策略

基于你提供的测试类型和目标文件，我将调用专业的测试执行agent来实施完整的测试方案：

### 测试执行流程
1. **分析项目结构** - 识别现有测试框架和配置
2. **制定测试策略** - 根据代码结构设计测试方案
3. **调用 test-runner agent** - 执行专业测试实施
4. **生成测试报告** - 提供覆盖率和质量分析

让我现在调用专业的测试执行agent来处理你的测试需求...