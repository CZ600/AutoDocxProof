import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { usePromptStore } from '../stores/promptStore'
import {
  buildPromptFromSettings,
  clonePromptSettings,
  DEFAULT_PROMPT_SETTINGS,
  getPromptModeLabel,
  normalizePromptSettings,
  PROMPT_BACKGROUND_OPTIONS,
  PROMPT_ERROR_TYPE_OPTIONS,
  PROMPT_INTENSITY_OPTIONS,
  PromptSettings
} from '../../shared/promptSettings'

export function usePrompt() {
  const { t } = useI18n()
  const electronAPI = window.electronAPI
  const promptStore = usePromptStore()

  const settings = computed(() => promptStore.settings)
  const effectivePrompt = computed(() => buildPromptFromSettings(settings.value))
  const modeLabel = computed(() => getPromptModeLabel(settings.value))

  const initialize = async () => {
    try {
      const promptSettings = await electronAPI.getPromptSettings()
      promptStore.setSettings(normalizePromptSettings(promptSettings))
    } catch (error) {
      console.error(t('usePrompt.getPromptFailed'), error)
      promptStore.resetSettings()
    }
  }

  const savePromptSettings = async (nextSettings: PromptSettings) => {
    const normalizedSettings = normalizePromptSettings(nextSettings)

    if (normalizedSettings.errorTypes.length === 0) {
      ElMessage.warning(t('usePrompt.atLeastOneErrorType'))
      return false
    }

    if (normalizedSettings.background === 'custom' && !normalizedSettings.customBackground.trim()) {
      ElMessage.warning(t('usePrompt.inputCustomBackground'))
      return false
    }

    if (normalizedSettings.customPromptEnabled && !normalizedSettings.customPrompt.trim()) {
      ElMessage.warning(t('usePrompt.inputCustomPrompt'))
      return false
    }

    try {
      const result = await electronAPI.setPromptSettings(normalizedSettings)
      if (!result) {
        ElMessage.error(t('usePrompt.saveFailed'))
        return false
      }

      promptStore.setSettings(normalizedSettings)
      ElMessage.success(t('usePrompt.promptUpdated'))
      return true
    } catch (error) {
      console.error('保存提示词配置失败:', error)
      ElMessage.error(t('usePrompt.saveFailed'))
      return false
    }
  }

  const resetToDefault = async () => {
    try {
      const result = await electronAPI.resetPromptSettings()
      if (!result) {
        ElMessage.error(t('usePrompt.resetFailed'))
        return false
      }

      promptStore.resetSettings()
      ElMessage.success(t('usePrompt.resetToDefault'))
      return true
    } catch (error) {
      console.error('恢复默认提示词配置失败:', error)
      ElMessage.error(t('usePrompt.resetFailed'))
      return false
    }
  }

  return {
    settings,
    effectivePrompt,
    modeLabel,
    defaultSettings: clonePromptSettings(DEFAULT_PROMPT_SETTINGS),
    errorTypeOptions: PROMPT_ERROR_TYPE_OPTIONS,
    intensityOptions: PROMPT_INTENSITY_OPTIONS,
    backgroundOptions: PROMPT_BACKGROUND_OPTIONS,
    initialize,
    savePromptSettings,
    resetToDefault
  }
}
