import type { PromptErrorType, PromptIntensity, PromptBackground, PromptSettings } from '../../shared/promptSettings'

export const ERROR_TYPE_LABELS: Record<PromptErrorType, string> = {
  typo: 'Typo',
  grammar: 'Grammar',
  consistency: 'Context Consistency',
  punctuation: 'Punctuation'
}

const ERROR_TYPE_MODEL_TYPES: Record<PromptErrorType, string> = {
  typo: 'Typo',
  grammar: 'Grammar',
  consistency: 'Consistency',
  punctuation: 'Punctuation'
}

export const INTENSITY_INSTRUCTIONS: Record<PromptIntensity, string> = {
  strict:
    'Correction intensity is "Very Strict". Please review the text as strictly as possible. As long as there is a clear and reasonable need for modification, you should propose corrections, but you must still avoid changing the original facts and core meaning.',
  normal:
    'Correction intensity is "Normal". Please perform routine proofreading while ensuring accuracy, fixing obvious issues and avoiding excessive rewriting.',
  loose:
    'Correction intensity is "Loose". Only propose corrections when there are obvious errors or genuine necessity; avoid unnecessary adjustments to acceptable expressions.'
}

export const BACKGROUND_INSTRUCTIONS: Record<Exclude<PromptBackground, 'custom'>, string> = {
  academic:
    'The text is in an academic writing context. Please prioritize terminology accuracy, rigorous expression, and contextual logical consistency.',
  news: 'The text is in a news writing context. Please prioritize narrative accuracy, clear sentences, objective expression, and proper punctuation.',
  official:
    'The text is in an official document writing context. Please prioritize standard wording, formal formatting, logical rigor, and contextual consistency.',
  daily:
    'The text is in a daily expression context. Please prioritize natural, easy-to-understand expression with smooth sentences and basic standards.'
}

export function buildErrorTypeInstruction(errorTypes: PromptErrorType[]): string {
  const labels = errorTypes.map(type => ERROR_TYPE_LABELS[type])
  return `Only check for the following error types: ${labels.join(', ')}. Do not use unlisted types as reasons for modifications.`
}

export function buildBackgroundInstruction(settings: PromptSettings): string {
  if (settings.background === 'custom') {
    const customBackground = settings.customBackground.trim()
    return customBackground
      ? `The text is in a custom context: ${customBackground}. Please understand the context accordingly and perform proofreading.`
      : 'The text is in a custom context. Please perform careful proofreading based on the textual context.'
  }
  return BACKGROUND_INSTRUCTIONS[settings.background]
}

export function buildJsonTypeInstruction(errorTypes: PromptErrorType[]): string {
  const modelTypes = errorTypes.map(type => ERROR_TYPE_MODEL_TYPES[type]).join('/')
  return `"type": "Error Type (${modelTypes})"`
}

export const MASTER_PROMPT_TEMPLATE = `You are a professional English text proofreading expert. Please carefully check the text according to the given configuration.
Requirements:
1. {errorTypeInstruction}
2. {intensityInstruction}
3. {backgroundInstruction}
4. Keep the original meaning unchanged; do not perform style rewrites or content expansion.
5. Return results in the specified JSON format.
Please proofread the text provided by the user and return results in the following JSON format:
[
  {
    "original": "The original error content (extract only the erroneous phrase, no more than 15 words!)",
    "suggested": "The suggested correction (modified content based on the original)",
    "reason": "A brief explanation of the error",
    {jsonTypeInstruction}
  }
]
If there are no errors, return an empty array []. Only return the JSON array; do not add any other explanatory text.`

export const RAG_TEXT =
  'The following content is reference material for proofreading. Please use this text to assist with your proofreading work (if bilingual, follow the language type of the content being proofread). Follow the previously stated proofreading rules.'

export function buildReviewPrompt(backgroundInstruction: string): string {
  return `You are a proofreading result review expert. Your task is to review a set of proofreading suggestions, filter out invalid or incorrect suggestions, and retain valuable modifications.

Text background information: ${backgroundInstruction}

Review rules (please strictly filter the following types of suggestions):
1. **No actual changes**: The original text (original) and suggested modification (suggested) are identical or differ only in whitespace/punctuation
2. **Unnecessary changes**: The original expression is fine, and the modification actually changes the original style or introduces new issues
3. **Blank changes**: The original or suggested content is an empty string
4. **Obviously incorrect changes**: The suggested modification is clearly wrong, introduces new grammar errors, or is semantically nonsensical

Review process:
1. Check each proofreading suggestion one by one
2. For suggestions that do not meet retention criteria, set filtered: true and provide a filterReason
3. For suggestions that meet retention criteria, keep filtered: false

**Important constraints**:
- Must preserve the original and suggested field content of each suggestion exactly; do not rewrite, replace, or add any explanatory text
- The judgment result can only be expressed through the filtered field (true/false); never indicate "original is correct" by modifying the suggested field

Please return the reviewed results in the following JSON format (only return the JSON array, do not add any other explanatory text):
[
  {
    "original": "Original content",
    "suggested": "Suggested modification",
    "reason": "Proofreading reason",
    "type": "Error type",
    "filtered": false
  }
]

For filtered suggestions, the format is:
[
  {
    "original": "Original content",
    "suggested": "Suggested modification",
    "reason": "Proofreading reason",
    "type": "Error type",
    "filtered": true,
    "filterReason": "Brief reason for filtering"
  }
]

If all suggestions should be retained, return the array with all filtered as false. If all suggestions should be filtered, return an empty array [].`
}

export function buildReviewUserPrompt(
  corrections: { original: string; suggested: string; reason: string; type: string }[]
): string {
  const items = corrections
    .map(
      (c, i) =>
        `${i + 1}. original: "${c.original}" | suggested: "${c.suggested}" | reason: "${c.reason}" | type: "${c.type}"`
    )
    .join('\n')
  return `Please review the following ${corrections.length} proofreading suggestions:\n\n${items}`
}

export const THEME_SUMMARIZATION_SYSTEM_PROMPT =
  'You are a professional document analysis expert. Please summarize the overall framework and theme of the document based on the provided document structure.'

export function buildThemeUserPrompt(title: string, sections: { title: string }[]): string {
  const sectionList = sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
  return `Document title: ${title}\n\nDocument structure:\n${sectionList}\n\nPlease summarize the main theme and overall framework of this document:`
}

export function buildDocumentContextInjection(title: string, theme: string, sectionTitle: string): string {
  return `Document title: ${title}\nDocument theme: ${theme}\nCurrent section title: ${sectionTitle}`
}

export const USER_PROMPT_TEXT = 'Content to proofread'

export const PROGRESS_MESSAGES = {
  splitting: 'Organizing information',
  theme: 'Analyzing document',
  proofreading: 'Proofreading',
  reviewing: 'Reviewing proofreading results',
  completed: 'Proofreading completed'
} as const

export const FILE_DIALOG_FILTERS = {
  docx: {
    name: 'Word Documents',
    extensions: ['docx']
  }
} as const

export const REVIEW_FILTER_REASONS = {
  reviewRejected: 'Review rejected',
  reviewOriginalCorrect: 'Review determined original is correct',
  noReason: 'Not provided'
} as const

export const CONSOLE_MESSAGES = {
  proofTextFailed: 'Proofreading text failed:',
  documentProofError: 'Error during document proofreading:',
  loadPromptFailed: 'Failed to load prompt configuration, reverted to default:',
  summarizeThemeError: 'Error summarizing document theme:',
  parseWordFailed: 'Failed to parse Word document: '
} as const
