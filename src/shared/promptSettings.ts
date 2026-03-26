export type PromptErrorType = 'typo' | 'grammar' | 'consistency' | 'punctuation'
export type PromptIntensity = 'strict' | 'normal' | 'loose'
export type PromptBackground = 'academic' | 'news' | 'official' | 'daily' | 'custom'

export interface PromptSettings {
  errorTypes: PromptErrorType[]
  intensity: PromptIntensity
  background: PromptBackground
  customBackground: string
  customPromptEnabled: boolean
  customPrompt: string
}

export const PROMPT_ERROR_TYPE_OPTIONS: { label: string; value: PromptErrorType }[] = [
  { label: '错别字', value: 'typo' },
  { label: '语法', value: 'grammar' },
  { label: '上下文一致性', value: 'consistency' },
  { label: '标点', value: 'punctuation' }
]

export const PROMPT_INTENSITY_OPTIONS: { label: string; value: PromptIntensity }[] = [
  { label: '非常严格（锱铢必较）', value: 'strict' },
  { label: '正常', value: 'normal' },
  { label: '宽松（仅进行必要修改）', value: 'loose' }
]

export const PROMPT_BACKGROUND_OPTIONS: { label: string; value: PromptBackground }[] = [
  { label: '学术', value: 'academic' },
  { label: '新闻', value: 'news' },
  { label: '公文', value: 'official' },
  { label: '日常', value: 'daily' },
  { label: '自定义', value: 'custom' }
]

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  errorTypes: PROMPT_ERROR_TYPE_OPTIONS.map(item => item.value),
  intensity: 'normal',
  background: 'academic',
  customBackground: '',
  customPromptEnabled: false,
  customPrompt: ''
}

const ERROR_TYPE_LABELS: Record<PromptErrorType, string> = {
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

const INTENSITY_INSTRUCTIONS: Record<PromptIntensity, string> = {
  strict:
    '校正强度为“非常严格”。请尽可能严格地审查文本，只要存在明确且合理的修改必要，就应提出修改意见，但仍必须避免改变原文事实和核心意思。',
  normal:
    '校正强度为“正常”。请在保证准确性的前提下进行常规校对，修正明显问题，避免过度改写。',
  loose:
    '校正强度为“宽松”。仅在存在明显错误或确有必要时才提出修改，避免对可接受表达做非必要调整。'
}

const BACKGROUND_INSTRUCTIONS: Record<Exclude<PromptBackground, 'custom'>, string> = {
  academic: '文本背景为学术写作，请优先保证术语准确、表达严谨、上下文逻辑一致。',
  news: '文本背景为新闻写作，请优先保证叙述准确、语句清晰、表述客观、标点规范。',
  official: '文本背景为公文写作，请优先保证措辞规范、格式庄重、逻辑严密、上下文前后一致。',
  daily: '文本背景为日常表达，请优先保证表达自然、易懂、语句通顺和基本规范。'
}

export function clonePromptSettings(settings: PromptSettings): PromptSettings {
  return {
    errorTypes: [...settings.errorTypes],
    intensity: settings.intensity,
    background: settings.background,
    customBackground: settings.customBackground,
    customPromptEnabled: settings.customPromptEnabled,
    customPrompt: settings.customPrompt
  }
}

export function normalizePromptSettings(
  input?: Partial<PromptSettings> | null,
  fallback: PromptSettings = DEFAULT_PROMPT_SETTINGS
): PromptSettings {
  const base = clonePromptSettings(fallback)
  const incomingErrorTypes = Array.isArray(input?.errorTypes)
    ? input!.errorTypes.filter((item): item is PromptErrorType =>
        PROMPT_ERROR_TYPE_OPTIONS.some(option => option.value === item)
      )
    : base.errorTypes

  const background = PROMPT_BACKGROUND_OPTIONS.some(option => option.value === input?.background)
    ? (input!.background as PromptBackground)
    : base.background
  const intensity = PROMPT_INTENSITY_OPTIONS.some(option => option.value === input?.intensity)
    ? (input!.intensity as PromptIntensity)
    : base.intensity

  return {
    errorTypes: incomingErrorTypes.length > 0 ? [...incomingErrorTypes] : [...base.errorTypes],
    intensity,
    background,
    customBackground: typeof input?.customBackground === 'string' ? input.customBackground.trim() : base.customBackground,
    customPromptEnabled:
      typeof input?.customPromptEnabled === 'boolean' ? input.customPromptEnabled : base.customPromptEnabled,
    customPrompt: typeof input?.customPrompt === 'string' ? input.customPrompt : base.customPrompt
  }
}

export function getPromptModeLabel(settings: PromptSettings): string {
  return settings.customPromptEnabled ? '自定义覆盖' : '选项式生成'
}

function buildBackgroundInstruction(settings: PromptSettings): string {
  if (settings.background === 'custom') {
    const customBackground = settings.customBackground.trim()
    return customBackground
      ? `文本背景为自定义场景：${customBackground}。请据此理解语境并执行校对。`
      : '文本背景为自定义场景。请根据文本语境执行审慎校对。'
  }

  return BACKGROUND_INSTRUCTIONS[settings.background]
}

function buildErrorTypeInstruction(errorTypes: PromptErrorType[]): string {
  const labels = errorTypes.map(type => ERROR_TYPE_LABELS[type])
  return `本次仅检查以下错误类型：${labels.join('、')}。未列出的类型不要作为修改理由。`
}

function buildJsonTypeInstruction(errorTypes: PromptErrorType[]): string {
  const modelTypes = errorTypes.map(type => ERROR_TYPE_MODEL_TYPES[type]).join('/')
  return `"type": "错误类型(${modelTypes})"`
}

export function buildPromptFromSettings(input?: Partial<PromptSettings> | null): string {
  const settings = normalizePromptSettings(input)
  if (settings.customPromptEnabled) {
    return settings.customPrompt.trim()
  }

  const jsonTypeInstruction = buildJsonTypeInstruction(settings.errorTypes)

  return `你是一个专业的中文文本校对专家。请根据给定配置仔细检查文本。
要求：
1. ${buildErrorTypeInstruction(settings.errorTypes)}
2. ${INTENSITY_INSTRUCTIONS[settings.intensity]}
3. ${buildBackgroundInstruction(settings)}
4. 保持原文意思不变，不要进行风格改写或内容扩展。
5. 按照指定的JSON格式返回结果。
请校对用户提供的文本，并按照以下JSON格式(JSON format)返回：
[
  {
    "original": "原文错误内容（只截取原文错误的词组，不要多写，不超过15字！）",
    "suggested": "建议修改内容（基于原文的修改后的内容）",
    "reason": "错误原因的简短说明",
    ${jsonTypeInstruction}
  }
]
如果没有任何错误，请返回空数组[]。只返回JSON数组，不要添加其他任何说明文字。`
}
