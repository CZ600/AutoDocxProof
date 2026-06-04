# Learnings - Smart Format Agent

## Chinese Font Size Module (src/shared/chineseFontSize.ts)

- Created as Wave 1 Task 2, containing:
  - `CHINESE_FONT_SIZE_MAP`: 16 entries mapping Chinese font names to half-point strings
  - `resolveFontSize()`: accepts Chinese names (with/without "号"), pt values ("14pt"), and naked numbers
  - `FONT_FAMILY_MAP`: 5 font families with {ascii, eastAsia, hAnsi} structure for docx-edit
- Test file at `__tests__/chineseFontSize.test.ts` with 21 tests covering all map entries, resolveFontSize variants, and FONT_FAMILY_MAP completeness
- Vitest is the test framework (import from 'vitest', run via `vitest run`)
- Test files go in `__tests__/` at project root, not in `src/__tests__/`
- All tests passed on first run (21 pass, 38 expect() calls, 46ms)

## Style Aliases Module (src/shared/styleAliases.ts)

- Extracted duplicated `STYLE_NAME_ALIASES` and `styleNameMatches()` from 3 files into shared module
- Canonical source: `smartFormatApply.ts` (contains `export const` version with comment about keeping in sync)
- Files updated:
  - `src/main/smartFormatApply.ts`: import via `import { STYLE_NAME_ALIASES, styleNameMatches } from '../shared/styleAliases'`
  - `src/main/formatClone.ts`: import via `import { STYLE_NAME_ALIASES, styleNameMatches } from '../shared/styleAliases'`
  - `src/main/formatFromDesc.ts`: import via `import { STYLE_NAME_ALIASES } from '../shared/styleAliases'` (only needs the const)
- Note: `formatFromDesc.ts` had slightly different aliases from the canonical (duplicate entries, extra 'TOC Heading') — these were normalized to the canonical version
- Test file at `__tests__/styleAliases.test.ts` with 5 tests: structure, exact match, case-insensitive, alias table match, non-match
- `esModuleInterop: true` and `module: commonjs` in tsconfig — mixing `import` and `require` in same compile unit works

