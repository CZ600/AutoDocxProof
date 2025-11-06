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
  total_tokens: number
  customPrompt: string | null
}

// 默认值作为常量，便于维护
const defaultApiSettings: ApiSettings = {
  id: null,
  URL: '',
  key: '',
  name: '',
  time: '',
  parallel: 30,
  TimeLimit: null,
  total_tokens: 0,
  customPrompt: null
}

export const useApiStore = defineStore(
  'apiSettings',
  () => {
    // 使用默认值初始化
    const selectedApi = reactive<ApiSettings>({ ...defaultApiSettings })

    function setSelectedApi(api: Partial<ApiSettings>) {
      Object.assign(selectedApi, api)
    }

    function clearSelectedApi() {
      Object.assign(selectedApi, defaultApiSettings)
    }

    function setParallel(parallelSet: number) {
      selectedApi.parallel = parallelSet
    }

    function setTimeLimit(TimeLimit: number | null) {
      selectedApi.TimeLimit = TimeLimit
    }

    function setTotalTokens(total_tokens: number) {
      selectedApi.total_tokens = total_tokens
    }

    function addTotalTokens(new_tokens: number) {
      selectedApi.total_tokens += new_tokens
    }

    function setCustomPrompt(prompt: string | null) {
      selectedApi.customPrompt = prompt
    }

    return {
      selectedApi,
      setSelectedApi,
      clearSelectedApi,
      setParallel,
      setTimeLimit,
      setTotalTokens,
      addTotalTokens,
      setCustomPrompt
    }
  },
  {
    persist: {
      key: 'apiSettings',
      storage: localStorage,
      pick: ['selectedApi'] // 明确指定需要持久化的路径
    }
  }
)
