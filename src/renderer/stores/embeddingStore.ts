// stores/embeddingStore.ts
import { defineStore } from 'pinia'

export interface EmbeddingAPIConfig {
  apiURL: string
  apiKey: string
  modelName: string
}

export const useEmbeddingStore = defineStore('embedding', {
  state: () => ({
    config: {
      apiURL: '',
      apiKey: '',
      modelName: ''
    } as EmbeddingAPIConfig,
    activeRepositoryName: '' // 记录正在查看的仓库名称
  }),

  getters: {
    getAPIConfig: (state) => state.config,
    getAPIURL: (state) => state.config.apiURL,
    getAPIKey: (state) => state.config.apiKey,
    getModelName: (state) => state.config.modelName,
    getActiveRepositoryName: (state) => state.activeRepositoryName,
    isConfigured: (state) => state.config.apiURL && state.config.apiKey && state.config.modelName
  },

  actions: {
    setConfig(config: EmbeddingAPIConfig) {
      this.config = { ...config }
    },
    
    setAPIURL(url: string) {
      this.config.apiURL = url
    },
    
    setAPIKey(key: string) {
      this.config.apiKey = key
    },
    
    setModelName(name: string) {
      this.config.modelName = name
    },
    
    setActiveRepositoryName(name: string) {
      this.activeRepositoryName = name
    },
    
    clearAll() {
      this.config.apiURL = ''
      this.config.apiKey = ''
      this.config.modelName = ''
      this.activeRepositoryName = ''
    }
  },

  persist: {
    key: 'embeddingConfig',
    storage: localStorage,
    paths: ['config', 'activeRepositoryName']
  }
})
