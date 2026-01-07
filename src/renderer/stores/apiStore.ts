// stores/apiStore.ts
import { defineStore } from 'pinia'
import { reactive } from 'vue'

interface ApiSettings {
  id: number | null
  URL: string
  key: string
  name: string
  time: string
  parallel: number
  TimeLimit: number | null
}

interface ApiSettingItem {
  id: number
  apiURL: string
  apiKey: string
  modelName: string
}

interface TokenUsage {
  totalTokens: number
  requestCount: number
  lastResetTime: string
}

// 默认值作为常量，便于维护
const defaultApiSettings: ApiSettings = {
  id: null,
  URL: '',
  key: '',
  name: '',
  time: '',
  parallel: 30,
  TimeLimit: undefined
}

// 默认 token 使用统计
const defaultTokenUsage: TokenUsage = {
  totalTokens: 0,
  requestCount: 0,
  lastResetTime: new Date().toISOString()
}

export const useApiStore = defineStore(
  'apiSettings',
  () => {
    // 使用默认值初始化
    const selectedApi = reactive<ApiSettings>({ ...defaultApiSettings })
    const tokenUsage = reactive<TokenUsage>({ ...defaultTokenUsage })

    // API 设置列表
    const apiSettings = reactive<ApiSettingItem[]>([])

    function setSelectedApi(api: Partial<ApiSettings>) {
      Object.assign(selectedApi, api)
    }

    function clearSelectedApi() {
      Object.assign(selectedApi, defaultApiSettings)
    }

    function setParallel(parallelSet: number) {
      selectedApi.parallel = parallelSet
    }

    function setTimeLimit(TimeLimit: number) {
      selectedApi.TimeLimit = TimeLimit
    }

    // API 设置列表相关方法
    function setApiSettings(settings: ApiSettingItem[]) {
      apiSettings.splice(0, apiSettings.length)
      settings.forEach(item => apiSettings.push(item))
    }

    function addApiSetting(setting: ApiSettingItem) {
      const index = apiSettings.findIndex(s => s.id === setting.id)
      if (index !== -1) {
        apiSettings[index] = setting
      } else {
        apiSettings.push(setting)
      }
    }

    function removeApiSetting(id: number) {
      const index = apiSettings.findIndex(s => s.id === id)
      if (index !== -1) {
        apiSettings.splice(index, 1)
      }
    }

    // Token 相关方法
    /**
     * 添加 token 使用量
     * @param tokens - 本次使用的 token 数量
     */
    function addTotalTokens(tokens: number) {
      tokenUsage.totalTokens += tokens
      tokenUsage.requestCount += 1
    }

    /**
     * 重置 token 统计
     */
    function resetTokenUsage() {
      Object.assign(tokenUsage, defaultTokenUsage) // 重置整个tokenUsage对象的参数
      tokenUsage.lastResetTime = new Date().toISOString()
    }

    /**
     * 获取 token 使用统计
     */
    function getTokenUsage(): TokenUsage {
      return { ...tokenUsage }
    }

    /**
     * 设置 token 使用量（用于从存储恢复）
     */
    function setTokenUsage(usage: Partial<TokenUsage>) {
      Object.assign(tokenUsage, usage)
    }

    return {
      selectedApi,
      tokenUsage,
      apiSettings,
      setSelectedApi,
      clearSelectedApi,
      setParallel,
      setTimeLimit,
      setApiSettings,
      addApiSetting,
      removeApiSetting,
      addTotalTokens,
      resetTokenUsage,
      getTokenUsage,
      setTokenUsage
    }
  },
  {
    persist: {
      key: 'apiSettings',
      storage: localStorage,
      pick: ['selectedApi', 'tokenUsage'] // 持久化 token 使用统计
    }
  }
)
