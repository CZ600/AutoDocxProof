import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'

export const i18n = createI18n({
  legacy: false,
  fallbackWarn: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en
  }
})

export function setupI18n() {
  return i18n
}
