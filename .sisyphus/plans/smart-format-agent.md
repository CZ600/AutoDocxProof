# 智能格式调整 Agent

## TL;DR

> **Quick Summary**: 在现有格式框架基础上，新增一个智能格式调整 Agent 模块。Agent 分两阶段运行——Analyze（LLM 解析格式描述/参考文档 → SmartFormatSpec）和 Apply（确定性应用格式），支持精细化段落类型识别（区分摘要标题/内容、中英文摘要等），并通过现有 docx-edit API 创建新样式。
> 
> **Deliverables**:
> - 共享常量模块 `src/shared/styleAliases.ts` + `src/shared/chineseFontSize.ts`
> - 智能格式 Agent 核心模块 `src/main/smartFormatAgent.ts`
> - 扩展 `ParagraphFormatRule.match` 支持 `paragraphType` 字段
> - 新增 IPC handler 桥接 Agent
> - FormatClone.vue 新增"智能格式化"Tab
> - TDD 测试文件
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1(共享常量) → Task 3(Agent核心) → Task 5(IPC桥接) → Task 7(UI集成) → F1-F4

---

## Context

### Original Request
用户希望新增一个智能格式调整 Agent，能够基于文字描述或参考文档的格式参数，对文档进行精细化格式调整。核心需求是能够区分特殊段落（摘要标题 vs 摘要内容、中英文摘要、各级标题、关键词等），并支持创建新样式而非仅套用已有样式。

### Interview Summary
**Key Discussions**:
- **输入方式**: 文字描述 + 参考文档混合，两者都支持
- **智能程度**: 规则匹配为主，LLM 辅助解析和模糊判断
- **Agent 形态**: 进程内 TypeScript 模块（非独立进程）
- **LLM 职责**: 解析格式描述文本、识别段落类型、处理模糊情况
- **参考文档**: 用现有 `extractFormatProfile()` 提取，LLM 负责样式→段落类型映射
- **输出**: 默认生成新文档，可选覆盖
- **集成**: 扩展现有 FormatClone.vue，新增 Tab
- **测试**: TDD

**Research Findings**:
- `doc.applyStyleProfile()` 已支持样式创建（Metis 修正：无需自建样式创建逻辑）
- `STYLE_NAME_ALIASES` 在 3 个文件中重复定义，需提取为共享模块
- 现有 `smartFormatApply.ts` 的 `SmartFormatSpec` 三层架构可直接作为 Agent 输出格式
- 现有 `sectionType` 检测无法区分子类型（如 abstract-title vs abstract-content）
- 中文字号映射仅在 LLM prompt 中存在文本描述，无程序化映射

### Metis Review
**Identified Gaps** (addressed):
- 样式创建能力: `applyStyleProfile()` 已支持 → 无需自建
- LLM token 开销: 只发段落元数据（索引、前80字、headingLevel、styleName），不发全文
- 格式冲突: 文字描述优先级高于参考文档（当两者同时提供时）
- LLM 失败回退: 保留启发式回退路径
- 段落类型分类完整性: 所有段落都必须分类，未匹配的标记为 "body/unknown"
- 大文档性能: 段落分类批量处理（每批 20-30 个段落的元数据）
- 运行级样式合并: Agent 使用 `patchStyle`（深合并），不替换整个样式

---

## Work Objectives

### Core Objective
构建一个 SmartFormatAgent TypeScript 模块，接受混合格式输入（文字描述 + 参考文档），通过 LLM 解析为 SmartFormatSpec，精细识别段落类型并应用格式，集成到现有 FormatClone.vue。

### Concrete Deliverables
- `src/shared/styleAliases.ts` — 共享样式名别名映射
- `src/shared/chineseFontSize.ts` — 中文字号 → 半磅值映射
- `src/main/smartFormatAgent.ts` — Agent 核心模块（Analyze + Apply 两阶段）
- `src/main/smartFormatApply.ts` 修改 — 扩展 `ParagraphFormatRule.match` 支持 `paragraphType`
- `src/main/ipcHandlers.ts` 修改 — 新增 `smart-format-analyze` 和 `smart-format-apply` handler
- `src/main/preload.ts` 修改 — 暴露新 API 到渲染进程
- `src/renderer/views/FormatClone.vue` 修改 — 新增"智能格式化"Tab
- `src/__tests__/smartFormatAgent.test.ts` — TDD 测试
- `src/__tests__/fixtures/` — 测试用文档 fixture

### Definition of Done
- [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS
- [ ] Electron 应用启动后，FormatClone.vue 出现"智能格式化"Tab
- [ ] 输入格式描述文本后，Agent 能解析为正确的 SmartFormatSpec
- [ ] 打开测试文档后，Agent 能正确分类段落类型并应用格式
- [ ] 现有"选择参考文档"和"从描述生成"Tab 功能不受影响

### Must Have
- LLM 解析格式描述文本为结构化 SmartFormatSpec
- 精细化段落类型识别（abstract-title, abstract-content, abstract-en-title, abstract-en-content, keywords-title, keywords-body, keywords-en-title, keywords-en-body, chapter-title, section-1-title, section-2-title, section-3-title, body, conclusion-title, conclusion-content, references-title, references-content, toc-title, toc-chapter, toc-other 等）
- 通过 `applyStyleProfile()` 创建新样式
- 参考文档提取 + LLM 样式映射
- 启发式回退（LLM 不可用时）
- 内容不可变性验证（格式调整后文本内容不变）
- 文字描述与参考文档冲突时，文字描述优先

### Must NOT Have (Guardrails)
- 不格式化表格、图片、公式
- 不支持批量多文档处理
- 不支持格式预设/模板库
- 不支持格式预览/对比视图
- 不支持 .doc 旧格式
- 不与校对流程集成
- 不支持格式规则导出/导入
- 不发送段落全文到 LLM（仅元数据）
- 不修改 `formatClone.ts` 或 `formatFromDesc.ts` 的核心逻辑（仅提取共享常量）
- 不改变现有 FormatClone.vue 前两个 Tab 的行为
- 不新建样式创建代码（使用现有 `applyStyleProfile()`）
- 页眉页脚仅通过 pageSettings 处理，不做智能格式化

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest@^1.6.0)
- **Automated tests**: TDD
- **Framework**: vitest
- **Each task**: RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (bun test) — Run tests, check pass/fail
- **IPC Handler**: Use Bash — Direct function call, assert response shape
- **UI**: Use Playwright — Navigate, interact, assert DOM, screenshot

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — shared modules + type extensions):
├── Task 1: Extract shared styleAliases.ts [quick]
├── Task 2: Create chineseFontSize.ts mapping [quick]
├── Task 3: Extend ParagraphFormatRule.match with paragraphType [quick]
└── Task 4: Verify applyStyleProfile() style creation (integration test) [quick]

