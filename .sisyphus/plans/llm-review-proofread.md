# 新增 LLM 校对结果审核环节

## TL;DR

&gt; **Quick Summary**: 在校对流程末尾新增 LLM 自动审核环节，过滤无效/错误的校对建议，提升整体校对质量。审核模型可单独配置，支持分批处理（100条/批），被过滤结果可恢复。
&gt;
&gt; **Deliverables**:
&gt; - 新增审核模型配置 UI（ProofSet.vue）
&gt; - 新增审核逻辑（reviewCorrections()）
&gt; - 扩展校对结果类型（filtered/filterReason 字段）
&gt; - UI 展示审核结果（可恢复过滤项）
&gt; - 自动化测试（Vitest 搭建 + 测试用例）
&gt;
&gt; **Estimated Effort**: Medium
&gt; **Parallel Execution**: YES - 5 波
&gt; **Critical Path**: Wave 1 类型定义 → Wave 2 配置 UI + 审核逻辑 → Wave 3 集成 IPC + 进度更新 → Wave 4 UI 展示 → Wave 5 测试

---

## Context

### Original Request

用户要改善校对流程，在校对结束后新增一个环节，使用大模型对校对结果进行审核，过滤不必要的校对建议。交给大模型审核的内容包括全文背景和校对结果。如果校对结果超过100条则分批审核，每一批次也包含全文背景。模型输出审核后的校对结果（保持原有格式）。审核主要过滤以下几类内容：1.没有改动的（原文和修改后相同），2.不必要的改动，3.空白的改动，4.有明显错误的改动。

### Interview Summary

**Key Discussions**:

- 审核模型：单独配置（不与校对模型共用）
- 触发方式：校对完成后自动触发
- 全文背景：promptSettings 中的 background 设置（学术/新闻/公文/日常/自定义）
- 过滤结果展示：标记但仍显示（可恢复）
- 审核模型配置 UI：在提示词设置页面新增
- 测试策略：需要自动化测试

### Research Findings

- **核心架构**：Electron + Vue 3 + TypeScript
- **校对入口**：Proof.vue → electronAPI.processDocx() → IPC process-docx → proofreadDocument()
- **关键类型**：ProofreadingCorrection（主进程），CorrectionResult（前端）
- **可复用组件**：OpenaiGen()，runWithLimits()，parseCorrections()
- **插入点**：主进程 ipcHandlers.ts，proofreadDocument 返回后、IPC 返回前
- **进度系统**：ProofreadProgressPayload，可扩展 'reviewing' 阶段

### Auto-Resolved Gaps

- 分批数量：100 条/批（用户明确说了）
- 审核模型配置持久化：复用数据库表或新建，计划用现有 api_settings 表结构的变体
- Token 用量统计：复用现有 addTotalTokens()
- 历史记录保存：审核结果与校对结果一起保存，增加标识字段

---

## Work Objectives

### Core Objective

在校对流程末尾新增 LLM 自动审核环节，过滤无效/错误的校对建议，提升用户体验和校对质量。

### Concrete Deliverables

- `src/shared/promptSettings.ts`：扩展类型，新增审核模型配置
- `src/main/proof.ts`：新增 reviewCorrections() 函数
- `src/shared/proofreadProgress.ts`：扩展 ProofreadStage，新增 'reviewing'
- `src/main/ipcHandlers.ts`：集成审核逻辑到 process-docx handler
- `src/renderer/stores/store.ts`：扩展 CorrectionResult，新增 filtered/filterReason
- `src/renderer/views/ProofSet.vue`：新增审核模型配置 UI
- `src/renderer/views/Proof.vue`：展示审核结果，支持恢复过滤项
- `src/main/preload.ts`：暴露新的 IPC 通道
- **测试**：Vitest 框架搭建，核心逻辑测试用例

### Definition of Done

- [ ] 所有代码编译通过（`npm run lint:fix`，`tsc --noEmit`）
- [ ] 审核模型配置 UI 可用（ProofSet.vue）
- [ ] 校对完成后自动触发审核
- [ ] 超过 100 条结果时分批审核
- [ ] 被过滤的结果标记但仍显示（可恢复）
- [ ] 所有新增功能有测试覆盖
- [ ] 历史记录保存审核结果

### Must Have

- 审核模型可单独配置（apiKey/apiURL/modelName）
- 自动触发审核，无需用户额外操作
- 分批处理逻辑（100条/批）
- 过滤结果可恢复
- 配置持久化到数据库
- Token 用量统计

