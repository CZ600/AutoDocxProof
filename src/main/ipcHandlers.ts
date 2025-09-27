import { ipcMain } from 'electron'
import { dialog } from 'electron'
import { DB } from './database'
import { testAPI } from './chat'
import { proofreadDocument, getDefaultPrompt, setNewPrompt } from './proof'
import { Mode } from '@google/genai'
import * as mammoth from 'mammoth'
import { replaceTextInDocx } from './wordProcess'
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
      newData: `neight-peiqi${message}`
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
      console.error('cannot read file:', error)
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

    if (!api_info.apiKey || !api_info.apiURL || !api_info.modelName) {
      return {
        isSuccess: false,
        message: 'Please select an API setting!'
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

  // 新增的返回值形式
  interface ResponseData<T = any> {
    success: boolean
    message: string
    data?: T
  }

  interface Correction {
    original: string
    suggested: string
  }

  // 导出修正后的DOCX文件
  ipcMain.handle('exportCorrectedDocx', async (event, config) => {
    try {
      const filePath = config.originalFilePath
      const newPath = filePath.replace(/(\.\w+)$/, '_new$1') // 正则捕获“最后一个点+扩展名”
      const correctedText = config.appliedCorrections.map((correction: Correction) => ({
        origin: correction.original,
        suggested: correction.suggested
      }))

      await replaceTextInDocx(filePath, newPath, correctedText)
      return true
    } catch (error) {
      console.error('output error:', error)
      throw error
    }
  })

  ipcMain.handle('getDefaultPrompt', async event => {
    const prompt = await getDefaultPrompt()
    return prompt
  })

  ipcMain.handle('setPrompt', async (event, newPrompt) => {
    if (newPrompt) {
      const result = await setNewPrompt(newPrompt)
      if (result) {
        return true
      } else {
        return false
      }
    } else {
      throw new Error('Please input a prompt!')
    }
  })
  // 获取全部的历史记录
  ipcMain.handle('getAllHistory', async event => {
    const result = await DB.getALLHistory()
    if (result) {
      return result
    } else {
      throw new Error('No history found!')
    }
  })
  // 删除全部的历史记录
  ipcMain.handle('deleteAllHistory', async event => {
    const result = await DB.deleteALLHistory()
    if (result) {
      return true
    } else {
      throw new Error('delete history failed!')
    }
  })
  ipcMain.handle('getHistoryById', async (event, id) => {
    if (id) {
      const result = await DB.getHistoryById(id)
      if (result) {
        return result
      } else {
        throw new Error('No history found by id: ${id}')
      }
    }
  })

  ipcMain.handle('deleteHistoryById', async (event, id) => {
    try {
      const result = await DB.deleteHistoryById(id)
      return result
    } catch (error) {
      console.error('删除历史记录失败:', error)
      return false
    }
  })

  ipcMain.handle(
    'insertOneHistory',
    async (event, filePath: string, apiURL: string, modelName: string, resultCorrect: string) => {
      try {
        // 参数验证
        if (!filePath || !apiURL || !modelName || !resultCorrect) {
          const errorMsg =
            '参数不完整: ' + JSON.stringify({ filePath, apiURL, modelName, resultCorrect: !!resultCorrect })
          console.error(errorMsg)
          return { success: false, error: errorMsg }
        }

        // 尝试解析JSON以验证数据有效性
        try {
          JSON.parse(resultCorrect)
        } catch (parseError) {
          const errorMsg = 'resultCorrect不是有效的JSON字符串: ' + parseError.message
          console.error(errorMsg)
          return { success: false, error: errorMsg }
        }

        const result = await DB.insertOneHistory(filePath, apiURL, modelName, resultCorrect)
        return { success: true, id: result }
      } catch (error) {
        console.error('插入历史记录失败:', error)
        return { success: false, error: error.message }
      }
    }
  )
}