Wave 2 (Core Agent — LLM integration + classification):
├── Task 5: Format description parser (LLM → SmartFormatSpec) [deep]
├── Task 6: Paragraph metadata extractor [quick]
├── Task 7: Paragraph classifier (heuristic baseline) [unspecified-high]
├── Task 8: Paragraph classifier (LLM-enhanced) [deep]
└── Task 9: Reference doc profile mapper (LLM → paragraph type mapping) [deep]

Wave 3 (Integration — Agent orchestration + IPC + Apply):
├── Task 10: SmartFormatAgent orchestrator (Analyze + Apply) [deep]
├── Task 11: IPC handlers + preload bridge [quick]
└── Task 12: FormatClone.vue "智能格式化" Tab [visual-engineering]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: Task 1 → Task 3 → Task 5 → Task 10 → Task 11 → Task 12 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 5, 7, 9 | 1 |
| 2 | — | 5 | 1 |
| 3 | 1 | 7, 8, 10 | 1 |
| 4 | 1 | 10 | 1 |
| 5 | 1, 2 | 10 | 2 |
| 6 | — | 8 | 2 |
| 7 | 1, 3 | 8 | 2 |
| 8 | 6, 7 | 10 | 2 |
| 9 | 1 | 10 | 2 |
| 10 | 3, 4, 5, 8, 9 | 11 | 3 |
| 11 | 10 | 12 | 3 |
| 12 | 11 | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks — T1-T4 → `quick`
- **Wave 2**: 5 tasks — T5 → `deep`, T6 → `quick`, T7 → `unspecified-high`, T8 → `deep`, T9 → `deep`
- **Wave 3**: 3 tasks — T10 → `deep`, T11 → `quick`, T12 → `visual-engineering`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Extract shared styleAliases.ts

  **What to do**:
  - Create `src/shared/styleAliases.ts` with the `STYLE_NAME_ALIASES` constant and `styleNameMatches()` function extracted from `smartFormatApply.ts:86-109,116-140`
  - Update `smartFormatApply.ts` to import from `src/shared/styleAliases.ts` instead of defining inline
  - Update `formatClone.ts:7-30,35-55` to import from shared module
  - Update `formatFromDesc.ts:21-44,50-80` to import from shared module
  - Write test `src/__tests__/styleAliases.test.ts` verifying: exact match, case-insensitive, whitespace-stripped, alias table lookup

  **Must NOT do**:
  - Do not change any matching logic or add new aliases
  - Do not modify any behavior — pure extraction refactor

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5, 7, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/main/smartFormatApply.ts:86-109` — `STYLE_NAME_ALIASES` definition (primary source to extract)
  - `src/main/smartFormatApply.ts:116-140` — `styleNameMatches()` function (extract together)
  - `src/main/formatClone.ts:7-30` — Duplicate aliases (update to import)
  - `src/main/formatClone.ts:35-55` — Duplicate `styleNameMatches()` (remove, use shared)
  - `src/main/formatFromDesc.ts:21-44` — Duplicate aliases (update to import)

  **Why Each Reference Matters**:
  - `smartFormatApply.ts:86-109` is the most complete alias definition — use as canonical source
  - All three files have identical logic that must be unified to prevent future drift

  **Acceptance Criteria**:

  **If TDD (tests enabled):**
  - [ ] Test file created: `src/__tests__/styleAliases.test.ts`
  - [ ] `bun test src/__tests__/styleAliases.test.ts` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Exact style name match
    Tool: Bash (bun test)
    Preconditions: styleAliases.ts imported
    Steps:
      1. Run test: `styleNameMatches('heading 1', '标题 1')` → true
      2. Run test: `styleNameMatches('normal', 'Normal')` → true
      3. Run test: `styleNameMatches('heading 1', 'Heading 1')` → true
    Expected Result: All 3 assertions pass
    Evidence: .sisyphus/evidence/task-1-exact-match.txt

  Scenario: Non-match returns false
    Tool: Bash (bun test)
    Preconditions: styleAliases.ts imported
    Steps:
      1. Run test: `styleNameMatches('heading 1', 'SomeRandomName')` → false
      2. Run test: `styleNameMatches('normal', '')` → false
    Expected Result: Both assertions pass
    Evidence: .sisyphus/evidence/task-1-non-match.txt

  Scenario: Import verification — no duplicate definitions
    Tool: Bash (grep)
    Preconditions: Refactoring complete
    Steps:
      1. `grep -r "STYLE_NAME_ALIASES.*Record" src/main/` — should only find import statements, no definitions
      2. `grep -r "styleNameMatches" src/main/` — should only find import statements and usage, no function definitions
    Expected Result: Zero duplicate definitions in src/main/ files
    Evidence: .sisyphus/evidence/task-1-no-duplicates.txt
  ```

  **Commit**: YES
  - Message: `refactor(shared): extract STYLE_NAME_ALIASES to shared module`
  - Files: `src/shared/styleAliases.ts`, `src/main/smartFormatApply.ts`, `src/main/formatClone.ts`, `src/main/formatFromDesc.ts`, `src/__tests__/styleAliases.test.ts`
  - Pre-commit: `bun test src/__tests__/styleAliases.test.ts`

