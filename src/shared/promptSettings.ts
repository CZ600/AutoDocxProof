import * as zhCNPrompts from './prompts/zh-CN'
import * as enPrompts from './prompts/en'

export type AppLanguage = 'zh-CN' | 'en'

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

const ERROR_TYPE_MODEL_TYPES: Record<PromptErrorType, string> = {
  typo: 'Typo',
  grammar: 'Grammar',
  consistency: 'Consistency',
  punctuation: 'Punctuation'
}

function getPrompts(lang: AppLanguage) {
  return lang === 'zh-CN' ? zhCNPrompts : enPrompts
}

const INTENSITY_LABELS: Record<AppLanguage, Record<PromptIntensity, string>> = {
  'zh-CN': { strict: '非常严格（锱铢必较）', normal: '正常', loose: '宽松（仅进行必要修改）' },
  en: { strict: 'Very Strict (Nitpicking)', normal: 'Normal', loose: 'Loose (Only necessary changes)' }
}

const BACKGROUND_LABELS: Record<AppLanguage, Record<PromptBackground, string>> = {
  'zh-CN': { academic: '学术', news: '新闻', official: '公文', daily: '日常', custom: '自定义' },
  en: { academic: 'Academic', news: 'News', official: 'Official', daily: 'Daily', custom: 'Custom' }
}

const PROMPT_MODE_LABELS: Record<AppLanguage, Record<string, string>> = {
  'zh-CN': { custom: '自定义覆盖', generated: '选项式生成' },
  en: { custom: 'Custom Override', generated: 'Generated from Options' }
}

export function getLocalizedErrorTypeLabels(lang: AppLanguage) {
  const prompts = getPrompts(lang)
  return PROMPT_ERROR_TYPE_OPTIONS.map(option => ({
    value: option.value,
    label: prompts.ERROR_TYPE_LABELS[option.value]
  }))
}

export function getLocalizedIntensityOptions(lang: AppLanguage) {
  const labels = INTENSITY_LABELS[lang]
  return PROMPT_INTENSITY_OPTIONS.map(option => ({
    value: option.value,
    label: labels[option.value]
  }))
}

export function getLocalizedBackgroundOptions(lang: AppLanguage) {
  const labels = BACKGROUND_LABELS[lang]
  return PROMPT_BACKGROUND_OPTIONS.map(option => ({
    value: option.value,
    label: labels[option.value]
  }))
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
    customBackground:
      typeof input?.customBackground === 'string' ? input.customBackground.trim() : base.customBackground,
    customPromptEnabled:
      typeof input?.customPromptEnabled === 'boolean' ? input.customPromptEnabled : base.customPromptEnabled,
    customPrompt: typeof input?.customPrompt === 'string' ? input.customPrompt : base.customPrompt
  }
}

export function getPromptModeLabel(settings: PromptSettings, language: AppLanguage = 'zh-CN'): string {
  const labels = PROMPT_MODE_LABELS[language]
  return settings.customPromptEnabled ? labels.custom : labels.generated
}

export function buildBackgroundInstruction(settings: PromptSettings, language: AppLanguage = 'zh-CN'): string {
  const prompts = getPrompts(language)
  return prompts.buildBackgroundInstruction(settings)
}

export function buildPromptFromSettings(
  input?: Partial<PromptSettings> | null,
  language: AppLanguage = 'zh-CN'
): string {
  const settings = normalizePromptSettings(input)
  if (settings.customPromptEnabled) {
    return settings.customPrompt.trim()
  }

  const prompts = getPrompts(language)
  const errorTypeInstruction = prompts.buildErrorTypeInstruction(settings.errorTypes)
  const intensityInstruction = prompts.INTENSITY_INSTRUCTIONS[settings.intensity]
  const backgroundInstruction = prompts.buildBackgroundInstruction(settings)
  const jsonTypeInstruction = prompts.buildJsonTypeInstruction(settings.errorTypes)

  return prompts.MASTER_PROMPT_TEMPLATE.replace('{errorTypeInstruction}', errorTypeInstruction)
    .replace('{intensityInstruction}', intensityInstruction)
    .replace('{backgroundInstruction}', backgroundInstruction)
    .replace('{jsonTypeInstruction}', jsonTypeInstruction)
}