### Must NOT Have (Guardrails)

- **NO** 修改校对流程本身（proofreadDocument 内部逻辑不动）
- **NO** AI 滥造：避免添加不必要的抽象层，尽量复用现有代码
- **NO** 过度注释：保持代码自解释，仅在复杂逻辑处加注释
- **NO** 打破现有架构：审核逻辑是附加的，不是重构
- **NO** 破坏历史记录格式：向后兼容

---

## Verification Strategy (MANDATORY)

&gt; **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
&gt; Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision

- **Infrastructure exists**: NO（项目无现有测试框架）
- **Automated tests**: YES（新增 Vitest 框架）
- **Framework**: Vitest
- **If TDD**: 先写测试框架，再写功能

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend logic**: Bash + node 脚本导入测试
- **Frontend/UI**: Playwright 启动应用验证
- **IPC/Integration**: 启动 Electron 应用验证

---

## Execution Strategy

### Parallel Execution Waves

&gt; Maximize throughput by grouping independent tasks into parallel waves.
&gt; Each wave completes before the next begins.
&gt; Target: 5-8 tasks per wave.

```
Wave 1 (Start Immediately — 类型定义 + 配置 + 框架):
├── Task 1: 扩展核心类型定义 (shared/proofreadProgress.ts, shared/promptSettings.ts)
├── Task 2: 扩展数据库层 (database.ts) — 新增/复用审核模型配置表
├── Task 3: 搭建 Vitest 测试框架 (package.json + vitest.config.ts)
├── Task 4: 扩展前端 store (renderer/stores/store.ts) — filtered/filterReason 字段
└── Task 5: 扩展主进程类型 (main/proof.ts) — ReviewedCorrection 类型

Wave 2 (After Wave 1 — 核心功能):
├── Task 6: 实现审核逻辑 (main/proof.ts) — reviewCorrections() + 分批
├── Task 7: 审核 Prompt 构建 (main/proof.ts) — 审核系统提示词
├── Task 8: 审核模型配置 UI (renderer/views/ProofSet.vue)
└── Task 9: 扩展 IPC 通道 (main/ipcHandlers.ts) — 审核模型 CRUD

Wave 3 (After Wave 2 — 集成):
├── Task 10: 集成审核逻辑到 process-docx (main/ipcHandlers.ts)
├── Task 11: 扩展进度 UI (renderer/views/Proof.vue + ProofSet.vue) — reviewing 阶段
├── Task 12: 暴露新 IPC 到 preload (main/preload.ts)
└── Task 13: Token 用量统计集成

Wave 4 (After Wave 3 — UI 展示):
├── Task 14: 前端展示审核结果 (renderer/views/Proof.vue) — 过滤标记 + 恢复
├── Task 15: 历史记录兼容 (main/database.ts + renderer/views/history.vue)
└── Task 16: 完整流程 E2E 验证

Wave 5 (After Wave 4 — 测试):
├── Task 17: 审核逻辑单元测试 (Vitest)
├── Task 18: 集成测试 (Vitest + Playwright)
└── Task 19: 完整 E2E 测试 (Playwright)

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-&gt; Present results -&gt; Get explicit user okay
```

### Dependency Matrix (abbreviated)

- **1-5**: — — 6-9
- **6**: 1,5 — 10
- **7**: 1,5 — 10
- **8**: 1,2 — 12
- **9**: 1,2 — 12
- **10**: 6,7,9 — 14
- **11**: 1,10 — 14
- **12**: 9 — 14
- **13**: 10 — 14
- **14**: 10,11,12,13 — 15
- **15**: 1,2 — 17
- **17**: 14 — 18
- **18**: 17 — 19
- **19**: 18 — F1-F4

### Agent Dispatch Summary

- **1**: **5** — T1-T2 → `unspecified-high`, T3 → `quick`, T4 → `quick`, T5 → `unspecified-high`
- **2**: **4** — T6-T7 → `deep`, T8 → `visual-engineering`, T9 → `unspecified-high`
- **3**: **4** — T10-T13 → `unspecified-high`
- **4**: **3** — T14-T15 → `visual-engineering`, T16 → `deep`
- **5**: **3** — T17-T18 → `unspecified-high`, T19 → `deep`
- **FINAL**: **4** — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

