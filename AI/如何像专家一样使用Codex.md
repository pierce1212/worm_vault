---
title: "如何像专家一样使用Codex"
author: "知识猫图解 (@GeekCatX)"
source: "https://x.com/GeekCatX/status/2061373240258470154"
article_id: "2061368880048775168"
created_at: "Mon Jun 01 09:04:13 +0000 2026"
---

# 如何像专家一样使用Codex

- 作者：知识猫图解 (@GeekCatX)
- 原文：https://x.com/GeekCatX/status/2061373240258470154
- Article ID：2061368880048775168
- 发布时间：Mon Jun 01 09:04:13 +0000 2026
- 封面图：https://pbs.twimg.com/media/HJt4AeUbIAAHjFf.jpg

## 摘要

像专家一样使用 Codex，不是靠“神奇提示词”，而是建立一套可复用、可验证、可控权限、可沉淀经验的工程工作流。
一句话：让 Codex 做执行、探索、验证、整理；你负责目标、边界、验收和最终判断。
1.

## 正文

像专家一样使用 Codex，不是靠“神奇提示词”，而是建立一套**可复用、可验证、可控权限、可沉淀经验**的工程工作流。

一句话：**让 Codex 做执行、探索、验证、整理；你负责目标、边界、验收和最终判断。**

## 1. 专家不会直接说“帮我写代码”

新手提示词：

> 帮我做一个登录功能。

专家提示词：

> 目标：
> 为现有项目增加邮箱+密码登录功能。
>
> 范围：
> - 前端：登录页、表单校验、错误提示
> - 后端：登录 API
> - 数据库：如有必要新增用户表字段
> - 不要修改现有注册流程
>
> 约束：
> - 不新增大型依赖
> - 保持现有 UI 风格
> - 不要直接提交 commit
>
> 验收标准：
> 1. 空邮箱、错误邮箱、错误密码都有提示
> 2. 登录成功后跳转到 dashboard
> 3. 登录失败不泄露用户是否存在
> 4. 添加必要测试
> 5. npm test / lint / typecheck 通过
>
> 工作方式：
> 先阅读代码并给实现计划，不要马上修改。

专家的关键是：**任务必须有目标、范围、约束、验收标准、执行流程**。

## 2. 第一件事：让 Codex 先读项目，不要先改项目

Codex CLI 能在本地终端读取、修改并运行所选目录里的代码。也正因为它能动真实项目，所以专家第一步通常是“只读分析”。(OpenAI 開發者)

你每进一个新项目，先发：

> 请只阅读项目，不要修改任何文件。
>
> 输出：
> 1. 项目是做什么的
> 2. 技术栈
> 3. 目录结构
> 4. 关键业务流程
> 5. 启动、测试、构建命令
> 6. 最容易出问题的模块
> 7. 建议写入 AGENTS.md 的项目规则

然后再问：

> 请找出和【某功能】相关的所有文件，并画出调用链。
> 不要修改代码。

这能防止 Codex 一上来乱改。

## 3. 必须维护 AGENTS.md

AGENTS.md 是 Codex 专家级使用的核心。官方文档说明，Codex 会在开始工作前读取 AGENTS.md，可以通过全局指导和项目级覆盖，让每次任务都有一致的期望。(OpenAI 開發者)

先运行：

> /init

官方最佳实践也提到，/init 可以快速生成初始 AGENTS.md，但你应该手动编辑，让它符合团队真实的构建、测试、review 和发布流程。(OpenAI 開發者)

推荐你的 AGENTS.md 这样写：

```markdown
# AGENTS.md

## 项目说明
这是一个 Next.js + TypeScript 项目，用于 xxx。

## 常用命令
- 安装依赖：npm install
- 本地启动：npm run dev
- 类型检查：npm run typecheck
- Lint：npm run lint
- 测试：npm test
- 构建：npm run build

## 工作规则
- 修改前必须先说明影响范围和计划
- 默认最小改动
- 不要无理由新增依赖
- 不要重写无关模块
- 改业务逻辑必须补测试
- 改 UI 必须检查 loading、empty、error、mobile 状态
- 完成后必须说明测试结果和潜在风险

## 完成标准
- 相关测试通过
- lint/typecheck/build 通过
- 行为符合验收标准
- diff 可 review

```

