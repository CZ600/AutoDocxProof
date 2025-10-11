import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import * as lancedb from '@lancedb/lancedb'
import { readFile } from 'node:fs/promises'
import { insertDocument, getOrCreateTable, initLanceDB } from './lancedb'

// 使用动态导入方式导入 uuid
let uuidv4: any

async function initializeUUID() {
  if (!uuidv4) {
    const uuidModule = await import('uuid')
    uuidv4 = uuidModule.v4
  }
  return uuidv4
}
// const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath)
    return stats.isFile()
  } catch (error) {
    return false
  }
}

/**
 * 读取PDF文件内容
 * 使用pdf-parse库解析PDF内容，这是Node.js环境中解析PDF的标准方法 [[8]]
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    throw new Error(`PDF file not found at path: ${filePath}`)
  }

  try {
    // 直接导入pdf-parse而不是动态导入
    const pdfParse = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
    const dataBuffer = await readFile(filePath)
    // 使用正确的API调用方式
    const data = await pdfParse(dataBuffer)
    return data.text
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error(`Failed to extract text from PDF: ${error.message}`)
  }
}

/**
 * 将长文本分割成适合embedding的段落
 * @param text PDF提取的完整文本
 * @param maxChunkSize 每个块的最大字符数（默认500）
 * @param overlap 重叠字符数（确保段落间有上下文关联）
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number = 500, overlap: number = 50): string[] {
  // 参数验证
  if (maxChunkSize <= 0) {
    throw new Error('maxChunkSize must be greater than 0')
  }
  if (overlap < 0) {
    throw new Error('overlap cannot be negative')
  }
  if (overlap >= maxChunkSize) {
    throw new Error('overlap must be less than maxChunkSize')
  }

  const chunks: string[] = []

  // 如果文本为空，直接返回空数组
  if (!text || text.trim().length === 0) {
    return chunks
  }

  // 清理多余空格和换行
  const cleanText = text.replace(/\s+/g, ' ').trim()
  const textLength = cleanText.length

  let currentPosition = 0
  let lastPosition = -1 // 用于检测无限循环

  while (currentPosition < textLength) {
    // 防止无限循环的安全检查
    if (currentPosition === lastPosition) {
      console.warn('Potential infinite loop detected, forcing progress')
      currentPosition++
      lastPosition = currentPosition
      continue
    }
    lastPosition = currentPosition

    // 计算结束位置
    let endPosition = Math.min(currentPosition + maxChunkSize, textLength)

    // 如果不在文本末尾，尝试找到最近的句子结束点
    if (endPosition < textLength) {
      // 优先在句号、问号、感叹号后分割
      const segment = cleanText.slice(currentPosition, endPosition)
      const sentenceEnd = segment.lastIndexOf('. ')
      const questionEnd = segment.lastIndexOf('? ')
      const exclamationEnd = segment.lastIndexOf('! ')

      const bestEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd)

      if (bestEnd > currentPosition) {
        // 确保找到的结束点在当前段落后
        endPosition = currentPosition + bestEnd + 1 // +1 to include the punctuation
      } else {
        // 如果没有找到句子边界，尝试在空格处分割
        const spaceEnd = segment.lastIndexOf(' ')
        if (spaceEnd > currentPosition) {
          endPosition = currentPosition + spaceEnd
        }
      }
    }

    // 确保至少前进一个字符
    if (endPosition <= currentPosition) {
      endPosition = currentPosition + 1
    }

    const chunk = cleanText.slice(currentPosition, endPosition).trim()

    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // 计算下一个起始位置，考虑重叠部分
    // 确保不会后退
    const nextPosition = endPosition - overlap
    currentPosition = Math.max(nextPosition, currentPosition + 1)
  }

  return chunks
}

/**
 * 处理PDF文件并存入向量数据库
 * @param filePath PDF文件路径
 * @param documentId 文档唯一标识（可选）
 * @param metadata 附加元数据
 * @param chunkSize 段落大小
 * @param overlap 段落重叠大小
 * @param modelName embedding模型名称
 * @param apiKey API密钥
 * @param apiURL API地址
 */
export async function processDocument(
  repositoryName: string,
  filePath: string,
  documentId: string = '',
  chunkSize: number = 500,
  overlap: number = 50,
  modelName: string,
  apiKey: string,
  apiURL: string
) {
  // 初始化 uuid
  const v4 = await initializeUUID()
  if (!documentId) {
    documentId = v4()
  }

  // 1. 提取文本根据文件类型
  const ext = path.extname(filePath).toLowerCase()
  let text: string

  switch (ext) {
    case '.pdf':
      text = await extractTextFromPDF(filePath)
      break
    case '.txt':
      text = await extractTextFromTXT(filePath)
      break
    case '.docx':
      text = await extractTextFromDOCX(filePath)
      break
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }

  // 2. 分割文本为段落
  const chunks = splitTextIntoChunks(text, chunkSize, overlap)

  // 3. 获取文件名作为基础元数据
  const fileName = path.basename(filePath)
  const baseMetadata = {
    source: ext.substring(1),
    fileName,
    filePath,
    documentId,
    totalPages: chunks.length,
    processedAt: new Date().toISOString()
  }

  // 4. 逐段处理并存入数据库
  const results = []
  for (let i = 0; i < chunks.length; i++) {
    const chunkMetadata = {
      ...baseMetadata,
      chunkIndex: i,
      totalChunks: chunks.length,
      chunkId: `${documentId}-${i}`
    }

    // 插入到向量数据库
    const result = await insertDocument(repositoryName, chunks[i], fileName, chunkMetadata, modelName, apiKey, apiURL)

    results.push(result)
  }

  return {
    documentId,
    fileName,
    chunksProcessed: chunks.length,
    results
  }
}

/**
 * 从数据库中检索特定PDF文档的所有段落
 */
export async function getPDFDocumentChunks(repositoryName: string, documentId: string) {
  const tbl = await getOrCreateTable(repositoryName, 'default', 'dummy', 'dummy')
  if (!tbl) throw new Error('Documents table does not exist')

  // 查询特定documentId的所有段落
  const results = await tbl.search([0]).where(`metadata.documentId = '${documentId}'`).toArray()

  // 按chunkIndex排序
  return results
    .map((result: any) => ({
      id: result.id,
      text: result.text,
      score: result._distance,
      metadata: result.metadata
    }))
    .sort((a: any, b: any) => a.metadata.chunkIndex - b.metadata.chunkIndex)
}

/**
 * 读取TXT文件内容
 */
export async function extractTextFromTXT(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    throw new Error(`TXT file not found at path: ${filePath}`)
  }
  const data = await readFile(filePath, 'utf-8')
  return data
}

/**
 * 读取DOCX文件内容
 */
let mammoth: any

async function initializeMammoth() {
  if (!mammoth) {
    const mammothModule = await import('mammoth')
    mammoth = mammothModule
  }
  return mammoth
}

export async function extractTextFromDOCX(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    throw new Error(`DOCX file not found at path: ${filePath}`)
  }
  const mammoth = await initializeMammoth()
  const buffer = await readFile(filePath)
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}