&gt; Implementation + Test = ONE Task. Never separate.
&gt; EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. 扩展核心类型定义

  **What to do**:
  - src/shared/proofreadProgress.ts: 在 ProofreadStage 类型新增 'reviewing'
  - src/shared/promptSettings.ts: 新增 ReviewModelSettings 类型（apiKey/apiURL/modelName）
  - src/main/proof.ts: 新增 ReviewedCorrection 类型，扩展 ProofreadingCorrection 增加 filtered?: boolean, filterReason?: string

  **Must NOT do**:
  - 不要修改现有类型的必填字段，保持向后兼容

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及多个模块的类型定义，需要协调保持一致性
  - **Skills**: []
    - Reason: 不需要特殊技能，类型定义是通用开发

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6,7,10,11,14
  - **Blocked By**: None

  **References**:
  - `src/shared/proofreadProgress.ts` — ProofreadStage 和 ProofreadProgressPayload 定义
  - `src/shared/promptSettings.ts` — PromptSettings 和相关类型定义
  - `src/main/proof.ts:18` — ProofreadingCorrection 类型定义

  **Acceptance Criteria**:
  - [ ] 所有新类型编译通过（tsc --noEmit）
  - [ ] 新类型的字段名清晰，符合项目命名习惯

  **QA Scenarios**:

  ```
  Scenario: 类型定义可导入和使用
    Tool: Bash
    Preconditions: 类型定义已保存
    Steps:
      1. 创建临时 test-import.ts，导入新类型
      2. tsc --noEmit 验证编译
    Expected Result: 无 TypeScript 错误
    Evidence: .sisyphus/evidence/task-1-type-check.ts
  ```

  **Commit**: YES (groups with 1,2,3,4,5)
  - Message: `feat: add review model core types`
  - Files: `src/shared/proofreadProgress.ts`, `src/shared/promptSettings.ts`, `src/main/proof.ts`
  - Pre-commit: `tsc --noEmit`

- [ ] 2. 扩展数据库层

  **What to do**:
  - 查看 src/main/database.ts 的现有表结构
  - 复用 api_settings 表结构，或新增 review_model_settings 表
  - 新增 getReviewModelSettings(), setReviewModelSettings() 方法
  - 确保向后兼容：表不存在时自动创建

  **Must NOT do**:
  - 不要删除或修改现有 api_settings 表结构
  - 不要破坏现有历史记录格式

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及数据库 schema 变更，需小心保持兼容性
  - **Skills**: []
    - Reason: 数据库操作是通用开发

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 8,9,15
  - **Blocked By**: None

  **References**:
  - `src/main/database.ts:18-24` — apiSettings 类型定义
  - `src/main/database.ts:70-79` — CREATE TABLE 语句
  - `src/main/database.ts:135-160` — insertAPISetting 示例

  **Acceptance Criteria**:
  - [ ] 数据库方法正确实现（get/set）
  - [ ] 表不存在时自动创建（在 init 逻辑中）
  - [ ] TypeScript 类型正确

  **QA Scenarios**:

  ```
  Scenario: 数据库方法可调用且不会崩溃
    Tool: Bash + node
    Preconditions: 数据库方法已实现
    Steps:
      1. 创建临时 test-db.ts 导入 DB 类
      2. 调用 getReviewModelSettings()
    Expected Result: 无异常，返回默认值或已保存值
    Evidence: .sisyphus/evidence/task-2-db-check.ts
  ```

  **Commit**: YES (groups with 1,2,3,4,5)
  - Message: `feat: extend database for review model settings`
  - Files: `src/main/database.ts`
  - Pre-commit: `tsc --noEmit`

- [ ] 3. 搭建 Vitest 测试框架

  **What to do**:
  - 在 package.json 新增 vitest 依赖
  - 新增 vitest.config.ts 配置文件
  - 新增 **tests**/ 目录
  - 新增 **tests**/sample.test.ts 简单示例测试
  - 在 package.json 新增 "test": "vitest" 脚本

  **Must NOT do**:
  - 不要过度修改 package.json 的现有脚本
  - 不要引入与项目不兼容的依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 只是搭建测试框架，是相对简单的任务
  - **Skills**: []
    - Reason: 不需要特殊技能

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 17,18,19
  - **Blocked By**: None

  **References**:
  - `package.json` — 现有依赖和脚本结构
  - Vitest 官方文档（通过 librarian 查阅）

  **Acceptance Criteria**:
  - [ ] `npm install` 无错误
  - [ ] `npm test` 可以运行并通过示例测试
  - [ ] vitest.config.ts 配置正确

  **QA Scenarios**:

  ```
  Scenario: 测试框架可以运行
    Tool: Bash
    Preconditions: 框架已搭建
    Steps:
      1. npm install
      2. npm test
    Expected Result: 示例测试通过，显示 PASS
    Evidence: .sisyphus/evidence/task-3-test-framework.log
  ```

  **Commit**: YES (groups with 1,2,3,4,5)
  - Message: `feat: add Vitest test framework`
  - Files: `package.json`, `vitest.config.ts`, `__tests__/sample.test.ts`
  - Pre-commit: `npm test`

