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
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    throw new Error(`PDF file not found at path: ${filePath}`)
  }

  try {
    const pdfParse = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
    const dataBuffer = await readFile(filePath)
    const data = await pdfParse(dataBuffer)
    return data.text
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error(`Failed to extract text from PDF: ${error.message}`)
  }
}

/**
 * 文本质量检查配置
 */
interface TextQualityConfig {
  minChunkLength: number // 最小chunk长度
  minWordCount: number // 最小单词数
  maxPunctuationRatio: number // 最大标点符号比例
  minAlphanumericRatio: number // 最小字母数字比例
}

const DEFAULT_QUALITY_CONFIG: TextQualityConfig = {
  minChunkLength: 20, // 至少20个字符
  minWordCount: 3, // 至少3个单词
  maxPunctuationRatio: 0.5, // 标点符号不超过50%
  minAlphanumericRatio: 0.3 // 字母数字至少30%
}

/**
 * 检查文本片段是否有效
 */
function isValidChunk(text: string, config: TextQualityConfig = DEFAULT_QUALITY_CONFIG): boolean {
  if (!text || text.trim().length < config.minChunkLength) {
    return false
  }

  const trimmed = text.trim()

  // 检查单词数量（支持中英文）
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g)?.length || 0
  const totalWordCount = words.length + Math.floor(chineseChars / 2) // 中文2个字符算1个词

  if (totalWordCount < config.minWordCount) {
    return false
  }

  // 检查标点符号比例
  const punctuationCount = (trimmed.match(/[.,;:!?。，、；：！？…—\-\(\)\[\]\{\}]/g) || []).length
  if (punctuationCount / trimmed.length > config.maxPunctuationRatio) {
    return false
  }

  // 检查字母数字比例
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9\u4e00-\u9fa5]/g) || []).length
  if (alphanumericCount / trimmed.length < config.minAlphanumericRatio) {
    return false
  }

  return true
}

/**
 * 规范化文本：清理多余空白，保留段落结构
 */
function normalizeText(text: string): string {
  return (
    text
      // 移除零宽字符和特殊空白
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 统一换行符
      .replace(/\r\n/g, '\n')
      // 保留双换行（段落分隔），其他换行转为空格
      .replace(/\n\n+/g, '\n\n')
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      // 规范化空格
      .replace(/[ \t]+/g, ' ')
      // 清理行首行尾空格
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim()
  )
}

/**
 * 查找最佳分割点
 */
function findBestSplitPoint(text: string, maxPos: number): number {
  // 分割优先级：段落 > 句子 > 短语 > 空格

  // 1. 在段落边界（双换行）
  const paragraphEnd = text.lastIndexOf('\n\n', maxPos)
  if (paragraphEnd > maxPos * 0.5) {
    return paragraphEnd + 2
  }

  // 2. 在句子边界
  const sentenceEnds = [
    text.lastIndexOf('。', maxPos),
    text.lastIndexOf('！', maxPos),
    text.lastIndexOf('？', maxPos),
    text.lastIndexOf('. ', maxPos),
    text.lastIndexOf('! ', maxPos),
    text.lastIndexOf('? ', maxPos),
    text.lastIndexOf('.\n', maxPos),
    text.lastIndexOf('!\n', maxPos),
    text.lastIndexOf('?\n', maxPos)
  ]
  const bestSentenceEnd = Math.max(...sentenceEnds)
  if (bestSentenceEnd > maxPos * 0.6) {
    // 找到标点符号后的第一个非空字符位置
    const punctuation = text[bestSentenceEnd]
    let endPos = bestSentenceEnd + 1
    if (punctuation === '.' || punctuation === '!' || punctuation === '?') {
      while (endPos < text.length && /[\s\n]/.test(text[endPos])) {
        endPos++
      }
    }
    return endPos
  }

  // 3. 在短语边界（逗号、分号等）
  const phraseEnds = [
    text.lastIndexOf('，', maxPos),
    text.lastIndexOf('、', maxPos),
    text.lastIndexOf('；', maxPos),
    text.lastIndexOf(', ', maxPos),
    text.lastIndexOf('; ', maxPos),
    text.lastIndexOf(',\n', maxPos)
  ]
  const bestPhraseEnd = Math.max(...phraseEnds)
  if (bestPhraseEnd > maxPos * 0.7) {
    return bestPhraseEnd + 1
  }

  // 4. 在单换行处
  const singleLineBreak = text.lastIndexOf('\n', maxPos)
  if (singleLineBreak > maxPos * 0.7) {
    return singleLineBreak + 1
  }

  // 5. 最后在空格处
  const spaceEnd = text.lastIndexOf(' ', maxPos)
  if (spaceEnd > maxPos * 0.5) {
    return spaceEnd + 1
  }

  // 6. 实在找不到合适位置，返回maxPos
  return maxPos
}

