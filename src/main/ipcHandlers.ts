import { ipcMain } from 'electron'
import { dialog } from 'electron'
import { DB } from './database'

interface apiSettings {
  apiURL: string
  apiKey: string
  modelName: string
}

let api_info: apiSettings = {
  apiURL: '',
  apiKey: '',
  modelName: ''
}

export const registerIpcHandlers = () => {
  // 单向通信：接收渲染进程的消息
  // 监听消息，通道是message
  ipcMain.on('message', (event, message: string) => {
    console.log('Received message', message)
  })

  // 双向通信：接收渲染进程的消息，并返回结果
  ipcMain.handle('receiveAndReturn', (event, message: string) => {
    console.log('receiveAndReturn', message)

    // 想返回什么都可以
    const ret = {
      rawData: message,
      newData: `neight-peiqi：${message}`
    }
    return ret
  })
  const path = require('path')
  const fs = require('fs')
  // 处理文件选择请求
  ipcMain.handle('select-docx-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择 DOCX 文件',
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      // 返回文件路径
      return result.filePaths[0]
    } catch (error) {
      console.error('文件选择错误:', error)
      throw error
    }
  })

  // 处理文件读取请求（可选，如果需要主进程读取文件内容）
  ipcMain.handle('read-docx-file', async (event, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath)
      return {
        path: filePath,
        content: data.toString('base64')
      }
    } catch (error) {
      console.error('文件读取错误:', error)
      throw error
    }
  })

  ipcMain.handle('set-api', async (event, URL, Key, modelName) => {
    try {
      console.log(URL, Key, modelName)
      api_info.apiKey = Key
      api_info.apiURL = URL
      api_info.modelName = modelName
      return 'success'
    } catch (error) {
      return 'error'
    }
  })
  ipcMain.handle('get-api-settings', async event => {
    return {
      URL: api_info.apiURL,
      Key: api_info.apiKey,
      modelName: api_info.modelName
    }
  })
  ipcMain.handle('delete-one-api', async event => {
    return 'success'
  })
}
