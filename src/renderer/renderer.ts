import { createApp, computed } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import './assets/css/common.css'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { setupI18n } from './i18n'
import { useLocaleStore } from './stores/localeStore'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(router)
app.use(pinia)

const i18n = setupI18n()
app.use(i18n)

const localeStore = useLocaleStore()
i18n.global.locale.value = localeStore.locale

const elementLocale = computed(() => {
  return localeStore.locale === 'en' ? en : zhCn
})

app.use(ElementPlus)

app.mount('#app')
