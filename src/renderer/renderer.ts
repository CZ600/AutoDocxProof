import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// 引入 Element Plus 组件库和样式
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
// 引入中文语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn' // 根据需要选择语言
const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(router)
app.use(pinia)
// 使用 Element Plus
app.use(ElementPlus, {
  locale: zhCn
})

app.mount('#app')
