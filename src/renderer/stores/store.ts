// stores/store.ts
import { defineStore } from 'pinia'

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
