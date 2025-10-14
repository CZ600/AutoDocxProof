// stores/store.ts
import { defineStore, getActivePinia } from 'pinia'

export interface CorrectionResult {
  applied: boolean
  id: string
  original: string
  reason: string
  suggested: string
  type: string
}

export const fileInfoStore = defineStore('fileInfo', {
  state: () => ({
    filePath: '',
    fileName: '',
    proofModel: '',
    results: [] as CorrectionResult[]
  }),

  getters: {
    getFilePath: state => state.filePath,
    getFileName: state => state.fileName,
    getProofModel: state => state.proofModel,
    getResults: state => state.results,
    isFilePathEmpty: state => !state.filePath,
    isFileNameEmpty: state => !state.fileName,
    isProofModelEmpty: state => !state.proofModel,
    isResultsEmpty: state => state.results.length === 0
  },

  actions: {
    setFilePath(filePath: string) {
      this.filePath = filePath
    },
    setFileName(fileName: string) {
      this.fileName = fileName
    },
    setProofModel(proofModel: string) {
      this.proofModel = proofModel
    },
    setCorrectResult(results: CorrectionResult[]) {
      this.results = results
    },
    clearAll() {
      this.filePath = ''
      this.fileName = ''
      this.proofModel = ''
      this.results = []
    }
  },

  // ✅ 关键：启用持久化，字段名必须和 state 一致
  persist: {
    key: 'fileInfo',
    storage: localStorage,
    paths: ['filePath', 'fileName', 'proofModel', 'results'] // ✅ 确保这四个字段都包含
  }
})

export const embeddingSet = defineStore('embeddingSet', {
  state: () => ({
    ActiveRepositoryName: '', // 记录正在查看的仓库名称
    apiURL: '', // api设置等
    apiKey: '',
    modelName: ''
  }),
  getters: {
    getActive: state => state.ActiveRepositoryName,
    getAPIURL: state => state.apiURL,
    getAPIKey: state => state.apiKey,
    getModelName: state => state.modelName
  },
  actions: {
    setActive(activeName: string) {
      this.ActiveRepositoryName = activeName
    },
    setURL(URL: string) {
      this.apiURL = URL
    },
    setKey(Key: string) {
      this.apiKey = Key
    },
    setModelName(Name: string) {
      this.modelName = Name
    },
    clearAll() {
      this.ActiveRepositoryName = ''
      this.apiKey = ''
      this.apiURL = ''
      this.modelName = ''
    }
  },
  // ✅ 关键：启用持久化，字段名必须和 state 一致
  persist: {
    key: 'embeddingSet',
    storage: localStorage,
    paths: ['ActiveRepositoryName', 'apiURL', 'apiKey', 'modelName'] // ✅ 确保这四个字段都包含
  }
})