## 2026-06-01 15:13 - styleCreation test
- doc.applyStyleProfile() successfully creates novel styleIds that don't exist in the target document
- doc.saveAs() + loadDocx() reload cycle persists the new style correctly
- Style properties (fontSize, bold, fontFamily, paragraphStyle.alignment) survive save+reload correctly
- Test fixture generated with docx package (3 paragraphs: Heading1 + 2 Normal) at __tests__/fixtures/minimal.docx`n- Use path.resolve(__dirname, 'fixtures', 'minimal.docx') for fixture path in tests
- Use os.tmpdir() for temp output files to avoid cluttering repo

## 2026-06-01 15:13 - paragraphType match support (Task 1 of Wave 2)
- Added `ParagraphType` union type (24 literals) exported from `src/main/smartFormatApply.ts`
- Extended `ParagraphFormatRule.match` with optional `paragraphType?: ParagraphType` field
- Updated `paragraphMatchesRule()`: new 6th param `paragraphTypeMap?: Map<number, string>`, checks `match.paragraphType` against the map — returns false if defined and doesn't match
- Updated `applySmartFormat()`: new 4th param `paragraphTypeMap?: Map<number, string>`, passed through to `paragraphMatchesRule()` calls
- Exported `paragraphMatchesRule()` for unit testing
- New test file `__tests__/smartFormatApply.test.ts` with 8 tests covering: positive match, negative match, missing-from-map, backward compat (no paragraphType), combined with headingLevel, type union verification


## 2026-06-01 15:17 - Task: extractParagraphMetadata

### What was done
- Created src/main/smartFormatAgent.ts with exported ParagraphMetadata interface and extractParagraphMetadata() function
- Created __tests__/smartFormatAgent.test.ts with 6 tests using minimal.docx fixture

### Key decisions
- Replicated uildSectionRanges() and paragraphMatchesSectionType() locally since they are not exported from smartFormatApply.ts (and task forbids modifying that file)
- isBold checks first run's getStyle().bold via try/catch (falls back to false)
- sectionType detection: tries paragraphMatchesSectionType for specific types first, then falls back to range-based detection
- irstChars uses 	ext.substring(0, 80) — no further truncation needed since substring is safe with short strings

### Verification
- All 6 new tests pass
- Full suite: 8/9 test files pass (wordProcess.test.js has 0 tests — pre-existing issue)

## 2026-06-01 15:22 - Task: mapRefProfileToRules (Task 9)

### What was done
- Added `mapRefProfileToRules()` function to `src/main/smartFormatAgent.ts`
- Added 9 test cases to `__tests__/smartFormatAgent.test.ts`

### Function design
- Accepts `refProfile` (StyleProfile from `extractFormatProfile()`) and `apiConfig` (`apiSettings`)
- Extracts style names + key properties (fontSize, bold, italic, alignment, outlineLevel)
- Builds LLM prompt with full ParagraphType reference table + inference rules
- LLM returns `{ mappings: [{ styleId, paragraphType }] }`
- Validates each paragraphType against `VALID_PARAGRAPH_TYPES` set; skips unknown values
- Converts valid mappings to `SmartFormatSpec`: styleProfile entry per type + paragraphRule with `{ match: { paragraphType }, format: { styleName } }`
- Handles edge cases: empty/missing styles → no LLM call, LLM failure → descriptive error, unknown paragraphType → skip, missing styleId → skip, empty mappings → empty result

### Key decisions
- Used `extractRefMappingJSON()` helper (same logic as existing `extractFormatJSON()`) to avoid name collision
- Used `formatRefStyleHints()` helper for building LLM-friendly property description strings
- Added `ModelProvider` and `ParagraphFormatRule` to module imports
- Function placed between `parseFormatDescription` and `extractParagraphMetadata` sections
- `VALID_PARAGRAPH_TYPES` set built from `ParagraphType` union for runtime validation

### Test coverage (9 tests)
1. Valid profile → 4 style mappings, correct SmartFormatSpec structure
2. Unknown paragraphType → gracefully skipped (only valid types included)
3. Empty/missing/null styles → empty SmartFormatSpec, no LLM call
4. LLM network failure → thrown error with descriptive message
5. LLM returns non-JSON → thrown error
6. LLM returns JSON without mappings array → thrown error
7. LLM called with correct parameters (provider, prompts, credentials)
8. Empty mappings array → empty result
9. Non-existent styleId → skipped

### Verification
- `npx vitest run __tests__/smartFormatAgent.test.ts`: 28/29 pass (1 pre-existing parseFormatDescription failure - error message mismatch, unrelated to this task)
- All 9 mapRefProfileToRules tests pass

## 2026-06-01 15:23 - Task: classifyParagraphsHeuristic

### What was done
- Added `classifyParagraphsHeuristic()` function to `src/main/smartFormatAgent.ts`
- Created `tests/classifyParagraphsHeuristic.test.ts` with 51 tests
- The function classifies each paragraph into 1 of 24 `ParagraphType` values using pure heuristic rules (no LLM)

### Key decisions
- **Rule ordering**: Section-context rules (conclusion, references, toc, acknowledgement, appendix) placed BEFORE generic heading-level rules (chapter-title, section-x-title). This is because a level-1 heading in the conclusion section is a "conclusion-title", not a "chapter-title".
- **`isKnownSection` guard**: Section-{1,2,3}-title rules (for headingLevel 2/3/4) check `!isKnownSection` to prevent misclassifying paragraphs inside named sections as generic section titles.
- **`paper-title` rule**: Only fires on index===0, headingLevel null/0, text < 50 chars, AND text doesn't match section heading patterns. This means tests using index=0 with short texts must either provide a non-zero index or a section-matching text.
- **Position context**: `keywordsCnTitleSeen` and `keywordsEnTitleSeen` track the last title paragraph within the current section. Reset on section change.
- **`isPrimarilyLatin()`**: A paragraph is "primarily Latin" if it has no Chinese characters AND Latin letters account for >50% of non-whitespace characters. This distinguishes abstract-en-content from abstract-cn-content.
- **Test helper defaults to index=99**: Avoids paper-title false positives in single-paragraph tests. Only paper-title-specific tests use index=0.

### Files modified
- `src/main/smartFormatAgent.ts`: Added `classifyParagraphsHeuristic()` + helpers (hasChinese, isPrimarilyLatin, normalizeText, matchesSectionHeading)
- `tests/classifyParagraphsHeuristic.test.ts`: New file with 51 tests

### Verification
- All 51 new tests pass
- Full vitest suite: 122/123 pass (1 pre-existing failure in `smartFormatAgent.test.ts` — error message mismatch, unrelated) + 1 pre-existing suite issue (wordProcess.test.js has no test suite)
- All 24 ParagraphType values covered by tests

## 2026-06-01 15:23 - Task: parseFormatDescription (LLM-based format parser)

### What was done
- Added `parseFormatDescription()` to `src/main/smartFormatAgent.ts` (prepended before existing `extractParagraphMetadata` function)
- Created comprehensive system prompt (`FORMAT_PARSER_SYSTEM_PROMPT`) with Chinese format parsing instructions
- Added post-processing pipeline: `resolveFontSize()`, `FONT_FAMILY_MAP` lookup, fontFamily normalization
- Appended 14 new tests to `__tests__/smartFormatAgent.test.ts`

### Key decisions
- **Import hygiene**: Used `import type { apiSettings }` to avoid pulling in `electron`/`sqlite3` runtime dependencies when `database.ts` is resolved in test environment
- **System prompt design**: Instructs LLM to output Chinese font names (not SimHei/SimSun) and Chinese font sizes (not half-point numbers) — post-processor handles conversion. This reduces LLM confusion.
- **fontFamily normalization**: 3-step lookup: (1) exact match on Chinese name in FONT_FAMILY_MAP, (2) reverse lookup on English names (SimHei, SimSun), (3) fallback to string→object conversion
- **extractJSON**: Replicated (not imported) from `formatFromDesc.ts` — handles raw JSON, `\`\`\`json` code blocks, and brace extraction
- **StyleId convention**: Uses ParagraphType values as styleId keys (e.g. "paper-title", "body"), matching `paragraphRules.match.paragraphType` for consistency
- **Error messages**: "大模型未返回有效的格式参数 JSON" (no JSON found), "大模型返回的格式参数 JSON 解析失败" (parse failure), "大模型返回的格式参数结构不正确" (not an object — safety net), "格式描述不能为空" (empty input validation before LLM call)

