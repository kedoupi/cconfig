#!/usr/bin/env node

/**
 * /specs 命令 - 规格文档生成专家
 * 创建需求、设计和任务三个完整文档
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');

class SpecsCommand {
  constructor() {
    this.name = 'specs';
    this.description = '规格文档生成，创建需求、设计和任务三个完整文档';
    this.usage = '/specs [功能名称]';
  }

  async execute(args, context) {
    console.log(chalk.blue.bold('📚 规格文档生成专家'));
    console.log(chalk.gray('创建完整的项目规格文档...'));
    console.log();

    const featureName = args.join('-') || await this.getFeatureName();
    const specsDir = path.join(process.cwd(), 'docs', 'specs', featureName);
    
    await fs.ensureDir(specsDir);
    
    console.log(chalk.yellow(`📁 创建规格文档目录: ${specsDir}`));
    
    // 生成三个核心文档
    await this.generateRequirements(specsDir, featureName);
    await this.generateDesign(specsDir, featureName);
    await this.generateTasks(specsDir, featureName);
    
    console.log(chalk.green('✨ 规格文档生成完成'));
    console.log();
    console.log(chalk.blue('📋 生成的文档:'));
    console.log(chalk.gray(`  📄 ${specsDir}/requirements.md - 需求规格文档`));
    console.log(chalk.gray(`  🎨 ${specsDir}/design.md - 系统设计文档`));
    console.log(chalk.gray(`  ✅ ${specsDir}/tasks.md - 开发任务清单`));
    
    return {
      command: 'specs',
      featureName: featureName,
      specsDir: specsDir,
      files: ['requirements.md', 'design.md', 'tasks.md']
    };
  }

  async getFeatureName() {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '请输入功能特性名称：',
        validate: input => input.trim().length > 0 || '请输入功能名称'
      }
    ]);
    return name.replace(/\s+/g, '-').toLowerCase();
  }

  async generateRequirements(specsDir, featureName) {
    const requirementsContent = `# ${featureName} - 需求规格文档

## 1. 项目概述

### 1.1 项目背景
[描述项目背景和业务需求]

### 1.2 项目目标
[明确项目要达成的目标]

### 1.3 项目范围
[定义项目的边界和限制]

## 2. 功能需求

### 2.1 核心功能
- [ ] 功能点1：[详细描述]
- [ ] 功能点2：[详细描述]
- [ ] 功能点3：[详细描述]

### 2.2 用户角色
| 角色 | 描述 | 权限 |
|------|------|------|
| 用户角色1 | [角色描述] | [权限列表] |
| 用户角色2 | [角色描述] | [权限列表] |

### 2.3 用户故事
#### 故事1：[标题]
- **作为** [用户角色]
- **我想要** [功能描述]
- **以便** [价值说明]
- **验收标准**：
  - [ ] 标准1
  - [ ] 标准2

## 3. 非功能需求

### 3.1 性能需求
- 响应时间：< 500ms
- 并发用户：1000+
- 系统可用性：99.9%

### 3.2 安全需求
- 数据加密
- 身份认证
- 权限控制

### 3.3 兼容性需求
- 浏览器支持
- 移动端适配
- 操作系统兼容

## 4. 约束条件

### 4.1 技术约束
[技术选型限制]

### 4.2 时间约束
[项目时间限制]

### 4.3 资源约束
[人力和预算限制]

## 5. 验收标准

### 5.1 功能验收
- [ ] 所有核心功能正常工作
- [ ] 用户体验符合要求
- [ ] 性能指标达标

### 5.2 质量验收
- [ ] 代码覆盖率 > 80%
- [ ] 无严重安全漏洞
- [ ] 文档完整

---

**文档版本**: 1.0  
**创建日期**: ${new Date().toISOString().split('T')[0]}  
**更新日期**: ${new Date().toISOString().split('T')[0]}  
`;

    await fs.writeFile(path.join(specsDir, 'requirements.md'), requirementsContent);
  }

  async generateDesign(specsDir, featureName) {
    const designContent = `# ${featureName} - 系统设计文档

## 1. 系统架构

### 1.1 整体架构
\`\`\`
[架构图 - 可使用 Mermaid 语法]
graph TB
    A[前端] --> B[API网关]
    B --> C[业务服务]
    C --> D[数据库]
\`\`\`

### 1.2 技术栈
- **前端**: [技术选择]
- **后端**: [技术选择]
- **数据库**: [技术选择]
- **中间件**: [技术选择]

## 2. 模块设计

### 2.1 核心模块
#### 模块1：[模块名]
- **职责**: [模块职责]
- **接口**: [对外接口]
- **依赖**: [依赖关系]

#### 模块2：[模块名]
- **职责**: [模块职责]
- **接口**: [对外接口]
- **依赖**: [依赖关系]

### 2.2 模块关系图
\`\`\`
[模块关系图]
\`\`\`

## 3. 数据设计

### 3.1 数据模型
#### 实体1：[实体名]
\`\`\`sql
CREATE TABLE entity1 (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### 实体2：[实体名]
\`\`\`sql
CREATE TABLE entity2 (
    id BIGINT PRIMARY KEY,
    entity1_id BIGINT REFERENCES entity1(id),
    data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 3.2 数据流图
\`\`\`
[数据流向图]
\`\`\`

## 4. API设计

### 4.1 RESTful API
#### 用户管理
- \`GET /api/users\` - 获取用户列表
- \`POST /api/users\` - 创建用户
- \`GET /api/users/{id}\` - 获取用户详情
- \`PUT /api/users/{id}\` - 更新用户
- \`DELETE /api/users/{id}\` - 删除用户

### 4.2 请求/响应格式
\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

## 5. 界面设计

### 5.1 页面结构
- 主页面
- 列表页面
- 详情页面
- 编辑页面

### 5.2 交互设计
- 用户操作流程
- 状态转换
- 错误处理

## 6. 安全设计

### 6.1 认证授权
- JWT Token
- OAuth 2.0
- 角色权限

### 6.2 数据安全
- 敏感数据加密
- SQL注入防护
- XSS防护

## 7. 性能设计

### 7.1 优化策略
- 数据库索引
- 缓存策略
- CDN加速

### 7.2 监控指标
- 响应时间
- 吞吐量
- 错误率

## 8. 部署设计

### 8.1 环境规划
- 开发环境
- 测试环境
- 生产环境

### 8.2 部署架构
\`\`\`
[部署图]
\`\`\`

---

**文档版本**: 1.0  
**创建日期**: ${new Date().toISOString().split('T')[0]}  
**更新日期**: ${new Date().toISOString().split('T')[0]}  
`;

    await fs.writeFile(path.join(specsDir, 'design.md'), designContent);
  }

  async generateTasks(specsDir, featureName) {
    const tasksContent = `# ${featureName} - 开发任务清单

## 项目初始化

### Phase 1: 环境搭建
- [ ] **Task 1.1**: 创建项目结构
  - 初始化项目目录
  - 配置构建工具
  - 设置代码规范
  
- [ ] **Task 1.2**: 配置开发环境
  - 配置数据库
  - 设置环境变量
  - 配置日志系统

- [ ] **Task 1.3**: 设置CI/CD
  - 配置GitHub Actions
  - 设置自动测试
  - 配置部署流程

## Phase 2: 后端开发

### 数据层开发
- [ ] **Task 2.1**: 数据库设计实现
  - 创建数据表
  - 设置索引
  - 配置数据库连接池

- [ ] **Task 2.2**: 数据访问层
  - 实现DAO/Repository
  - 编写数据操作方法
  - 数据验证和约束

### 业务层开发
- [ ] **Task 2.3**: 核心业务逻辑
  - 实现业务服务
  - 处理业务规则
  - 异常处理机制

- [ ] **Task 2.4**: API接口开发
  - RESTful API实现
  - 请求参数验证
  - 响应格式统一

### 安全和认证
- [ ] **Task 2.5**: 认证授权系统
  - JWT实现
  - 权限控制
  - 安全中间件

## Phase 3: 前端开发

### 基础框架
- [ ] **Task 3.1**: 前端项目初始化
  - 框架选择和配置
  - 路由配置
  - 状态管理

- [ ] **Task 3.2**: UI组件开发
  - 基础组件库
  - 业务组件
  - 样式系统

### 功能实现
- [ ] **Task 3.3**: 页面开发
  - 主要页面实现
  - 表单处理
  - 数据展示

- [ ] **Task 3.4**: 交互优化
  - 用户体验优化
  - 加载状态处理
  - 错误提示

## Phase 4: 集成测试

### 单元测试
- [ ] **Task 4.1**: 后端单元测试
  - 业务逻辑测试
  - API接口测试
  - 数据层测试

- [ ] **Task 4.2**: 前端单元测试
  - 组件测试
  - 工具函数测试
  - 状态管理测试

### 集成测试
- [ ] **Task 4.3**: 端到端测试
  - 用户流程测试
  - 接口集成测试
  - 性能测试

- [ ] **Task 4.4**: 兼容性测试
  - 浏览器兼容性
  - 移动端适配
  - 响应式测试

## Phase 5: 部署发布

### 生产准备
- [ ] **Task 5.1**: 生产环境配置
  - 环境变量配置
  - 数据库迁移
  - 安全配置

- [ ] **Task 5.2**: 性能优化
  - 代码压缩
  - 资源优化
  - 缓存策略

### 上线发布
- [ ] **Task 5.3**: 部署流程
  - 自动化部署
  - 回滚机制
  - 监控告警

- [ ] **Task 5.4**: 文档完善
  - API文档
  - 用户手册
  - 运维文档

## 项目里程碑

### Milestone 1: MVP版本 (Phase 1-2)
**目标**: 基础功能实现
**交付物**: 
- 后端API接口
- 基础数据模型
- 核心业务逻辑

### Milestone 2: 完整功能版本 (Phase 3-4)
**目标**: 完整产品实现
**交付物**:
- 前端用户界面
- 完整功能流程
- 测试覆盖

### Milestone 3: 生产就绪版本 (Phase 5)
**目标**: 生产环境部署
**交付物**:
- 生产环境配置
- 完整文档
- 监控体系

## 风险管理

### 技术风险
- **风险**: 技术选型不当
  **缓解**: 技术调研和原型验证

- **风险**: 性能瓶颈
  **缓解**: 压力测试和性能监控

### 进度风险
- **风险**: 开发进度滞后
  **缓解**: 任务分解和进度跟踪

- **风险**: 需求变更频繁
  **缓解**: 敏捷开发和版本控制

## 质量标准

### 代码质量
- [ ] 代码覆盖率 > 80%
- [ ] 代码规范检查通过
- [ ] 安全漏洞扫描通过

### 产品质量
- [ ] 功能测试通过
- [ ] 性能指标达标
- [ ] 用户体验良好

---

**文档版本**: 1.0  
**创建日期**: ${new Date().toISOString().split('T')[0]}  
**更新日期**: ${new Date().toISOString().split('T')[0]}  
`;

    await fs.writeFile(path.join(specsDir, 'tasks.md'), tasksContent);
  }
}

module.exports = SpecsCommand;