高级技巧：**每次 Codex 犯错，就把规则补进 AGENTS.md**。

例如它经常乱加依赖，你就加：

> 禁止新增依赖，除非先说明原因、替代方案和体积影响，并获得确认。

## 4. 用 /plan 控制复杂任务

专家不会让 Codex 直接做大任务，而是先规划。

> /plan
> 我要把当前项目的支付流程重构成更清晰的 service 层。
> 请先分析影响范围、风险、迁移步骤和测试策略。
> 不要修改代码。

Codex App 的命令说明里，/plan 用于多步骤规划，/goal 用于设置持续目标，官方也建议先用 /plan 塑形再用 /goal。(OpenAI 開發者)

你可以要求它输出：

> 请按这个格式给计划：
> 1. 你理解的目标
> 2. 涉及文件
> 3. 风险点
> 4. 分阶段方案
> 5. 每阶段验收标准
> 6. 需要我确认的问题

专家习惯是：**计划没通过，不让它改代码。**

## 5. 用 /goal 处理长任务

当任务不是一次就能完成，比如迁移、重构、修复大量测试，可以用 /goal。官方说明 /goal 适合让 Codex 围绕一个可验证的停止条件持续工作。(OpenAI 開發者)

示例：

> /goal Complete the migration from local state to Zustand.
>
> Stop only when:
> 1. App behavior is unchanged
> 2. All tests pass
> 3. npm run build succeeds
> 4. State management code is documented
> 5. A migration summary is written

适合：

> 修复所有 failing tests
> 完成技术栈迁移
> 重构大型模块
> 补齐测试覆盖
> 完成 MVP
> 清理技术债

重点是：**停止条件必须具体可验证**。

## 6. 权限要分模式，不要一直全开放

Codex 的 sandbox 是让它能自主行动但不获得无限制机器权限的边界；它运行本地命令时会在受限环境中执行，而不是默认拥有完整系统权限。(OpenAI 開發者)

专家常用 3 种模式。

### 只读分析模式

适合：读代码、审查、解释、规划。

> /permissions
> 切换到 read-only。

然后：

> 请分析当前项目的认证流程，不要修改代码。

### 常规开发模式

适合：日常写代码、跑测试。

> codex --sandbox workspace-write --ask-for-approval on-request

这个模式下，Codex 可以在工作区内读写和运行命令，但越界操作需要请求批准。官方资料也说明 Auto 预设类似 workspace-write + on-request，会在编辑工作区外文件或需要网络访问时请求批准。(OpenAI 開發者)

### 高风险操作模式

凡是涉及这些事，都要明确限制：

> 删除文件
> 数据库迁移
> 生产配置
> 密钥
> 支付
> 认证权限
> CI/CD
> 部署
> 批量重构

你可以说：

> 这是高风险任务。
> 只允许分析和提出方案，不允许修改文件、运行迁移、删除数据或改配置。

## 7. 每次都让它跑测试，而不是只看它说“完成了”

专家级工作流：

> 请完成修改后运行：
> 1. npm run lint
> 2. npm run typecheck
> 3. npm test
> 4. npm run build
>
> 如果失败：
> - 先解释失败原因
> - 再修复
> - 不要掩盖测试
> - 不要删除测试

再加一句非常重要：

> 如果无法运行测试，请明确说明原因，并告诉我应该手动运行哪些命令。

Codex 专家不会相信“看起来可以”，只相信**可复现验证结果**。

## 8. 用 /review 当第二双眼睛

写完代码后，不要立刻合并。让 Codex 进入 review 模式。

> /review
> 请 review 当前未提交改动，重点检查：
> 1. 逻辑 bug
> 2. 安全风险
> 3. 边界条件
> 4. 测试缺失
> 5. 过度设计
> 6. 是否违反 AGENTS.md

官方命令说明中，/review 可用于审查未提交改动或和 base branch 比较。(OpenAI 開發者)

更强的用法：

