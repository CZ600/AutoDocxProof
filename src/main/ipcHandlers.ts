import { ipcMain } from 'electron'
import { dialog } from 'electron'
import { DB } from './database'
import { testAPI } from './chat'
import { proofreadDocument } from './proof'
import { Mode } from '@google/genai'
import * as mammoth from 'mammoth'
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
      console.log('add a new api setting:', URL, Key, modelName)
      api_info.apiKey = Key
      api_info.apiURL = URL
      api_info.modelName = modelName
      const result = await DB.insertAPISetting(URL, Key, modelName)
      console.log('the result of the new api setting adding:', result)
      if (result) {
        return 'success'
      } else {
        return 'error'
      }
    } catch (error) {
      return 'error'
    }
  })
  // 获取所有api设置
  ipcMain.handle('get-all-api-settings', async event => {
    return await DB.getAllAPISettings()
  })

  ipcMain.handle('delete-one-api-setting', async (event, id) => {
    const result = await DB.deleteAPISettingById(id)
    if (result) {
      return {
        isSuccess: true
      }
    } else {
      return {
        isSuccess: false
      }
    }
  })

  ipcMain.handle('test-api', async (event, URL, Key, modelName) => {
    if (!URL || !Key || !modelName) {
      console.log('Please input all the parameters!')
      return false
    } else {
      console.log('Testing API:', URL, Key, modelName)
    }
    const result = await testAPI(URL, Key, modelName)
    return result
  })

  ipcMain.handle('selectAPISetting', async (event, URL, Key, modelName) => {
    api_info.apiKey = Key
    api_info.apiURL = URL
    api_info.modelName = modelName
    console.log('Selected API:', URL, Key, modelName)
    return true
  })

  ipcMain.handle('get-api-settings', async event => {
    return {
      URL: api_info.apiURL,
      Key: api_info.apiKey,
      modelName: api_info.modelName
    }
  })

  // 处理文档校对请求
  ipcMain.handle('process-docx', async (event, Model, filePath) => {
    // 三种校对模式：mode: 'section' | 'sentence' | 'full',
    console.log('Processing DOCX file:', Model, filePath)
    if (!Model || !filePath) {
      return {
        isSuccess: false,
        message: 'Please select a model and a file!'
      }
    }
    if (Model === 'wordError') {
      console.log('will process by the model:', api_info.apiKey, api_info.apiURL, api_info.modelName)
      const res = await proofreadDocument(filePath, 'sentence', api_info.apiKey, api_info.modelName, api_info.apiURL)
      return res
    } else if (Model === 'ComprehensiveError') {
      console.log('will process by the model:', api_info.apiKey, api_info.apiURL, api_info.modelName)
      const res = await proofreadDocument(filePath, 'section', api_info.apiKey, api_info.modelName, api_info.apiURL)
      return res
    } else if (Model === 'polish') {
      console.log('will process by the model:', api_info.apiKey, api_info.apiURL, api_info.modelName)
      const res = await proofreadDocument(filePath, 'full', api_info.apiKey, api_info.modelName, api_info.apiURL)
      return res
    }
  })
  interface Correction {
    original: string
    suggested: string
  }

  // 导出修正后的DOCX文件
  ipcMain.handle('exportCorrectedDocx', async (event, config) => {
    try {
      // 1. 弹出保存对话框
      const { filePath } = await dialog.showSaveDialog({
        title: '导出修正后的文档',
        defaultPath: config.fileName.replace(/\.docx?$/, '_corrected.docx'),
        filters: [{ name: 'DOCX Files', extensions: ['docx'] }]
      })

      if (!filePath) return false // 用户取消

      // 2. 读取原始文档
      const originalBuffer = fs.readFileSync(config.originalFilePath)

      // 3. 使用mammoth提取原始文本
      const { value: originalText } = await mammoth.extractRawText({ buffer: originalBuffer })

      // 4. 应用校对修改
      let correctedText = originalText
      config.appliedCorrections.forEach((correction: Correction) => {
        // 替换第一个匹配项（考虑空格敏感问题）
        const regex = new RegExp(correction.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        correctedText = correctedText.replace(regex, correction.suggested)
      })

      // 5. 生成新的DOCX文件（简化版，实际需要更复杂的DOCX操作）
      // 这里需要使用docx库生成真正的DOCX文件
      // 以下为简化示例，实际项目应使用docx库

      // 6. 保存文件
      fs.writeFileSync(filePath, correctedText) // 注意：这里需要生成真正的DOCX

      return true
    } catch (error) {
      console.error('导出错误:', error)
      throw error
    }
  })
}
