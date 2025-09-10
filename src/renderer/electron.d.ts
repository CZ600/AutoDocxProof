/**
 * Electron API 类型支持应与 preload.ts 中的API一致
 * 你需要告诉 TypeScript,windows 类型中心增加的属性和接口情况
 * 防止运行时错误
 */
export default interface ElectronApi {
  message: (file: string) => void
  receiveAndReturn: (characters: string) => string
  test: string
  selectDocxFile: () => string
  readDocxFile: (filePath: string) => {
    path: string
    content: string
  }
  APISettings: (URL: string, Key: string, modelName: string) => {}
  getAPISettings: () => {
    URL: string
    Key: string
    modelName: string
  }
  deleteOneAPI: (id: string) => {
    isSuccess: boolean
  }
}

declare global {
  interface Window {
    electronAPI: ElectronApi
  }
}
