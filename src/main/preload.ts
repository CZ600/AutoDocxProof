import { contextBridge, ipcRenderer } from 'electron'
import { get } from 'http'
import test from 'node:test'
import { setNewPrompt } from './proof'

console.log('this message from the preload')

// contextBridge.exposeInMainWorld 是一个安全机制，它允许你在预加载脚本中定义一些函数或对象，并将它们注入到网页的全局 window 对象中。
// 第一个参数 electronAPI 表示将要挂载到window上的属性名称
// 第二个参数，是一个对象，包含了想要暴露给前端的函数或者值
contextBridge.exposeInMainWorld('electronAPI', {
  // 定义了一个名叫message的方法，接受字符串参数message
  message: (message: string) => {
    // 向主进程发送消息，单向通信方式
    // 发送的消息，通道名称是message，数据是传入的message的字符串
    ipcRenderer.send('message', message) // 调用主进程的接口，向主进程发送一条 *异步* 消息
  },
  // 定义了一个名叫receiveAndReturn的方法，接受字符串参数message，然后返回一个字符串
  receiveAndReturn: (message: string) => {
    // 使用ipcRenderer.invoke()方法，调用主进程的接口，向主进程发送一条 *双向通讯请求* 的消息 （也是异步）
    // 向主进程发送消息，并返回处理结果，双向通信方式
    return ipcRenderer.invoke('receiveAndReturn', message) // invoke会等待主进程使用ipcMain。handle 返回一个promise的值
    // 由于返回的是一个promise 所以前端需要await它
  },
  test: process.version,

  selectDocxFile: () => ipcRenderer.invoke('select-docx-file'),
  // 可选：如果需要主进程读取文件内容
  readDocxFile: (filePath: string) => ipcRenderer.invoke('read-docx-file', filePath),
  APISettings: (url: string, key: string, modelName: string) => ipcRenderer.invoke('set-api', url, key, modelName),
  getALLAPISettings: () => ipcRenderer.invoke('get-all-api-settings', {}),
  deleteOneAPI: (id: number) => ipcRenderer.invoke('delete-one-api-setting', id),
  testAPI: (url: string, key: string, modelName: string) => ipcRenderer.invoke('test-api', url, key, modelName),
  selectAPISetting: (url: string, key: string, modelName: string) =>
    ipcRenderer.invoke('selectAPISetting', url, key, modelName),
  getAPISettings: () => ipcRenderer.invoke('get-api-settings', {}),
  processDocx: (model: string, filePath: string) => ipcRenderer.invoke('process-docx', model, filePath),

  // 导出修正到文件中
  exportCorrectedDocx: (config: any) => ipcRenderer.invoke('exportCorrectedDocx', config),
  // 获取默认的提示词
  getDefaultPrompt: () => ipcRenderer.invoke('getDefaultPrompt'),
  // 设置新的提示词
  setNewPrompt: (prompt: string) => ipcRenderer.invoke('setPrompt', prompt),
  // 获取所有历史记录
  deleteAllHistory: () => ipcRenderer.invoke('deleteAllHistory'),
  // 获取所有历史记录
  getAllHistory: () => ipcRenderer.invoke('getAllHistory'),
  // 获取指定id的历史记录
  getHistoryById: (id: number) => ipcRenderer.invoke('getHistoryById', id),
  // 删除指定id的历史记录,
  deleteHistoryById: (id: number) => ipcRenderer.invoke('deleteHistoryById', id),
  // 插入一条历史记录
  insertOneHistory: (filePath: string, apiURL: string, modelName: string, resultCorrect: string) =>
    ipcRenderer.invoke('insertOneHistory', filePath, apiURL, modelName, resultCorrect)
})
