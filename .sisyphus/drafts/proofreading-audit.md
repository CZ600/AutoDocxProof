# Draft: Proofreading Audit Enhancement

## Requirements (confirmed)

- Add a new LLM audit step after proofreading completes
- Input to audit: Full text background + proofreading results
- Batch processing: If >100 results, split into batches (each batch gets full background)
- Output: Audited proofreading results (maintain original format)
- Filter out unnecessary changes:
  1. No changes (original = modified)
  2. Unnecessary changes
  3. Blank changes
  4. Obviously incorrect changes

## Technical Decisions

- TBD: LLM selection (reuse existing OpenAI/Gemini or dedicated audit model)
- TBD: When to run audit (automatic after proofreading vs manual trigger)
- TBD: How to display filtered results (remove vs separate category)
- TBD: Audit prompt engineering approach

## Research Findings

- **Tech Stack**: Electron + Vue 3 + TypeScript desktop application
- **Core Proofreading**: `src/main/proof.ts` - orchestrates proofreading with Mammoth parsing, RAG via LanceDB
- **LLM Integration**: `src/main/chat.ts` - supports both OpenAI and Google Gemini APIs, includes OpenaiGen() and getGeminiResponse()
- **Data Structure**: ProofreadingCorrection interface:
  - `original: string` - original text
  - `suggested: string` - suggested correction
  - `reason: string` - explanation
  - `type: string` - error type (Typo/Punctuation/Grammar/Consistency)
  - `References?: string[]` - optional RAG references
- **Progress Model**: `src/shared/proofreadProgress.ts` - ProofreadStage, ProofreadMode, ProofreadProgressPayload
- **UI Components**: `src/renderer/views/Proof.vue` - displays proofreading results in sidebar
- **Concurrency**: Already supports parallel processing with rate limiting
- **Workflow**: User selects file → proofreadDocument() → results displayed → apply/export

## Open Questions

- What LLM should we use for auditing?
- Where in the workflow should the audit step be inserted?
- How should filtered results be reported?
- Should we preserve filtered results for reference or remove them entirely?

## Scope Boundaries

- INCLUDE: LLM audit integration, batch processing logic, output formatting
- EXCLUDE: TBD (pending exploration)
