import { defineStore } from 'pinia'
import {
  clonePromptSettings,
  DEFAULT_PROMPT_SETTINGS,
  PromptSettings
} from '../../shared/promptSettings'

export const usePromptStore = defineStore('promptSettings', {
  state: () => ({
    settings: clonePromptSettings(DEFAULT_PROMPT_SETTINGS) as PromptSettings
  }),

  getters: {
    getSettings: state => state.settings
  },

  actions: {
    setSettings(settings: PromptSettings) {
      this.settings = clonePromptSettings(settings)
    },
    resetSettings() {
      this.settings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS)
    }
  },

  persist: {
    key: 'promptSettings',
    storage: localStorage,
    paths: ['settings']
  }
})
