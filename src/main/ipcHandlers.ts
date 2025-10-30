import { ipcMain } from 'electron'
import { dialog } from 'electron'
import { DB } from './database'
import { testAPI } from './chat'
import { proofreadDocument, getDefaultPrompt, setNewPrompt } from './proof'
import { deleteDocumentByName, listFilenamesInRepository } from './lancedb'
import { Mode } from '@google/genai'
import * as mammoth from 'mammoth'
import { replaceTextInDocx } from './wordProcess'
import {
  deleteRepository,
  initLanceDB,
  insertDocument,
  queryDocuments,
  updateDocument,
  deleteDocument,
  listRepositories,
  createRepository
} from './lancedb'
import { processDocument, getPDFDocumentChunks } from './pdfUtils'
import { list } from 'changelog.config'
import { error } from 'console'
import { eventNames, env } from 'process'
// const { platform, arch, env } = process;
export interface apiSettings {
  apiURL: string
  apiKey: string
  modelName: string
}

let api_info: apiSettings = {
  apiURL: '',
  apiKey: '',
  modelName: ''
}

// 全局embedding_api变量已移除，由Pinia store管理
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
  // 更新了对于rag功能的支持，实现了并行操作，提升性能
  ipcMain.handle(
    'process-docx',
    async (event, Model, filePath, repositoryNameList?: string[], embeddingConfig?: apiSettings) => {
      try {
        // 三种校对模式：mode: 'section' | 'sentence' | 'full',
        console.log(
          '-----------------------------------------------processing docx file-------------------------------------------------------'
        )
        console.info('Processing settings:', Model, filePath)
        console.info('embedding settings:', repositoryNameList, embeddingConfig)

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
          const res = await proofreadDocument(
            filePath,
            'sentence',
            api_info.apiKey,
            api_info.modelName,
            api_info.apiURL,
            repositoryNameList,
            embeddingConfig
          )
          // 确保返回的数据是可克隆的
          try {
            return JSON.parse(JSON.stringify(res))
          } catch (error) {
            console.error('序列化校对结果时出错:', error)
            return []
          }
        } else if (Model === 'ComprehensiveError') {
          console.log('will process by the model:', api_info.apiKey, api_info.apiURL, api_info.modelName)
          const res = await proofreadDocument(
            filePath,
            'section',
            api_info.apiKey,
            api_info.modelName,
            api_info.apiURL,
            repositoryNameList,
            embeddingConfig
          )
          // 确保返回的数据是可克隆的
          try {
            return JSON.parse(JSON.stringify(res))
          } catch (error) {
            console.error('序列化校对结果时出错:', error)
            return []
          }
        } else if (Model === 'polish') {
          console.log('will process by the model:', api_info.apiKey, api_info.apiURL, api_info.modelName)
          const res = await proofreadDocument(
            filePath,
            'full',
            api_info.apiKey,
            api_info.modelName,
            api_info.apiURL,
            repositoryNameList,
            embeddingConfig
          )
          // 确保返回的数据是可克隆的
          try {
            return JSON.parse(JSON.stringify(res))
          } catch (error) {
            console.error('序列化校对结果时出错:', error)
            return []
          }
        }
      } catch (error) {
        console.error('处理文档校对请求时出错:', error)
        return {
          isSuccess: false,
          message: `处理文档校对请求时出错: ${error.message}`
        }
      }
    }
  )

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
      // 确保传递的数据是可克隆的
      const serializableConfig = JSON.parse(JSON.stringify(config))

      const filePath = serializableConfig.originalFilePath
      const newPath = filePath.replace(/(\.\w+)$/, '_new$1') // 正则捕获“最后一个点+扩展名”
      const correctedText = serializableConfig.appliedCorrections.map((correction: Correction) => ({
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
  // 获取默认提示词
  ipcMain.handle('getDefaultPrompt', async event => {
    const prompt = await getDefaultPrompt()
    return prompt
  })
  // 设置提示词（注意，这里设置的提示词没有长期记忆功能，只能暂时设置
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
  // 历史记录 - 获取全部的历史记录
  ipcMain.handle('getAllHistory', async event => {
    const result = await DB.getALLHistory()
    if (result) {
      return result
    } else {
      throw new Error('No history found!')
    }
  })
  // 历史记录 - 删除全部的历史记录
  ipcMain.handle('deleteAllHistory', async event => {
    const result = await DB.deleteALLHistory()
    if (result) {
      return true
    } else {
      throw new Error('delete history failed!')
    }
  })
  // 历史记录 - 根据id查询记录
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
  // 历史记录- 插入一条数据
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
  //----------------------------------------The implementation of this RAG----------------------------------------
  // 向量数据库 - 插入文档
  ipcMain.handle('lancedb:insert', async (event, { repositoryName, fileName, text, id, metadata }, modelConfig) => {
    return insertDocument(
      repositoryName,
      text,
      fileName,
      metadata,
      modelConfig.modelName,
      modelConfig.apiKey,
      modelConfig.apiURL
    )
  })

  // 向量数据库 - 查询文档
  ipcMain.handle('lancedb:query', async (event, { queryText, limit, filter, fileName }, modelConfig) => {
    return queryDocuments(
      queryText,
      modelConfig.modelName,
      modelConfig.apiKey,
      modelConfig.apiURL,
      limit,
      filter,
      fileName
    )
  })

  // 向量数据库 - 更新文档
  ipcMain.handle('lancedb:update', async (event, { repositoryName, id, text, metadata }, modelConfig) => {
    return updateDocument(
      repositoryName,
      id,
      text,
      metadata,
      modelConfig.modelName,
      modelConfig.apiKey,
      modelConfig.apiURL
    )
  })

  // 向量数据库 - 删除文档
  ipcMain.handle('lancedb:delete', async (event, { repositoryName, id }) => {
    return deleteDocument(repositoryName, id)
  })
  // get all the tables(lancedb)
  // 向量数据库 - 查询所有的表
  ipcMain.handle('listRepositories', async event => {
    const result = await listRepositories()
    return result
  })
  // 向量数据库 - 创建一个空的知识表
  ipcMain.handle('createRepository', async (event, { repositoryName, modelName, apiKey, apiURL }) => {
    try {
      await createRepository(repositoryName, modelName, apiKey, apiURL)
      return true
    } catch (error) {
      console.log('error when create a empty repository:', error)
      throw error
    }
  })
  // 向量数据库 - 删除整个表（单个知识库）
  ipcMain.handle('deleteRepository', (event, repositoryName: string) => {
    try {
      deleteRepository(repositoryName)
      return true
    } catch (error) {
      console.log('failed to delete ${repositoryName} because:', error)
      throw error
    }
  })
  // 向量数据库 -

  // IPC处理器 - 处理PDF文件(弃用)
  ipcMain.handle('pdf:process', async (event, { repositoryName, filePath }, modelConfig) => {
    try {
      return await processDocument(
        repositoryName,
        filePath,
        undefined, // 自动生成documentId
        500, // 默认chunk大小
        50, // 默认重叠大小
        modelConfig.modelName,
        modelConfig.apiKey,
        modelConfig.apiURL
      )
    } catch (error) {
      console.error('Failed to process PDF:', error)
      throw error
    }
  })

  // IPC处理器 - 选择并处理文档文件
  ipcMain.handle('pdf:select-and-process', async (event, repositoryName, modelConfig) => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Document Files', extensions: ['pdf', 'docx', 'txt'] }]
    })

    if (!filePaths || filePaths.length === 0) {
      console.log('User selected nothing!')
      return false
    }

    try {
      return await processDocument(
        repositoryName,
        filePaths[0],
        '', // 自动生成documentId
        500,
        50,
        modelConfig.modelName,
        modelConfig.apiKey,
        modelConfig.apiURL
      )
    } catch (error) {
      console.error('Document processing failed:', error)
      throw error
    }
  })

  // IPC处理器 - 获取PDF文档的所有段落
  ipcMain.handle('pdf:get-chunks', async (event, { documentId, repositoryName }) => {
    return getPDFDocumentChunks(repositoryName, documentId)
  })
  // 根据指定的文件名称，删除该名称下的所有文档块
  ipcMain.handle('deleteDocumentByName', async (event, repositoryName, filename) => {
    const deleteFileName = await deleteDocumentByName(repositoryName, filename)
    if (deleteFileName) {
      return deleteFileName
    } else {
      throw error('delete the file ${repositoryName} error')
    }
  })
  // 获取不重复的文件列表
  ipcMain.handle('listFilenamesInRepository', async (event, repositoryName) => {
    const fileList = await listFilenamesInRepository(repositoryName)
    return fileList
  })
  // 设置embedding模型 - 通过其他机制由前端Pinia store管理，不再需要此IPC处理
  // ipcMain.handle('setEmbeddingAPI', ...) 已移除

  // 获取embedding模型信息 - 通过其他机制由前端Pinia store管理，不再需要此IPC处理
  // ipcMain.handle('getEmbeddingAPI', ...) 已移除
  // 调试用接口
  ipcMain.handle('getEnvPath', async event => {
    console.log(' env.LANCEDB_NATIVE_PATH:', env.LANCEDB_NATIVE_PATH)
    return env.LANCEDB_NATIVE_PATH
  })
}