- [x] 2. Create chineseFontSize.ts mapping

  **What to do**:
  - Create `src/shared/chineseFontSize.ts` with programmatic mapping of Chinese font size names to half-point values
  - Mapping: 初号=84, 小初=72, 一号=52, 小一=48, 二号=44, 小二=36, 三号=32, 小三=30, 四号=28, 小四=24, 五号=21, 小五=18, 六号=15, 小六=13, 七号=12, 八号=10
  - Export `CHINESE_FONT_SIZE_MAP: Record<string, string>` (values as half-point strings for docx-edit)
  - Export `resolveFontSize(input: string): string` that accepts Chinese name, pt value (e.g. "14pt"), or half-point value and returns half-point string
  - Export `FONT_FAMILY_MAP: Record<string, {ascii: string, eastAsia: string, hAnsi: string}>` for common Chinese fonts: 黑体→SimHei, 宋体→SimSun, 楷体→KaiTi, 仿宋→FangSong
  - Write test `src/__tests__/chineseFontSize.test.ts`

  **Must NOT do**:
  - Do not add fonts or sizes not listed above
  - Do not create complex parsing logic — simple lookup is sufficient

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/main/formatFromDesc.ts:92-155` — Existing system prompt that contains Chinese font size descriptions in text form (extract programmatic version)

  **External References**:
  - Chinese font size standard: 二号=22pt=44hp, 小四号=12pt=24hp, 五号=10.5pt=21hp

  **Why Each Reference Matters**:
  - `formatFromDesc.ts` prompt contains the authoritative text mapping — convert to programmatic lookup

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Test file created: `src/__tests__/chineseFontSize.test.ts`
  - [ ] `bun test src/__tests__/chineseFontSize.test.ts` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Chinese font size name to half-points
    Tool: Bash (bun test)
    Steps:
      1. `CHINESE_FONT_SIZE_MAP['小四']` === '24'
      2. `CHINESE_FONT_SIZE_MAP['二号']` === '44'
      3. `CHINESE_FONT_SIZE_MAP['五号']` === '21'
    Expected Result: All 3 assertions pass
    Evidence: .sisyphus/evidence/task-2-font-size.txt

  Scenario: resolveFontSize handles multiple input formats
    Tool: Bash (bun test)
    Steps:
      1. `resolveFontSize('小四号')` === '24'
      2. `resolveFontSize('14pt')` === '28'
      3. `resolveFontSize('28')` === '28' (already half-points)
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-2-resolve.txt

  Scenario: Font family mapping completeness
    Tool: Bash (bun test)
    Steps:
      1. `FONT_FAMILY_MAP['黑体'].eastAsia` === '黑体'
      2. `FONT_FAMILY_MAP['宋体'].eastAsia` === '宋体'
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-2-font-family.txt
  ```

  **Commit**: YES
  - Message: `feat(shared): add Chinese font size mapping utility`
  - Files: `src/shared/chineseFontSize.ts`, `src/__tests__/chineseFontSize.test.ts`
  - Pre-commit: `bun test src/__tests__/chineseFontSize.test.ts`

- [x] 3. Extend ParagraphFormatRule.match with paragraphType

  **What to do**:
  - Add `paragraphType?: string` field to `ParagraphFormatRule.match` interface in `smartFormatApply.ts:45`
  - Add new type `ParagraphType` = union of all supported paragraph types: `'paper-title' | 'chapter-title' | 'section-1-title' | 'section-2-title' | 'section-3-title' | 'item-title' | 'body' | 'abstract-cn-title' | 'abstract-cn-content' | 'abstract-en-title' | 'abstract-en-content' | 'keywords-cn-title' | 'keywords-cn-body' | 'keywords-en-title' | 'keywords-en-body' | 'conclusion-title' | 'conclusion-content' | 'references-title' | 'references-content' | 'toc-title' | 'toc-chapter' | 'toc-other' | 'acknowledgement-title' | 'appendix-title'`
  - Update `paragraphMatchesRule()` function to check `paragraphType` match: compare against paragraph's classified type stored in a per-paragraph type map passed as new parameter
  - Update `applySmartFormat()` to accept optional `paragraphTypeMap?: Map<number, string>` parameter
  - Write test: `src/__tests__/smartFormatApply.test.ts` with a fixture docx, applying rules that match by `paragraphType`

  **Must NOT do**:
  - Do not change existing match behavior when `paragraphType` is not provided (backward compatible)
  - Do not remove or change any existing match criteria

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7, 8, 10
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/main/smartFormatApply.ts:43-68` — `ParagraphFormatRule` interface (extend `match` field at line 45)
  - `src/main/smartFormatApply.ts:184-236` — `paragraphMatchesSectionType()` (reference for how matching works)
  - `src/main/smartFormatApply.ts:380-470` — `paragraphMatchesRule()` (add paragraphType check here)

  **Why Each Reference Matters**:
  - Line 45 is the exact interface to extend
  - Line 380 is where match logic lives — add paragraphType comparison
  - Line 184 shows existing pattern for type-based matching

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Test file created: `src/__tests__/smartFormatApply.test.ts`
  - [ ] `bun test src/__tests__/smartFormatApply.test.ts` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: paragraphType match works
    Tool: Bash (bun test)
    Preconditions: Fixture docx with known paragraph types loaded
    Steps:
      1. Create rule: `{ match: { paragraphType: 'abstract-cn-title' }, format: { runStyle: { fontSize: '36' } } }`
      2. Apply with paragraphTypeMap where paragraph 3 is 'abstract-cn-title'
      3. Assert paragraph 3 got fontSize '36'
      4. Assert other paragraphs unchanged
    Expected Result: Only paragraph 3 modified
    Evidence: .sisyphus/evidence/task-3-paragraph-type.txt

  Scenario: Backward compatibility — existing rules still work
    Tool: Bash (bun test)
    Steps:
      1. Apply SmartFormatSpec with only headingLevel/textPattern/sectionType rules (no paragraphType)
      2. Assert behavior identical to before the change
    Expected Result: All existing match criteria work unchanged
    Evidence: .sisyphus/evidence/task-3-backward-compat.txt
  ```

  **Commit**: YES
  - Message: `feat(format): extend ParagraphFormatRule with paragraphType`
  - Files: `src/main/smartFormatApply.ts`, `src/__tests__/smartFormatApply.test.ts`
  - Pre-commit: `bun test src/__tests__/smartFormatApply.test.ts`