/**
 * 智能分割文本为段落
 * @param text 输入文本
 * @param maxChunkSize 最大chunk大小
 * @param minChunkSize 最小chunk大小（避免过小片段）
 * @param overlap 重叠大小
 * @param qualityConfig 质量检查配置
 */
export function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 1000,
  minChunkSize: number = 100,
  overlap: number = 100,
  qualityConfig: TextQualityConfig = DEFAULT_QUALITY_CONFIG
): string[] {
  // 参数验证
  if (maxChunkSize <= 0) {
    throw new Error('maxChunkSize must be greater than 0')
  }
  if (minChunkSize < 0 || minChunkSize > maxChunkSize) {
    throw new Error('minChunkSize must be between 0 and maxChunkSize')
  }
  if (overlap < 0 || overlap >= maxChunkSize) {
    throw new Error('overlap must be between 0 and maxChunkSize')
  }

  if (!text || text.trim().length === 0) {
    return []
  }

  // 规范化文本
  const normalizedText = normalizeText(text)
  const chunks: string[] = []
  let currentPos = 0

  while (currentPos < normalizedText.length) {
    // 确定chunk的结束位置
    const targetEndPos = Math.min(currentPos + maxChunkSize, normalizedText.length)

    let endPos: number
    if (targetEndPos >= normalizedText.length) {
      // 已到文本末尾
      endPos = normalizedText.length
    } else {
      // 查找最佳分割点
      endPos = findBestSplitPoint(normalizedText.slice(currentPos), targetEndPos - currentPos) + currentPos

      // 确保不会产生太小的chunk
      if (endPos - currentPos < minChunkSize && endPos < normalizedText.length) {
        endPos = Math.min(currentPos + maxChunkSize, normalizedText.length)
      }
    }

    // 提取chunk
    const chunk = normalizedText.slice(currentPos, endPos).trim()

    // 验证chunk质量
    if (isValidChunk(chunk, qualityConfig)) {
      chunks.push(chunk)
    } else {
      console.warn(`Skipped invalid chunk at position ${currentPos}: too short or low quality`)
      // 即使chunk无效，也要前进，避免死循环
      if (endPos <= currentPos) {
        endPos = currentPos + Math.min(minChunkSize, normalizedText.length - currentPos)
      }
    }

    // 计算下一个起始位置（考虑重叠）
    const nextPos = endPos - overlap

    // 确保有进展，防止死循环
    if (nextPos <= currentPos) {
      currentPos = endPos
    } else {
      currentPos = nextPos
    }

    // 安全检查：如果没有进展，强制前进
    if (currentPos >= normalizedText.length - 1) {
      break
    }
  }

  // 后处理：合并过小的相邻chunks
  const mergedChunks = mergeSmallChunks(chunks, minChunkSize, maxChunkSize)

  return mergedChunks
}

/**
 * 合并过小的相邻chunks
 */
function mergeSmallChunks(chunks: string[], minSize: number, maxSize: number): string[] {
  if (chunks.length === 0) return []

  const result: string[] = []
  let currentChunk = chunks[0]

  for (let i = 1; i < chunks.length; i++) {
    const nextChunk = chunks[i]

    // 如果当前chunk太小，尝试与下一个合并
    if (currentChunk.length < minSize && currentChunk.length + nextChunk.length <= maxSize) {
      currentChunk = currentChunk + '\n' + nextChunk
    } else {
      result.push(currentChunk)
      currentChunk = nextChunk
    }
  }

  // 添加最后一个chunk
  if (currentChunk) {
    result.push(currentChunk)
  }

  return result
}

/**
 * 处理文档并存入向量数据库
 */
export async function processDocument(
  repositoryName: string,
  filePath: string,
  documentId: string = '',
  chunkSize: number = 1000,
  overlap: number = 100,
  modelName: string,
  apiKey: string,
  apiURL: string,
  options?: {
    minChunkSize?: number
    qualityConfig?: Partial<TextQualityConfig>
  }
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
  const minChunkSize = options?.minChunkSize || Math.floor(chunkSize * 0.3)
  const qualityConfig = {
    ...DEFAULT_QUALITY_CONFIG,
    ...options?.qualityConfig
  }

  const chunks = splitTextIntoChunks(text, chunkSize, minChunkSize, overlap, qualityConfig)

  console.log(
    `Document split into ${chunks.length} chunks. Average size: ${Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)} chars`
  )

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
      chunkId: `${documentId}-${i}`,
      chunkLength: chunks[i].length
    }

    // 插入到向量数据库
    const result = await insertDocument(repositoryName, chunks[i], fileName, chunkMetadata, modelName, apiKey, apiURL)

    results.push(result)
  }

  return {
    documentId,
    fileName,
    chunksProcessed: chunks.length,
    averageChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length),
    results
  }
}

/**
 * 从数据库中检索特定文档的所有段落
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
