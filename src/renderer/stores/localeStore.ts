import { defineStore } from 'pinia'
import { i18n } from '../i18n'

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: 'zh-CN' as 'zh-CN' | 'en'
  }),

  getters: {
    currentLocale: state => state.locale
  },

  actions: {
    setLocale(locale: 'zh-CN' | 'en') {
      this.locale = locale
      i18n.global.locale.value = locale
      try {
        window.electronAPI?.sendLocale?.(locale)
      } catch {
        // ignore IPC errors
      }
    }
  },

  persist: {
    key: 'locale',
    storage: localStorage,
    pick: ['locale']
  }
})