- [x] 4. Verify applyStyleProfile() style creation (integration test)

  **What to do**:
  - Create `src/__tests__/styleCreation.test.ts`
  - Create a minimal fixture docx at `src/__tests__/fixtures/minimal.docx` (simple document with a few paragraphs)
  - Test: load docx, build a StyleProfile with a novel styleId (e.g. `"abstractTitle"`), call `doc.applyStyleProfile()`, save, reload, verify the new style exists in `doc.getStyleProfile()`
  - Test: verify style properties (name, type, basedOn, paragraphStyle, runStyle) are preserved
  - Test: verify paragraph using the new styleId gets correct formatting
  - This test validates the Metis finding that `applyStyleProfile()` already creates styles

  **Must NOT do**:
  - Do not create any style creation utility — this is a verification test only
  - Do not modify any existing code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:

  **API/Type References**:
  - `src/main/smartFormatApply.ts:5-19` — `SmartFormatSpec.styleProfile` structure (the exact format to pass)
  - `src/main/formatClone.ts:54-57` — `extractFormatProfile()` shows how StyleProfile looks

  **Why Each Reference Matters**:
  - `SmartFormatSpec.styleProfile` defines the shape we need to create new styles with
  - `formatClone.ts` shows real usage of `applyStyleProfile()`

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Test file created: `src/__tests__/styleCreation.test.ts`
  - [ ] Fixture docx created: `src/__tests__/fixtures/minimal.docx`
  - [ ] `bun test src/__tests__/styleCreation.test.ts` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: New style created via applyStyleProfile
    Tool: Bash (bun test)
    Preconditions: minimal.docx exists
    Steps:
      1. loadDocx('fixtures/minimal.docx')
      2. Call doc.applyStyleProfile({ styles: { 'abstractTitle': { name: 'Abstract Title', type: 'paragraph', runStyle: { fontSize: '36', fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } } } } })
      3. Save to temp file
      4. Reload saved file
      5. Call doc.getStyleProfile()
      6. Assert profile.styles['abstractTitle'] exists with correct name and runStyle
    Expected Result: New style exists in styles.xml after save+reload
    Evidence: .sisyphus/evidence/task-4-style-creation.txt

  Scenario: Style properties preserved correctly
    Tool: Bash (bun test)
    Steps:
      1. Create style with fontSize '36' and fontFamily eastAsia '黑体'
      2. Apply, save, reload
      3. Assert fontSize === '36' and fontFamily.eastAsia === '黑体'
    Expected Result: Properties match exactly
    Evidence: .sisyphus/evidence/task-4-properties.txt
  ```

  **Commit**: YES
  - Message: `test(format): verify applyStyleProfile creates new styles`
  - Files: `src/__tests__/styleCreation.test.ts`, `src/__tests__/fixtures/minimal.docx`
  - Pre-commit: `bun test src/__tests__/styleCreation.test.ts`

- [x] 5. Format description parser (LLM → SmartFormatSpec)

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create `parseFormatDescription(description: string, apiConfig: apiSettings): Promise<SmartFormatSpec>` function
  - Design a system prompt that instructs LLM to parse format description text into a `SmartFormatSpec` JSON with:
    - `styleProfile.styles` — one style per paragraph type (use `ParagraphType` union values as styleId)
    - `paragraphRules` — one rule per paragraph type, matching by `paragraphType` field
    - `pageSettings` — if description mentions page numbering, headers, footers
  - Use `resolveFontSize()` from `chineseFontSize.ts` in post-processing to validate/fix LLM font size output
  - Use `FONT_FAMILY_MAP` to validate font family output
  - Use `getModelResponse()` from `chat.ts` for LLM call (follow `formatFromDesc.ts:160-200` pattern)
  - Write test with mocked LLM response (mock `getModelResponse` to return controlled JSON)

  **Must NOT do**:
  - Do not send document content to LLM — only the format description text
  - Do not modify `formatFromDesc.ts`
  - Do not hardcode format rules — all rules come from LLM output

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Task 1, Task 2

  **References**:

  **Pattern References**:
  - `src/main/formatFromDesc.ts:92-200` — LLM system prompt design, call pattern, JSON extraction, and error handling (follow this exact pattern for the new parser)
  - `src/main/formatFromDesc.ts:210-260` — `normalizeStyleProperties()` — reuse for fixing LLM output

  **API/Type References**:
  - `src/main/smartFormatApply.ts:5-41` — `SmartFormatSpec` (this is the output format)
  - `src/main/smartFormatApply.ts:43-68` — `ParagraphFormatRule` (for paragraphRules)
  - `src/main/chat.ts` — `getModelResponse()` API signature
  - `src/main/ipcHandlers.ts:42-49` — `apiSettings` interface

  **Why Each Reference Matters**:
  - `formatFromDesc.ts` is the exact pattern to follow for LLM-based format generation
  - `SmartFormatSpec` is the output contract
  - `getModelResponse` is the unified LLM call function

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Test file created/updated: `src/__tests__/smartFormatAgent.test.ts`
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (parseFormatDescription tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Parse sample format description into SmartFormatSpec
    Tool: Bash (bun test)
    Preconditions: Mock getModelResponse returning valid JSON
    Steps:
      1. Call parseFormatDescription("论文题目 黑体 二号\n正文 宋体 小四号\n摘要标题 黑体 小二号")
      2. Assert result.styleProfile.styles contains entries for 'paper-title', 'body', 'abstract-cn-title'
      3. Assert paper-title style has runStyle.fontSize '44' (二号=44 half-points)
      4. Assert paper-title style has runStyle.fontFamily.eastAsia '黑体'
      5. Assert result.paragraphRules has 3 rules with matching paragraphType values
    Expected Result: All assertions pass
    Evidence: .sisyphus/evidence/task-5-parse-desc.txt

  Scenario: Handle invalid LLM JSON output gracefully
    Tool: Bash (bun test)
    Preconditions: Mock getModelResponse returning malformed JSON
    Steps:
      1. Call parseFormatDescription("some text")
      2. Assert function throws/rejects with descriptive error
      3. Assert error message mentions "parse" or "JSON"
    Expected Result: Error thrown, not silent failure
    Evidence: .sisyphus/evidence/task-5-invalid-json.txt

  Scenario: Font size normalization
    Tool: Bash (bun test)
    Steps:
      1. Mock LLM returning fontSize as "小四号" (text) instead of half-points
      2. Assert post-processing converts to "24"
    Expected Result: Font size corrected to half-points
    Evidence: .sisyphus/evidence/task-5-font-normalize.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add format description parser`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`
  - Pre-commit: `bun test src/__tests__/smartFormatAgent.test.ts`

- [x] 6. Paragraph metadata extractor

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create `extractParagraphMetadata(paragraphs: any[]): ParagraphMetadata[]` function
  - `ParagraphMetadata` interface: `{ index: number, firstChars: string, headingLevel: number | null, styleId: string, text: string, isBold: boolean, sectionType: string | null }`
  - `firstChars`: first 80 characters of paragraph text (for LLM classification, not full text)
  - `sectionType`: use existing `buildSectionRanges()` + `paragraphMatchesSectionType()` from `smartFormatApply.ts` to pre-classify
  - This function prepares data for both heuristic and LLM classification — no LLM call here
  - Write test with a real docx fixture

  **Must NOT do**:
  - Do not send this data to LLM in this task — just prepare the data structure
  - Do not truncate text for storage — only truncate for the `firstChars` field used in LLM prompts

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 7-9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/main/smartFormatApply.ts:249-295` — `buildSectionRanges()` (reuse for section pre-classification)
  - `src/main/smartFormatApply.ts:184-236` — `paragraphMatchesSectionType()` (reuse)
  - `src/main/proof.ts:350-398` — `extractDocxEditHeadings()` (reference for paragraph iteration pattern)

  **Why Each Reference Matters**:
  - `buildSectionRanges` and `paragraphMatchesSectionType` provide existing heuristic classification
  - `extractDocxEditHeadings` shows how to iterate paragraphs and extract metadata

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests in `src/__tests__/smartFormatAgent.test.ts` updated
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (extractParagraphMetadata tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Extract metadata from fixture document
    Tool: Bash (bun test)
    Preconditions: Fixture docx with heading, abstract, body paragraphs
    Steps:
      1. Load fixture docx, get paragraphs
      2. Call extractParagraphMetadata(paragraphs)
      3. Assert result length === paragraph count
      4. Assert heading paragraphs have headingLevel > 0
      5. Assert firstChars length <= 80 for all entries
      6. Assert abstract section paragraphs have sectionType 'abstract'
    Expected Result: Metadata extracted correctly for all paragraphs
    Evidence: .sisyphus/evidence/task-6-metadata.txt

  Scenario: Handle empty document
    Tool: Bash (bun test)
    Steps:
      1. Call extractParagraphMetadata([])
      2. Assert result is empty array
    Expected Result: Empty array returned, no crash
    Evidence: .sisyphus/evidence/task-6-empty.txt
  ```

  **Commit**: YES (groups with Task 5 or 8)
  - Message: `feat(agent): add paragraph metadata extractor`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`

- [x] 7. Paragraph classifier — heuristic baseline

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create `classifyParagraphsHeuristic(metadata: ParagraphMetadata[]): Map<number, ParagraphType>` function
  - Implement rule-based classification logic:
    - **paper-title**: first paragraph, heading level 0 or null, short text (<50 chars), no specific heading keyword
    - **chapter-title**: headingLevel === 1, or text matches `/^第[一二三四五六七八九十\d]+章/`
    - **section-1-title**: headingLevel === 2
    - **section-2-title**: headingLevel === 3
    - **section-3-title**: headingLevel === 4
    - **item-title**: text starts with `（一）`, `（二）`, `(一)`, `(1)` etc. + bold
    - **body**: no heading, not in special section, not bold → default
    - **abstract-cn-title**: text matches `/^摘\s*要$/` exactly (not "摘要:" or "摘要内容")
    - **abstract-cn-content**: sectionType 'abstract' AND text contains Chinese characters AND not the title
    - **abstract-en-title**: text matches `/^abstract$/i`
    - **abstract-en-content**: sectionType 'abstract' AND text is primarily Latin characters AND not the title
    - **keywords-cn-title**: text matches `/^关键词/`
    - **keywords-cn-body**: text after keywords-cn-title, contains Chinese
    - **keywords-en-title**: text matches `/^keywords/i`
    - **keywords-en-body**: text after keywords-en-title, primarily Latin
    - **conclusion-title/reference-title/toc-title/etc.**: similar patterns
  - Use position context (what comes before/after) to refine classification
  - Write comprehensive test with a fixture document that has all paragraph types

  **Must NOT do**:
  - Do not make any LLM calls — pure heuristic logic
  - Do not add new section types beyond what's listed

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6, 8, 9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8
  - **Blocked By**: Task 1, Task 3

  **References**:

  **Pattern References**:
  - `src/main/smartFormatApply.ts:184-236` — `paragraphMatchesSectionType()` (extend these patterns)
  - `src/main/smartFormatApply.ts:249-295` — `buildSectionRanges()` (use for position context)
  - `src/main/proof.ts:309-332` — `isLikelyTitle()`, `getHeadingLevel()` (reference for heading detection)

  **Why Each Reference Matters**:
  - These are the existing heuristic patterns — extend, don't reinvent

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests in `src/__tests__/smartFormatAgent.test.ts` updated
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (classifyParagraphsHeuristic tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Classify academic paper paragraphs
    Tool: Bash (bun test)
    Preconditions: Fixture docx with title, abstract-cn, abstract-en, keywords, chapters, sections, body, conclusion, references
    Steps:
      1. Load fixture, extract metadata, classify
      2. Assert paragraph 0 classified as 'paper-title'
      3. Assert "摘要" paragraph classified as 'abstract-cn-title'
      4. Assert abstract content classified as 'abstract-cn-content'
      5. Assert "Abstract" paragraph classified as 'abstract-en-title'
      6. Assert chapter heading classified as 'chapter-title'
      7. Assert body text classified as 'body'
    Expected Result: ≥85% accuracy on known fixture
    Evidence: .sisyphus/evidence/task-7-heuristic-classify.txt

  Scenario: Fallback to 'body' for unrecognized paragraphs
    Tool: Bash (bun test)
    Steps:
      1. Classify metadata with unrecognized paragraph (random text, no heading)
      2. Assert classification is 'body'
    Expected Result: Default to 'body', never null/undefined
    Evidence: .sisyphus/evidence/task-7-fallback.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(agent): add heuristic paragraph classifier`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`

- [x] 8. Paragraph classifier — LLM-enhanced

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create `classifyParagraphsWithLLM(metadata: ParagraphMetadata[], apiConfig: apiSettings): Promise<Map<number, ParagraphType>>` function
  - Design a system prompt that instructs LLM to classify each paragraph's metadata into one of the `ParagraphType` values
  - **Batch strategy**: Send metadata in batches of 20-30 paragraphs per LLM call to control token usage
  - LLM receives: `{ index, firstChars, headingLevel, styleId, isBold, sectionType, context: [prev 2 paragraph types, next 2 firstChars] }`
  - LLM returns: `{ classifications: [{ index: number, type: ParagraphType, confidence: number }] }`
  - Merge with heuristic baseline: if LLM confidence < 0.7, use heuristic result instead
  - If LLM call fails/times out, fall back to heuristic-only result (from Task 7)
  - Write test with mocked LLM responses

  **Must NOT do**:
  - Do not send full paragraph text to LLM — only metadata
  - Do not make LLM calls for paragraphs the heuristic is confident about (skip if heuristic confidence is high)
  - Do not skip the heuristic fallback path

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Task 6, Task 7

  **References**:

  **Pattern References**:
  - `src/main/formatFromDesc.ts:160-200` — LLM call pattern with `getModelResponse()` (follow this)
  - `src/main/smartFormatApply.ts:184-236` — Heuristic patterns to fall back to

  **API/Type References**:
  - `src/main/chat.ts` — `getModelResponse()` signature

  **Why Each Reference Matters**:
  - `formatFromDesc.ts` shows the exact pattern for calling LLM and parsing JSON response
  - `smartFormatApply.ts` heuristics are the fallback baseline

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests in `src/__tests__/smartFormatAgent.test.ts` updated
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (classifyParagraphsWithLLM tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: LLM classification with batch processing
    Tool: Bash (bun test)
    Preconditions: Mock getModelResponse returning classifications
    Steps:
      1. Create 50 paragraphs metadata
      2. Call classifyParagraphsWithLLM
      3. Assert getModelResponse called ceil(50/25) = 2 times (batched)
      4. Assert result has 50 entries
    Expected Result: Batched correctly, all paragraphs classified
    Evidence: .sisyphus/evidence/task-8-llm-batch.txt

  Scenario: LLM fallback to heuristic on failure
    Tool: Bash (bun test)
    Preconditions: Mock getModelResponse to throw error
    Steps:
      1. Call classifyParagraphsWithLLM
      2. Assert result equals heuristic-only classification
      3. Assert no error thrown
    Expected Result: Graceful fallback, heuristic results returned
    Evidence: .sisyphus/evidence/task-8-llm-fallback.txt

  Scenario: Low confidence LLM result uses heuristic
    Tool: Bash (bun test)
    Preconditions: Mock LLM returning confidence 0.3 for some paragraphs
    Steps:
      1. Call classifyParagraphsWithLLM
      2. For paragraphs with LLM confidence < 0.7, assert heuristic classification used
    Expected Result: Hybrid result — high confidence LLM, low confidence heuristic
    Evidence: .sisyphus/evidence/task-8-hybrid.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add LLM-enhanced paragraph classifier`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`

- [x] 9. Reference doc profile mapper (LLM → paragraph type mapping)

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create `mapRefProfileToRules(refProfile: any, apiConfig: apiSettings): Promise<SmartFormatSpec>` function
  - Steps:
    1. Accept `StyleProfile` from `extractFormatProfile()` (existing code)
    2. Extract style names and their properties from the profile
    3. Send style list + properties to LLM with system prompt asking to map each style to a `ParagraphType`
    4. LLM returns: `{ mappings: [{ styleId: string, paragraphType: ParagraphType }] }`
    5. Convert mappings to `SmartFormatSpec`: for each mapping, create a style entry and paragraphRule
  - Write test with a mocked reference profile and LLM response

  **Must NOT do**:
  - Do not modify `extractFormatProfile()` or `formatClone.ts`
  - Do not extract the reference doc format with LLM — use existing `extractFormatProfile()` code only

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/main/formatClone.ts:54-57` — `extractFormatProfile()` (returns the profile to map)
  - `src/main/formatClone.ts:60-118` — `cloneFormatWithProfile()` (shows how profile is used)

  **Why Each Reference Matters**:
  - `extractFormatProfile` is the input — understand its output shape
  - `cloneFormatWithProfile` shows how profiles are currently applied — we're doing it differently (via paragraph type mapping)

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests in `src/__tests__/smartFormatAgent.test.ts` updated
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (mapRefProfileToRules tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Map reference profile styles to paragraph types
    Tool: Bash (bun test)
    Preconditions: Mock LLM returning style→paragraphType mappings
    Steps:
      1. Provide mock profile with styles: 'heading 1' (黑体 小二号), 'Normal' (宋体 小四号), 'TOC Heading' (黑体 小二号)
      2. Call mapRefProfileToRules
      3. Assert 'heading 1' mapped to 'chapter-title'
      4. Assert 'Normal' mapped to 'body'
      5. Assert result.styleProfile.styles has entries for mapped types
      6. Assert result.paragraphRules has matching paragraphType rules
    Expected Result: Styles correctly mapped to paragraph types
    Evidence: .sisyphus/evidence/task-9-ref-mapping.txt

  Scenario: Handle LLM returning unknown paragraph type
    Tool: Bash (bun test)
    Preconditions: Mock LLM returning paragraphType 'unknown-type'
    Steps:
      1. Call mapRefProfileToRules
      2. Assert unknown types are skipped or mapped to 'body'
    Expected Result: No crash, graceful handling
    Evidence: .sisyphus/evidence/task-9-unknown-type.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add reference doc profile mapper`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`

- [x] 10. SmartFormatAgent orchestrator (Analyze + Apply)

  **What to do**:
  - In `src/main/smartFormatAgent.ts`, create the main `SmartFormatAgent` class orchestrating the full pipeline:
    ```
    class SmartFormatAgent {
      // Phase 1: Analyze — produce SmartFormatSpec
      async analyze(input: {
        description?: string,          // 格式描述文本
        refFilePath?: string,          // 参考文档路径
        apiConfig: apiSettings
      }): Promise<{ spec: SmartFormatSpec, classification: Map<number, ParagraphType>, tokenUsage: number }>

      // Phase 2: Apply — deterministic formatting
      async apply(inputPath: string, outputPath: string, spec: SmartFormatSpec, classification: Map<number, ParagraphType>): Promise<SmartFormatResult>
    }
    ```
  - `analyze()` flow:
    1. If `description` provided → call `parseFormatDescription()`
    2. If `refFilePath` provided → call `extractFormatProfile()` + `mapRefProfileToRules()`
    3. If both → merge specs (description takes priority for conflicting paragraph types)
    4. Load target document, extract metadata, classify paragraphs (heuristic + LLM)
    5. Return combined spec + classification map
  - `apply()` flow:
    1. Load target doc via `loadDocx()`
    2. Call `applySmartFormat(inputPath, outputPath, spec)` with the generated spec and `paragraphTypeMap`
    3. Verify content immutability: compare paragraph text before/after
    4. Return result with per-paragraph status
  - Add progress callback support (follow `ProofreadProgressPayload` pattern)
  - Write integration test: full pipeline with fixture docx, mocked LLM

  **Must NOT do**:
  - Do not call LLM in `apply()` phase — it's deterministic only
  - Do not skip content immutability verification
  - Do not implement batch document processing

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 3, 4, 5, 8, 9)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 11
  - **Blocked By**: Task 3, Task 4, Task 5, Task 8, Task 9

  **References**:

  **Pattern References**:
  - `src/main/smartFormatApply.ts:478-592` — `applySmartFormat()` main function (this is what we're wrapping)
  - `src/main/proof.ts` — `proofreadDocument()` orchestrator pattern (reference for progress reporting, concurrent processing)

  **API/Type References**:
  - `src/main/smartFormatApply.ts:5-41` — `SmartFormatSpec` (orchestrator output)
  - `src/main/smartFormatApply.ts:70-78` — `SmartFormatResult` (orchestrator return type)
  - `src/shared/proofreadProgress.ts` — `ProofreadProgressPayload` (follow for progress events)

  **Why Each Reference Matters**:
  - `applySmartFormat` is the Apply phase — orchestrator calls it
  - `proofreadDocument` shows how to structure a multi-phase operation with progress reporting

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests in `src/__tests__/smartFormatAgent.test.ts` updated
  - [ ] `bun test src/__tests__/smartFormatAgent.test.ts` → PASS (full pipeline tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full analyze+apply pipeline with description input
    Tool: Bash (bun test)
    Preconditions: Fixture docx, mocked LLM returning valid spec
    Steps:
      1. Create SmartFormatAgent
      2. Call analyze({ description: "论文题目 黑体 二号\n正文 宋体 小四号", apiConfig })
      3. Assert spec has paragraphRules for 'paper-title' and 'body'
      4. Assert classification map has entries for all paragraphs
      5. Call apply(inputPath, outputPath, spec, classification)
      6. Assert result.success === true
      7. Assert result.appliedParagraphs > 0
      8. Reload output, verify paragraph text content unchanged
    Expected Result: Full pipeline completes, formatting applied, content preserved
    Evidence: .sisyphus/evidence/task-10-full-pipeline.txt

  Scenario: Content immutability after formatting
    Tool: Bash (bun test)
    Steps:
      1. Save all paragraph texts before apply
      2. Run full pipeline
      3. Reload output, compare all paragraph texts
      4. Assert 100% text match
    Expected Result: Zero text content changes
    Evidence: .sisyphus/evidence/task-10-immutability.txt

  Scenario: Both description and reference doc provided (merge)
    Tool: Bash (bun test)
    Steps:
      1. Call analyze with both description and refFilePath
      2. Assert description rules override conflicting reference rules
      3. Assert non-conflicting reference rules are preserved
    Expected Result: Merged spec with description priority
    Evidence: .sisyphus/evidence/task-10-merge.txt

  Scenario: LLM unavailable — heuristic fallback
    Tool: Bash (bun test)
    Preconditions: Mock getModelResponse to throw
    Steps:
      1. Call analyze
      2. Assert classification uses heuristic-only results
      3. Assert spec still generated (from description/refDoc)
      4. Assert apply succeeds
    Expected Result: Graceful degradation, heuristic classification used
    Evidence: .sisyphus/evidence/task-10-heuristic-fallback.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add SmartFormatAgent orchestrator`
  - Files: `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts`
  - Pre-commit: `bun test src/__tests__/smartFormatAgent.test.ts`

- [x] 11. IPC handlers + preload bridge

  **What to do**:
  - In `src/main/ipcHandlers.ts`, add two new IPC handlers:
    - `'smart-format-analyze'`: accepts `{ description?, refFilePath?, apiConfig }`, calls `agent.analyze()`, returns `{ spec, classification: Array<[number, string]>, tokenUsage }`
    - `'smart-format-apply'`: accepts `{ inputPath, outputPath, spec, classification, apiConfig? }`, calls `agent.apply()`, returns `SmartFormatResult`
    - `'smart-format-cancel'`: cancels in-progress analysis
  - In `src/main/preload.ts`, expose:
    - `smartFormatAnalyze(params)` → `ipcRenderer.invoke('smart-format-analyze', params)`
    - `smartFormatApply(params)` → `ipcRenderer.invoke('smart-format-apply', params)`
  - Follow existing handler patterns exactly (see `get-format-profile`, `format-from-description` handlers)
  - Write test verifying handler registration and response shape

  **Must NOT do**:
  - Do not modify existing IPC handlers
  - Do not change preload's existing API surface

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 10)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Task 10

  **References**:

  **Pattern References**:
  - `src/main/ipcHandlers.ts` — search for `'get-format-profile'` and `'format-from-description'` handlers (follow exact pattern)
  - `src/main/preload.ts` — search for `getFormatProfile` and `formatFromDescription` (follow exact pattern)

  **Why Each Reference Matters**:
  - These are the exact patterns to replicate for the new handlers

  **Acceptance Criteria**:

  **If TDD:**
  - [ ] Tests for IPC handler registration
  - [ ] `bun test` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: IPC handler responds with correct shape
    Tool: Bash (bun test)
    Preconditions: Mock SmartFormatAgent
    Steps:
      1. Call smart-format-analyze handler with test params
      2. Assert response has { spec, classification, tokenUsage }
      3. Call smart-format-apply handler with test params
      4. Assert response has { success, appliedStyles, appliedParagraphs }
    Expected Result: Both handlers return correct response shapes
    Evidence: .sisyphus/evidence/task-11-ipc.txt

  Scenario: Preload API exists and callable
    Tool: Bash (grep)
    Steps:
      1. `grep "smartFormatAnalyze" src/main/preload.ts` — found
      2. `grep "smartFormatApply" src/main/preload.ts` — found
    Expected Result: Both APIs exposed in preload
    Evidence: .sisyphus/evidence/task-11-preload.txt
  ```

  **Commit**: YES
  - Message: `feat(ipc): add smart-format IPC handlers`
  - Files: `src/main/ipcHandlers.ts`, `src/main/preload.ts`
  - Pre-commit: `bun test`

- [x] 12. FormatClone.vue "智能格式化" Tab

  **What to do**:
  - In `src/renderer/views/FormatClone.vue`, add a third mode tab "智能格式化"
  - UI layout for the new tab:
    - Textarea for format description input (placeholder: "输入格式描述，如：论文题目 黑体 二号\n正文 宋体 小四号...")
    - Optional: reference document selector button (reuse existing file picker pattern)
    - "开始分析" button — calls `window.electronAPI.smartFormatAnalyze()`
    - Progress display during analysis
    - Results panel: show classified paragraph types with their assigned formatting (collapsible sections, reuse existing collapse pattern)
    - Per-item editing: allow user to adjust formatting parameters before applying (reuse existing editing pattern)
    - "应用格式" button — calls `window.electronAPI.smartFormatApply()`
    - Output option: "导出为新文件" (default) / "覆盖原文件" toggle
  - The existing two tabs ("选择参考文档" and "从描述生成") MUST remain fully functional

  **Must NOT do**:
  - Do not modify any existing tab's functionality or template
  - Do not change existing event handlers or data properties
  - Do not add complex animations or transitions

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 11)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Task 11

  **References**:

  **Pattern References**:
  - `src/renderer/views/FormatClone.vue:1-100` — Existing tab structure and mode switching (replicate pattern)
  - `src/renderer/views/FormatClone.vue:100-300` — Format items display with collapse panels (reuse)
  - `src/renderer/views/FormatClone.vue:300-500` — Per-item editing UI (reuse)

  **Why Each Reference Matters**:
  - The existing Vue component has all the UI patterns needed — follow them exactly

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Smart format tab renders with all UI elements
    Tool: Playwright
    Preconditions: App running on localhost
    Steps:
      1. Navigate to FormatClone view
      2. Click "智能格式化" tab
      3. Assert textarea exists with correct placeholder
      4. Assert "选择参考文档" button exists (optional)
      5. Assert "开始分析" button exists
      6. Assert no result panel visible yet
    Expected Result: All UI elements present in correct layout
    Evidence: .sisyphus/evidence/task-12-tab-ui.png

  Scenario: Analyze and display results
    Tool: Playwright
    Preconditions: App running, mock backend returning valid data
    Steps:
      1. Type "论文题目 黑体 二号\n正文 宋体 小四号" into textarea
      2. Click "开始分析"
      3. Wait for results panel to appear (timeout: 10s)
      4. Assert result items count > 0
      5. Assert each item shows paragraph type label and format details
    Expected Result: Results populated after analysis
    Evidence: .sisyphus/evidence/task-12-results.png

  Scenario: Existing tabs unaffected
    Tool: Playwright
    Steps:
      1. Click "选择参考文档" tab — assert original UI appears
      2. Click "从描述生成" tab — assert original UI appears
      3. Click "智能格式化" tab — assert new UI appears
      4. Click back to first tab — assert still works
    Expected Result: All three tabs functional, no regression
    Evidence: .sisyphus/evidence/task-12-no-regression.png

  Scenario: Empty description shows validation
    Tool: Playwright
    Steps:
      1. Leave textarea empty
      2. Click "开始分析"
      3. Assert error/validation message appears
    Expected Result: No API call made, user sees error message
    Evidence: .sisyphus/evidence/task-12-validation.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add smart format tab to FormatClone`
  - Files: `src/renderer/views/FormatClone.vue`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Message | Files | Pre-commit |
|--------|---------|-------|------------|
| 1 | `refactor(shared): extract STYLE_NAME_ALIASES to shared module` | `src/shared/styleAliases.ts`, `src/main/smartFormatApply.ts`, `src/main/formatClone.ts`, `src/main/formatFromDesc.ts` | `bun test` |
| 2 | `feat(shared): add Chinese font size mapping utility` | `src/shared/chineseFontSize.ts`, `src/__tests__/chineseFontSize.test.ts` | `bun test` |
| 3 | `feat(format): extend ParagraphFormatRule with paragraphType` | `src/main/smartFormatApply.ts`, `src/__tests__/smartFormatApply.test.ts` | `bun test` |
| 4 | `test(format): verify applyStyleProfile creates new styles` | `src/__tests__/styleCreation.test.ts`, fixture docx | `bun test` |
| 5-9 | Individual agent module commits | `src/main/smartFormatAgent.ts`, related tests | `bun test` |
| 10 | `feat(format): add SmartFormatAgent orchestrator` | `src/main/smartFormatAgent.ts`, `src/__tests__/smartFormatAgent.test.ts` | `bun test` |
| 11 | `feat(ipc): add smart-format IPC handlers` | `src/main/ipcHandlers.ts`, `src/main/preload.ts` | `bun test` |
| 12 | `feat(ui): add smart format tab to FormatClone` | `src/renderer/views/FormatClone.vue` | `bun test` |

---

## Success Criteria

### Test Documents Location
测试文档位于 `D:\project\test\`，包含：
- `测试文档.docx` / `测试文档1.docx` — 主测试文档（含多种段落类型，适合集成测试和 QA 验证）
- `测试文档_new.docx` / `_new1` / `_new2` — 已处理版本（可用于对比验证）
- `短文档测试.docx` — 短文档（适合单元测试和快速验证）
- `空白文档.docx` — 空白文档（边缘测试：空文档/无段落场景）

QA 场景应优先使用 `D:\project\test\测试文档.docx` 作为主要 fixture，`短文档测试.docx` 作为快速验证，`空白文档.docx` 作为边缘测试。

### Verification Commands
```bash
bun test src/__tests__/smartFormatAgent.test.ts   # Expected: All tests PASS
bun test src/__tests__/chineseFontSize.test.ts     # Expected: All tests PASS
bun test src/__tests__/styleCreation.test.ts       # Expected: All tests PASS
npx tsc --noEmit                                   # Expected: No type errors
npm run start                                       # Expected: App launches, FormatClone shows 3 tabs
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] FormatClone.vue existing tabs unaffected
- [ ] Content immutability verified (text unchanged after formatting)