- [ ] 4. 扩展前端 store

  **What to do**:
  - src/renderer/stores/store.ts: 在 CorrectionResult 接口新增 filtered?: boolean, filterReason?: string
  - 确保 Pinia store 类型正确
  - 保持向后兼容（新增字段都是可选的）

  **Must NOT do**:
  - 不要修改现有字段的必填性
  - 不要改变 store 的持久化逻辑（已有 persist 配置）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 只是给类型新增两个可选字段
  - **Skills**: []
    - Reason: 不需要特殊技能

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 14
  - **Blocked By**: None

  **References**:
  - `src/renderer/stores/store.ts:4-11` — CorrectionResult 类型定义
  - `src/renderer/stores/store.ts:13-19` — fileInfoStore 定义

  **Acceptance Criteria**:
  - [ ] 新增字段类型正确（optional, boolean/string）
  - [ ] 类型编译通过

  **QA Scenarios**:

  ```
  Scenario: 类型可正常使用
    Tool: Bash
    Preconditions: 类型已更新
    Steps:
      1. tsc --noEmit 检查类型错误
    Expected Result: 无错误
    Evidence: .sisyphus/evidence/task-4-store-type-check.ts
  ```

  **Commit**: YES (groups with 1,2,3,4,5)
  - Message: `feat: extend frontend store with review fields`
  - Files: `src/renderer/stores/store.ts`
  - Pre-commit: `tsc --noEmit`

- [ ] 5. 扩展主进程类型

  **What to do**:
  - 在 src/main/proof.ts 新增 ReviewedCorrection 接口（扩展 ProofreadingCorrection）
  - 或直接在 ProofreadingCorrection 接口新增可选字段 filtered?: boolean, filterReason?: string
  - 保持向后兼容，不要破坏现有逻辑

  **Must NOT do**:
  - 不要修改 proofreadDocument() 的现有返回值结构

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及主进程核心数据结构，需要谨慎
  - **Skills**: []
    - Reason: 不需要特殊技能

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6,7,10
  - **Blocked By**: None

  **References**:
  - `src/main/proof.ts:18-24` — ProofreadingCorrection 类型定义

  **Acceptance Criteria**:
  - [ ] 新增字段类型正确
  - [ ] 类型编译通过
  - [ ] 无破坏性变更

  **QA Scenarios**:

  ```
  Scenario: 类型可正常使用
    Tool: Bash
    Preconditions: 类型已更新
    Steps:
      1. tsc --noEmit
    Expected Result: 无错误
    Evidence: .sisyphus/evidence/task-5-main-type-check.ts
  ```

  **Commit**: YES (groups with 1,2,3,4,5)
  - Message: `feat: extend main process types for review`
  - Files: `src/main/proof.ts`
  - Pre-commit: `tsc --noEmit`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

&gt; 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
&gt;
&gt; **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
&gt; **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -&gt; fix -&gt; re-run -&gt; present again -&gt; wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
      Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat: add review model types and test framework` — shared/\*.ts, package.json, vitest.config.ts, npm test
- **Wave 2**: `feat: implement review logic and UI` — main/proof.ts, ProofSet.vue, npm test
- **Wave 3**: `feat: integrate review to proof flow` — main/ipcHandlers.ts, main/preload.ts, npm test
- **Wave 4**: `feat: show filtered results in UI` — Proof.vue, history.vue, npm test
- **Wave 5**: `test: add review logic and e2e tests` — \*.test.ts, npm test

---

## Success Criteria

### Verification Commands

```bash
npm run lint:fix  # Expected: no errors
tsc --noEmit       # Expected: no errors
npm test           # Expected: all tests pass
```

### Final Checklist

- [ ] 所有 "Must Have" 实现完成
- [ ] 所有 "Must NOT Have" 未出现
- [ ] 所有测试通过