### Test coverage (14 tests)
1. Valid Chinese description → correct paragraphTypes in styleProfile + paragraphRules
2. Font size normalization: "二号"→"44", "小四"→"24" via resolveFontSize
3. Font size with "号" suffix: "小四号"→"24"
4. Font family normalization: 黑体→SimHei object, 宋体→SimSun object
5. Reverse font lookup: "SimHei"→黑体 mapping
6. Unknown font fallback: "UnknownFont"→{ascii,eastAsia,hAnsi: "UnknownFont"}
7. Plain text (no JSON) → error
8. JSON in markdown code block → extracted successfully
9. Malformed JSON → parse error
10. JSON array (not object) → error
11. Empty description → error (no LLM call)
12. Whitespace-only → error (no LLM call)
13. pageSettings preservation
14. LLM called with correct arguments (provider, prompts, credentials)

### Gotchas
- `extractJSON` only handles `{`-delimited objects; JSON arrays/strings/primitives return null (not a real issue since LLM should always return objects)
- The `typeof raw !== 'object'` guard after JSON.parse is a safety net that's typically unreachable through normal flow (extractJSON only returns `{`-wrapped content which always parses to object)
- `typeof null === 'object'` in JS, so null would pass the guard — fine since extractJSON never returns `"null"` alone

### Verification
- `npx vitest run __tests__/smartFormatAgent.test.ts`: 29/29 pass (14 new + 6 existing = 20 original extractParagraphMetadata tests + 9 mapRefProfileToRules tests)
- Pre-existing parseFormatDescription error message mismatch bug is now FIXED

---

## Task 8: classifyParagraphsWithLLM (LLM-enhanced paragraph classification)