> 请不要修改代码，只输出 review 结果。
> 按 P0 / P1 / P2 分类。
> 每个问题包含：
> - 问题描述
> - 相关文件
> - 为什么有风险
> - 建议修复方式

## 9. 用 Subagents 做并行专家审查

Subagents 是高级功能。官方说明 Codex 可以生成专门的子 agent 并行探索、处理或分析任务，最后汇总结果。(OpenAI 開發者)

你可以这样用：

> 请使用 subagents 并行审查当前改动：
>
> Agent A：检查业务逻辑和边界条件
> Agent B：检查安全、认证、权限问题
> Agent C：检查测试覆盖
> Agent D：检查性能和可维护性
> Agent E：检查 UI/UX、移动端、可访问性
>
> 不要修改代码。
> 最后合并成一份 review 报告，按严重程度排序。

适合：

上线前审查
大型重构后检查
安全敏感功能
复杂 bug 定位
多模块改动

## 10. 用 Skill 封装重复流程

Skills 是 Codex 高阶能力之一。官方说明，Skill 是由说明、资源和可选脚本组成的任务能力包，可以让 Codex 更可靠地执行特定工作流。(OpenAI 開發者)

也就是说，你不应该每次都写长提示词，而是把常用流程封装成 Skill。

例如你创建一个：

> frontend-polish

SKILL.md 可以写：

```markdown
---
name: frontend-polish
description: Use this skill when improving UI quality, layout, responsiveness, accessibility, loading states, empty states, and error states.
---

When triggered:
1. Inspect affected components
2. Check layout, spacing, typography, and responsive behavior
3. Ensure loading, empty, and error states exist
4. Check accessibility labels and keyboard navigation
5. Avoid changing unrelated business logic
6. Run typecheck/build if available
7. Summarize visual and behavior changes
```

调用：

> $frontend-polish 请优化当前 dashboard 页面，但不要改业务逻辑。

官方变更日志也提到，Skills 可以在 Codex CLI 和 IDE 扩展中使用，可显式输入 $skill-name 调用，也可以让 Codex 根据提示自动选择。(OpenAI 開發者)

## 11. 用自定义 Slash Command 做快捷工作流

Codex CLI 的 slash commands 可以快速切换模型、调整权限、总结长对话，也能创建自定义命令。(OpenAI 開發者)

你可以创建这些命令：

> /deep-review
> /fix-tests
> /write-readme
> /explain-module
> /refactor-safely
> /security-audit
> /frontend-polish

例如 /deep-review 的内容：

> 请深度 review 当前 diff。
>
> 检查：
> 1. correctness
> 2. edge cases
> 3. security
> 4. performance
> 5. tests
> 6. maintainability
> 7. whether it follows AGENTS.md
>
> 不要修改代码。
> 按 P0/P1/P2 输出。

以后只要输入：

> /deep-review

就能复用整套审查流程。

## 12. 用 MCP 连接外部上下文

Codex 的 customization 层包括项目指导、Skills、MCP 和 Subagents。官方说明，自定义就是让 Codex 按你的团队工作方式工作。(OpenAI 開發者)

MCP 的价值是：让 Codex 不只看本地代码，还能接入外部系统。

例如：

> GitHub：读 issue、PR、CI 结果
> Linear/Jira：读任务和验收标准
> Figma：读设计稿
> Sentry：读线上错误
> Notion：读产品文档
> Docs：查内部 API 文档

专家用法：

> 请读取这个 Linear ticket 的验收标准，再检查当前代码是否满足。
> 如果不满足，先给实现计划，不要修改代码。

或者：

> 请根据 Sentry 错误日志定位问题。
> 要求：
> 1. 找到可能的代码位置
> 2. 给复现路径
> 3. 判断影响范围
> 4. 提出最小修复方案
> 5. 不要直接改代码

## 13. 长会话要定期压缩上下文

长任务最容易跑偏。Codex App 的 /status 可以显示 thread ID、上下文使用量和速率限制。(OpenAI 開發者)

当任务做了很久，你可以说：

> /status

然后：

