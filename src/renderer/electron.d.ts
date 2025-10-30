/**
 * Electron API 类型支持应与 preload.ts 中的API一致
 * 你需要告诉 TypeScript,windows 类型中心增加的属性和接口情况
 * 防止运行时错误
 */
import { proofreadLargeDocument, ProofreadingCorrection } from './proof'
import { apiSettings } from './ipcHandlers'

export interface proofHistory {
  id?: number
  filePath: string
  apiURL: string
  modelName: string
  created_at?: string
  result: string
}

// LanceDB 相关接口类型定义
export interface LanceDBInsertParams {
  repositoryName: string
  fileName: string
  text: string
  metadata: Record<string, any>
}

export interface LanceDBQueryParams {
  queryText: string
  limit: number
  filter: string
  fileName: string
}

export interface LanceDBUpdateParams {
  repositoryName: string
  id: number
  text: string
  metadata: Record<string, any>
}

export interface LanceDBDeleteParams {
  repositoryName: string
  id: number
}

export interface ModelConfig {
  modelName: string
  apiKey: string
  apiURL: string
}

export interface PDFProcessParams {
  repositoryName: string
  filePath: string
  metadata: Record<string, any>
}

export interface PDFSelectAndProcessParams {
  repositoryName: string
  metadata: Record<string, any>
}

export interface PDFGetChunksParams {
  documentId: string
  repositoryName: string
}

export default interface ElectronApi {
  // test
  message: (file: string) => void
  receiveAndReturn: (characters: string) => string
  test: string
  // 文档加载
  selectDocxFile: () => string
  readDocxFile: (filePath: string) => {
    path: string
    content: string
  }
  // api设置和管理（接入数据库）
  APISettings: (URL: string, Key: string, modelName: string) => {}
  getAPISettings: () => {
    URL: string
    Key: string
    modelName: string
  }
  deleteOneAPI: (id: number) => {
    isSuccess: boolean
  }
  getALLAPISettings: () => {
    id: number
    URL: string
    Key: string
    modelName: string
    created_at: string
  }[]
  testAPI: (url: string, key: string, modelName: string) => boolean
  selectAPISetting: (url: string, key: string, modelName: string) => boolean
  getAPISettings: () => {
    URL: string
    Key: string
    modelName: string
  }

  // 文档处理接口
  processDocx: (
    model: string,
    filePath: string,
    repositoryNameList?: string,
    embeddingConfig?: apiSettings
  ) => Promise<ProofreadingCorrection[]> // 进行了更新
  exportCorrectedDocx: (config: any) => Promise<boolean>

  // 提示词处理接口
  getDefaultPrompt: () => string
  setNewPrompt: (newPrompt: string) => Promise<boolean>

  // 历史记录接口
  getAllHistory: () => proofHistory[]
  deleteAllHistory: () => Promise<boolean>
  getHistoryById: (id: number) => Promise<proofHistory | null>
  deleteHistoryById: (id: number) => Promise<boolean>
  insertOneHistory: (filePath: string, apiURL: string, modelName: string, resultCorrect: string) => Promise<boolean>

  // LanceDB 相关接口
  lancedbInsert: (params: LanceDBInsertParams, modelConfig: ModelConfig) => Promise<any>
  lancedbQuery: (params: LanceDBQueryParams, modelConfig: ModelConfig) => Promise<any>
  lancedbUpdate: (params: LanceDBUpdateParams, modelConfig: ModelConfig) => Promise<any>
  lancedbDelete: (params: LanceDBDeleteParams) => Promise<any>
  listRepositories: () => Promise<string[]>
  createRepository: (params: {
    repositoryName: string
    modelName: string
    apiKey: string
    apiURL: string
  }) => Promise<boolean>
  deleteRepository: (repositoryName: string) => Promise<boolean>
  deleteDocumentByName: (repositoryName: string, filename: string) => Promise<string>
  listFilenamesInRepository: (repositoryName: string) => Promise<string[]>

  // PDF 处理相关接口
  processPDF: (params: PDFProcessParams, modelConfig: ModelConfig) => Promise<any>
  selectAndProcessPDF: (repositoryName: string, modelConfig: ModelConfig) => Promise<any> // 支持处理pdf、txt、docx文件
  getPDFChunks: (params: PDFGetChunksParams) => Promise<any>
  // 设置embedding api
  getEmbeddingAPI: () => Promise<{ URL: string; Key: string; modelName: string }>
  setEmbeddingAPI: (apiKey: string, apiURL: string, modelName: string) => Promise<boolean>
  getEnvPath: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronApi
  }
}
