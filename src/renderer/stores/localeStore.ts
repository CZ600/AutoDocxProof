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
      this.syncLocale()
    },
    // 仅把当前 locale 同步到主进程，不修改状态/i18n。
    // 用于应用启动时把 localStorage 中持久化的 locale 推给主进程，
    // 保证主进程 currentLocale 与渲染进程一致（避免首次校对用错语言提示词）。
    syncLocale() {
      try {
        window.electronAPI?.sendLocale?.(this.locale)
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