> 请总结当前任务状态：
> 1. 原始目标
> 2. 已做改动
> 3. 已确认的决策
> 4. 失败过的尝试
> 5. 当前剩余问题
> 6. 下一步计划
> 7. 需要继续遵守的约束
>
> 后续请基于这个摘要继续。

专家会主动“整理战场”，避免 Codex 忘记前面的约束。

## 14. 专家常用的 8 个提示词模板

### A. 读项目

请只读项目，不要修改文件。
输出：
1. 项目目标
2. 技术栈
3. 目录结构
4. 核心数据流
5. 关键文件
6. 启动/测试/构建命令
7. 潜在风险

### B. 做功能

请实现【功能】。

范围：
【允许修改的模块】

约束：
【不要改什么】

验收标准：
1.
2.
3.

流程：
先给计划，不要马上改。
确认计划后再实现。
实现后运行测试并总结。

### C. 修 bug

请修复这个 bug。

要求：
1. 先复现或解释如何复现
2. 找根因
3. 给最小修复方案
4. 修改最少代码
5. 补充回归测试
6. 跑测试
7. 总结风险

### D. 重构

请重构这个模块。

目标：
提升可读性和可维护性。

约束：
1. 外部行为不变
2. API 不变
3. 不新增依赖
4. 每一步都保持测试通过

请先列出重构计划和风险。

### E. 写测试

请为【模块/功能】补测试。

覆盖：
1. 正常路径
2. 边界条件
3. 错误输入
4. 权限问题
5. 回归场景

不要为了让测试通过而修改业务逻辑，除非发现真实 bug。

### F. Review

请 review 当前 diff，不要修改代码。

重点：
1. 逻辑 bug
2. 安全问题
3. 边界条件
4. 性能问题
5. 缺失测试
6. 过度复杂
7. 是否违反 AGENTS.md

按严重程度输出。

### G. 写文档

请根据当前项目生成 README。

包括：
1. 项目介绍
2. 功能列表
3. 技术栈
4. 本地运行
5. 环境变量
6. 测试命令
7. 部署方式
8. 常见问题

### H. 复盘沉淀

请总结这次任务中可以沉淀到 AGENTS.md 的规则。

输出：
1. 新增规则
2. 为什么需要
3. 应放在哪个章节
4. 是否会影响未来任务

## 15. 专家级 Codex 工作流

每次任务都按这个顺序：

1. 明确目标
2. 明确范围
3. 明确不做什么
4. 明确验收标准
5. 让 Codex 只读分析
6. 让 Codex 给计划
7. 人类确认计划
8. 小步实现
9. 跑测试
10. Review diff
11. 修复 review 问题
12. 更新文档
13. 沉淀规则到 AGENTS.md / Skill

你可以直接用这个总控提示词：

```markdown
你是我的 Codex 专家级编程搭档。

工作规则：
1. 不要急着写代码
2. 先阅读相关文件
3. 先说明你理解的目标、范围、风险
4. 给出计划后等待确认
5. 修改时保持最小改动
6. 不要无理由新增依赖
7. 修改后必须运行相关测试
8. 如果测试无法运行，说明原因和手动命令
9. 最后输出改动摘要、测试结果、潜在风险
10. 发现可复用经验时，建议写入 AGENTS.md 或 Skill

当前任务：
【写你的任务】

验收标准：
【写怎样算完成】
```

## 16. 判断你是否已经“像专家一样使用 Codex”

你能做到这些，就已经不是普通用户了：

1. 不再用模糊提示词，而是写目标、范围、约束、验收标准。
1. 每个项目都有 AGENTS.md。
1. 大任务先 /plan，长任务用 /goal。
1. 会按风险切换权限，而不是一直全开放。
1. 每次改完都要求测试、lint、typecheck、build。
1. 会用 /review 和 subagents 做多角度审查。
1. 把重复流程封装成 Skill 或自定义命令。
1. 会用 MCP 接入 issue、设计稿、日志、文档等上下文。
1. 会让 Codex 复盘，并把经验沉淀。
1. 永远不盲信 Codex，最终由你验收。
最重要的心法是：

**Codex 负责高强度执行，你负责工程判断。专家不是让 Codex 自由发挥，而是把 Codex 放进一套严密的工作流里。**
