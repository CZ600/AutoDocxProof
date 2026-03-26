import { computed } from 'vue'
import { ElMessage } from 'element-plus'
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
      console.error('获取提示词配置失败:', error)
      promptStore.resetSettings()
    }
  }

  const savePromptSettings = async (nextSettings: PromptSettings) => {
    const normalizedSettings = normalizePromptSettings(nextSettings)

    if (normalizedSettings.errorTypes.length === 0) {
      ElMessage.warning('请至少选择一种错误类型')
      return false
    }

    if (normalizedSettings.background === 'custom' && !normalizedSettings.customBackground.trim()) {
      ElMessage.warning('请输入自定义背景说明')
      return false
    }

    if (normalizedSettings.customPromptEnabled && !normalizedSettings.customPrompt.trim()) {
      ElMessage.warning('请输入自定义提示词')
      return false
    }

    try {
      const result = await electronAPI.setPromptSettings(normalizedSettings)
      if (!result) {
        ElMessage.error('保存失败')
        return false
      }

      promptStore.setSettings(normalizedSettings)
      ElMessage.success('提示词配置已更新')
      return true
    } catch (error) {
      console.error('保存提示词配置失败:', error)
      ElMessage.error('保存失败')
      return false
    }
  }

  const resetToDefault = async () => {
    try {
      const result = await electronAPI.resetPromptSettings()
      if (!result) {
        ElMessage.error('恢复失败')
        return false
      }

      promptStore.resetSettings()
      ElMessage.success('已恢复默认配置')
      return true
    } catch (error) {
      console.error('恢复默认提示词配置失败:', error)
      ElMessage.error('恢复失败')
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
