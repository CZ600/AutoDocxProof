import type { PromptErrorType, PromptIntensity, PromptBackground, PromptSettings } from '../../shared/promptSettings'

export const ERROR_TYPE_LABELS: Record<PromptErrorType, string> = {
  typo: '错别字',
  grammar: '语法',
  consistency: '上下文一致性',
  punctuation: '标点'
}

const ERROR_TYPE_MODEL_TYPES: Record<PromptErrorType, string> = {
  typo: 'Typo',
  grammar: 'Grammar',
  consistency: 'Consistency',
  punctuation: 'Punctuation'
}

export const INTENSITY_INSTRUCTIONS: Record<PromptIntensity, string> = {
  strict:
    '校正强度为"非常严格"。请尽可能严格地审查文本，只要存在明确且合理的修改必要，就应提出修改意见，但仍必须避免改变原文事实和核心意思。',
  normal: '校正强度为"正常"。请在保证准确性的前提下进行常规校对，修正明显问题，避免过度改写。',
  loose: '校正强度为"宽松"。仅在存在明显错误或确有必要时才提出修改，避免对可接受表达做非必要调整。'
}

export const BACKGROUND_INSTRUCTIONS: Record<Exclude<PromptBackground, 'custom'>, string> = {
  academic: '文本背景为学术写作，请优先保证术语准确、表达严谨、上下文逻辑一致。',
  news: '文本背景为新闻写作，请优先保证叙述准确、语句清晰、表述客观、标点规范。',
  official: '文本背景为公文写作，请优先保证措辞规范、格式庄重、逻辑严密、上下文前后一致。',
  daily: '文本背景为日常表达，请优先保证表达自然、易懂、语句通顺和基本规范。'
}

export function buildErrorTypeInstruction(errorTypes: PromptErrorType[]): string {
  const labels = errorTypes.map(type => ERROR_TYPE_LABELS[type])
  return `本次仅检查以下错误类型：${labels.join('、')}。未列出的类型不要作为修改理由。`
}

export function buildBackgroundInstruction(settings: PromptSettings): string {
  if (settings.background === 'custom') {
    const customBackground = settings.customBackground.trim()
    return customBackground
      ? `文本背景为自定义场景：${customBackground}。请据此理解语境并执行校对。`
      : '文本背景为自定义场景。请根据文本语境执行审慎校对。'
  }
  return BACKGROUND_INSTRUCTIONS[settings.background]
}

export function buildJsonTypeInstruction(errorTypes: PromptErrorType[]): string {
  const modelTypes = errorTypes.map(type => ERROR_TYPE_MODEL_TYPES[type]).join('/')
  return `"type": "错误类型(${modelTypes})"`
}

export const MASTER_PROMPT_TEMPLATE = `你是一个专业的中英文文本校对专家。请根据给定配置仔细检查文本。
要求：
1. {errorTypeInstruction}
2. {intensityInstruction}
3. {backgroundInstruction}
4. 保持原文意思不变，不要进行风格改写或内容扩展。
5. 按照指定的JSON格式返回结果。
请校对用户提供的文本，并按照以下JSON格式(JSON format)返回：
[
  {
    "original": "原文错误内容（只截取原文错误的词组，不要多写，不超过15字！）",
    "suggested": "建议修改内容（基于原文的修改后的内容）",
    "reason": "错误原因的简短说明",
    {jsonTypeInstruction}
  }
]
如果没有任何错误，请返回空数组[]。只返回JSON数组，不要添加其他任何说明文字。`

export const RAG_TEXT =
  '以下内容是校对的参考内容，请结合这些文字进行校对工作（如果是双语内容，则以校对内容的语言类型为准），校对规则遵循之前讲述的要求'

export function buildReviewPrompt(backgroundInstruction: string): string {
  return `你是一个校对结果审核专家。你的任务是审查一组校对建议，过滤掉无效或错误的建议，保留有价值的修改。

文本背景信息：${backgroundInstruction}

审核规则（请严格过滤以下类型的建议）：
1. **没有实际改动的**：原文(original)和建议修改后内容(suggested)完全相同或仅存在空格/标点差异的
2. **不必要的改动**：原文表达本身没有问题，修改反而改变了原文风格或引入了新问题
3. **空白的改动**：原文或建议内容为空字符串的
4. **有明显错误的改动**：建议修改的内容明显不正确、引入了新的语法错误或语义不通

审核流程：
1. 逐条检查每个校对建议
2. 对于不符合保留标准的建议，设置 filtered: true 并给出 filterReason
3. 对于符合保留标准的建议，保持 filtered: false

**重要约束**：
- 必须原样保留每条建议的 original 和 suggested 字段内容，禁止改写、替换或添加任何解释性文字
- 判断结果只能通过 filtered 字段（true/false）表达，绝不能通过修改 suggested 字段来表示"原文无误"

请按照以下JSON格式返回审核后的结果（只返回JSON数组，不要添加其他任何说明文字）：
[
  {
    "original": "原文内容",
    "suggested": "建议修改内容",
    "reason": "校对原因",
    "type": "错误类型",
    "filtered": false
  }
]

对于被过滤的建议，格式如下：
[
  {
    "original": "原文内容",
    "suggested": "建议修改内容",
    "reason": "校对原因",
    "type": "错误类型",
    "filtered": true,
    "filterReason": "过滤原因简述"
  }
]

如果所有建议都应保留，直接返回filtered全部为false的数组。如果所有建议都应过滤，返回空数组[]。`
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
  return `请审核以下 ${corrections.length} 条校对建议：\n\n${items}`
}

export const THEME_SUMMARIZATION_SYSTEM_PROMPT =
  '你是一个专业的文档分析专家。请根据提供的文档目录结构，总结文档的整体框架和主题。'

export function buildThemeUserPrompt(title: string, sections: { title: string }[]): string {
  const sectionList = sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
  return `文档标题: ${title}\n\n文档目录结构:\n${sectionList}\n\n请总结这份文档的主要主题和整体框架：`
}

export function buildDocumentContextInjection(title: string, theme: string, sectionTitle: string): string {
  return `文档标题: ${title}\n文档主题: ${theme}\n当前章节标题: ${sectionTitle}`
}

export const USER_PROMPT_TEXT = '需要校对的内容'

export const PROGRESS_MESSAGES = {
  splitting: '正在整理信息',
  theme: '正在分析文档',
  proofreading: '正在校对',
  reviewing: '正在审核校对结果',
  completed: '校对完成'
} as const

export const FILE_DIALOG_FILTERS = {
  docx: {
    name: 'Word 文档',
    extensions: ['docx']
  }
} as const

export const REVIEW_FILTER_REASONS = {
  reviewRejected: '审核未通过',
  reviewOriginalCorrect: '审核判定原文无误',
  noReason: '未提供'
} as const

export const CONSOLE_MESSAGES = {
  proofTextFailed: '校对文本失败:',
  documentProofError: '文档校对过程中出现错误:',
  loadPromptFailed: '加载提示词配置失败，已回退到默认配置:',
  summarizeThemeError: '总结文档主题时出错:',
  parseWordFailed: '解析Word文档失败: '
} as const
