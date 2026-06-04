# Scope Fidelity Check (F4) — Issues Found

## Date: 2026-06-01

### Issue 1: Stray test file `tests/classifyParagraphsHeuristic.test.ts`
- **Severity**: Low
- **Description**: Test file created at `tests/` directory (repo root) instead of being part of `__tests__/smartFormatAgent.test.ts` as specified in the plan for Task 7.
- **Impact**: Extra file outside planned file structure. No functional impact — imports from `smartFormatAgent.ts` correctly.
- **Resolution**: Move tests into `__tests__/smartFormatAgent.test.ts` or document the deviation.

### Issue 2: Missing `smart-format-cancel` IPC handler
- **Severity**: Low-Medium
- **Description**: Task 11 plan specifies three handlers: `smart-format-analyze`, `smart-format-apply`, AND `smart-format-cancel` (to cancel in-progress analysis). Only the first two were implemented.
- **Impact**: No way to cancel a running analysis from the renderer process. Could cause UX issues if analysis takes long.
- **Resolution**: Implement `smart-format-cancel` handler in `ipcHandlers.ts`.

### Issue 3: Test path deviation
- **Severity**: Cosmetic
- **Description**: Plan specifies test path as `src/__tests__/` but actual tests are at `__tests__/` (repo root). All files exist, just at different location.
- **Impact**: None. Works fine with vitest config.
- **Resolution**: Acceptable deviation or move to `src/__tests__/`.

### Issue 4: Duplicated `buildSectionRanges`/`paragraphMatchesSectionType`
- **Severity**: Minor (code quality)
- **Description**: `smartFormatAgent.ts` duplicates these functions from `smartFormatApply.ts` with comment "replicated to avoid circular deps". Plan for Task 6 said "reuse existing".
- **Impact**: Potential for drift between two copies. Not a scope violation per se.
- **Resolution**: Document in decisions.md why duplication was necessary.