### Implementation
- **Added** `LLMClassificationResult` interface: `{ classifications, fallbackMode, tokenUsage }`
- **Added** `classifyParagraphsWithLLM(metadata, heuristicResult, apiConfig)` — main export
- **Added** `mergeResults(heuristicResult, llmResults, metadataCount)` — internal merge logic
- **Added** `CLASSIFY_SYSTEM_PROMPT` — Chinese system prompt with all 24 ParagraphType descriptions in table format
- **Added** `LLMBatchItem` and `LLMClassificationResponse` internal interfaces

### Key decisions
- **Batch size**: 25 paragraphs per LLM call (matching task spec)
- **Confidence threshold**: 0.7 — if LLM confidence >= 0.7, use LLM; otherwise heuristic
- **Fallback strategy**: If ANY batch fails → full fallback to heuristic (not partial). This is conservative but safe.
- **Token tracking**: Even on fallback, successful batch tokens are counted
- **JSON extraction**: Reused same pattern as `extractFormatJSON` — handles plain JSON, ` ```json ``` ` blocks, and brace-bounded fragments
- **Type validation**: Reuses existing `VALID_PARAGRAPH_TYPES` set to filter invalid LLM outputs
- **Parallel batches**: Uses `Promise.allSettled` to process all batches concurrently

### Context construction
Each batch item sent to LLM includes:
- `prevTypes`: Previous 2 paragraph types from heuristicResult (or null)
- `nextFirstChars`: Next 2 paragraph firstChars from metadata (or empty string)
This gives the LLM positional awareness without sending full text.

### Tests added (14 new)
1. Batch splitting: 50 paragraphs → 2 LLM calls
2. Empty metadata → empty result, no LLM calls
3. High confidence (>=0.7) → LLM classification used
4. Low confidence (<0.7) → heuristic used
5. Mixed confidence → hybrid merge (some LLM, some heuristic)
6. LLM network error → fallbackMode=true, heuristic used
7. LLM returns plain text → fallback
8. LLM returns unknown paragraphType → filtered, heuristic for those
9. LLM returns JSON in markdown block → extracted
10. Partial batch failure in multi-batch → full fallback
11. Missing LLM entries → heuristic used for uncovered indices
12. Context verification: prevTypes from heuristic, nextFirstChars from metadata
13. LLM call arguments verification
14. Null metadata safety

### Verification
- `npx vitest run __tests__/smartFormatAgent.test.ts`: 43/43 pass (29 existing + 14 new)

## SmartFormatAgent Implementation
- i.mock('module', async (importOriginal) => { const actual = await importOriginal(); ... }) works for partial module mocking but TS strictness requires correct factory params
- i.resetAllMocks() is needed instead of i.clearAllMocks() to prevent mockResolvedValueOnce leaking between tests
- mapRefProfileToRules validates paragraphTypes via VALID_PARAGRAPH_TYPES Set; unknown types are silently skipped
- mapRefProfileToRules matches on styleId keys from the ref profile; mapping styleIds must match actual style keys in the ref profile
- esolveFontSize/esolveFontNames in parseFormatDescription post-processes fontFamily into { ascii, eastAsia, hAnsi } object
- pplySmartFormat mock must actually copy input �� output file for content immutability tests to pass

## Task 11: Register IPC handlers + preload bridge

### What was done
- Added `SmartFormatAgent` import to `ipcHandlers.ts` from `./smartFormatAgent`
- Added `ParagraphType` import from `./smartFormatApply` for type casting
- Registered two IPC handlers inside `registerIpcHandlers()`:
  - `smart-format-analyze`: accepts `{description?, refFilePath?, targetFilePath, apiConfig}`, returns `{success, spec, classification, tokenUsage, fallbackMode}` or `{success: false, error}`
  - `smart-format-apply`: accepts `{inputPath, outputPath, spec, classification}`, returns `ApplyResult` spread or `{success: false, error}`
- Exposed `smartFormatAnalyze` and `smartFormatApply` methods in preload.ts `electronAPI`

### Key considerations
- `apiSettings` type is defined both locally in `ipcHandlers.ts` and in `./database.ts` — they differ slightly (local has `provider?: ModelProvider`, database has `provider: ModelProvider`). Use `any` for IPC param types to avoid conflicts.
- `SmartFormatAgent` imports `apiSettings` from `./database` — the existing `format-from-description` handler also uses `any` for apiConfig (line 917 pattern), so matching that is safe.
- Classification is `Map<number, ParagraphType>` — must be serialized as `Array<[number, string]>` for IPC since Maps don't serialize. Reverse conversion with `as Map<number, ParagraphType>` cast when deserializing.
- The handler for `smart-format-apply` returns the result spread directly (`{ ...result }`) rather than forcing `success: true`, because `applySmartFormat` can return `success: false` without throwing.
- `SmartFormatAgent` is instantiated once inside `registerIpcHandlers()` — both handlers share the same instance.

### Pattern used
- IPC channel: `kebab-case`
- Preload API name: `camelCase`
- Error pattern: `try { ... return { success: true, ... } } catch { return { success: false, error: ... } }`

## Task: Add SmartFormatAgent tab to FormatClone.vue

### What was done
- Added third tab "智能格式化" to `FormatClone.vue` with full agent mode UI
- Template: description textarea, optional ref doc selector, analyze button, collapsible results with format details, output mode toggle, apply button
- Script: 11 new data properties, 4 new methods (selectAgentRefFile, runSmartAnalyze, buildAgentResults, runSmartApply)
- Added `ElRadio`, `ElRadioGroup` to Element Plus imports
- Added `.agent-input-area`, `.result-summary`, `.detail-row`, `.output-options` CSS
- Existing two tabs (`ref`, `desc`) completely untouched

### Key decisions / adaptations from plan
- Used `electronAPI.selectDocxFile()` instead of `electronAPI.selectFile()` — `selectFile` does not exist in preload.ts
- Used `targetFilePath` (injected) instead of `this.filePath` — the component uses `inject()` from Composition API
- Used `ElMessage` instead of `this.$message` — consistent with existing codebase patterns
- Built `apiConfig` from `apiStore.selectedApi` — same pattern as `generateFromDesc()`
- `buildAgentResults()` handles multiple classification formats: Map, Array, and plain object — defensive against IPC serialization differences
- Conditionally hid shared `formatItems` section for agent mode: `v-if="inputMode !== 'agent' && formatItems.length > 0"` — prevents stale ref/desc results from showing in agent tab
- Added `agentActiveNames` ref for collapse panel tracking (not in original plan but required by template)

### Verification
- LSP diagnostics: clean, no errors


## Wave F1: Plan Compliance Audit (2026-06-01)

### Must Have [7/7] - ALL PASS
1. [?] parseFormatDescription @ smartFormatAgent.ts:425
2. [?] ParagraphType (24 types) @ smartFormatApply.ts:44-68 + classifyParagraphsHeuristic @ smartFormatAgent.ts:861
3. [?] applyStyleProfile() proven by __tests__/styleCreation.test.ts (PASS)
4. [?] mapRefProfileToRules @ smartFormatAgent.ts:644
5. [?] classifyParagraphsWithLLM @ smartFormatAgent.ts:1359 with heuristic fallback @ line 1507
6. [?] Content immutability in apply() @ smartFormatAgent.ts:1559-1581 (captures originalTexts, reloads output, compares)
7. [?] mergeSpecs @ smartFormatAgent.ts:1588 (desc overrides ref for same paragraphType)

### Must NOT Have [12/12] - NO VIOLATIONS
1. [?] No table formatting code in agent
2. [?] No multi-document batch processing (batch = LLM paragraph batches per design)
3. [?] No format preset/template code
4. [?] No preview/comparison code
5. [?] No .doc handling
6. [?] No proofreading integration in agent
7. [?] No format rule export/import
8. [?] firstChars limited to 80 in ParagraphMetadata interface @ line 8, enforced @ line 763
9. [?] formatClone.ts and formatFromDesc.ts only import from shared/styleAliases, core logic unchanged
10. [?] FormatClone.vue existing 2 tabs ('ѡ��ο��ĵ�', '����������') preserved alongside new tab
11. [?] No custom style creation code in agent (uses applyStyleProfile only)
12. [?] header/footer via pageSettings only (lines 401-405)

### VERDICT: APPROVE
