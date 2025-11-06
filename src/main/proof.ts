import * as fs from 'fs'
import * as mammoth from 'mammoth'
import { OpenaiGen } from './chat'
import path from 'path'
import { queryDocuments, getAllDocuments } from './lancedb'
import { error } from 'console'

// ====== 类型定义 ======
interface ProofreadingCorrection {
  original: string
  suggested: string
  reason: string
  type: 'Typo' | 'Punctuation' | 'Grammar' | 'Consistency' | string
  References?: string[]
}

interface DocumentSection {
  title: string
  content: string
  level: number
}

interface DocumentStructure {
  title: string
  sections: DocumentSection[]
}

interface RAGQueryResult {
  id: number
  text: string
  filename: string
  score: number
  meta: any
}

interface ApiSettings {
  apiKey: string
  apiURL: string
  modelName: string
}

// ====== 全局 Prompt ======
let defaultPrompt = `
你是一个专业的中文文本校对专家。请仔细检查文本中的错别字、标点错误和语法问题。
要求：
1. 只校对错别字、标点错误、语法错误
2. 保持原文意思不变
3. 不要进行风格改写或内容扩展
4. 按照指定的JSON格式返回结果
请校对用户提供的文本，找出其中的错别字、标点错误和语法问题，并按照以下JSON格式返回：
[
  {
    "original": "原文错误内容（只截取原文错误的词组，不要多写，不超过15字！）",
    "suggested": "建议修改内容（基于原文的修改后的内容）",
    "reason": "错误原因的简短说明",
    "type": "错误类型(Typo/Punctuation/Grammar/Consistency)"
  }
]
如果没有任何错误，请返回空数组[]。只返回JSON数组，不要添加其他说明文字。
`

const realDefaultPrompt = `你是一个专业的中文文本校对专家。请仔细检查文本中的错别字、标点错误和语法问题。
要求：
1. 只校对错别字、标点错误、语法错误
2. 保持原文意思不变
3. 不要进行风格改写或内容扩展
4. 按照指定的JSON格式返回结果
请校对用户提供的文本，找出其中的错别字、标点错误和语法问题，并按照以下JSON格式返回：
[
  {
    "original": "原文错误内容（只截取原文错误的词组，不要多写，不超过15字！）",
    "suggested": "建议修改内容（基于原文的修改后的内容）",
    "reason": "错误原因的简短说明",
    "type": "错误类型(Typo/Punctuation/Grammar/Consistency)"
  }
]
如果没有任何错误，请返回空数组[]。只返回JSON数组，不要添加其他说明文字。`

const ragText =
  '以下内容是校对的参考内容，请结合这些文字进行校对工作（如果是双语内容，则以校对内容的语言类型为准），校对规则遵循之前讲述的要求'

// ====== 并发控制工具函数 ======
/**
 * 一个简单的延时函数
 * @param ms 延时的毫秒数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 带有并发数和速率限制的异步任务控制器
 *
 * @param items 要处理的元素数组
 * @param maxConcurrency 最大并发数
 * @param processor 处理单个元素的异步函数
 * @param options 可选配置项
 * @param options.requestsPerMinute 每分钟最大请求数，用于速率限制
 * @returns 返回一个包含所有成功处理结果的 Promise
 */
export async function runWithLimits<T, R>(
  items: T[],
  maxConcurrency: number,
  processor: (item: T) => Promise<R>,
  options?: {
    requestsPerMinute?: number
  }
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length)
  const executing: Promise<void>[] = []

  // --- 新增逻辑: 速率限制初始化 ---
  const { requestsPerMinute } = options || {}
  const hasRateLimit = typeof requestsPerMinute === 'number' && requestsPerMinute > 0

  // 计算两次请求之间的最小时间间隔（毫秒）
  const minInterval = hasRateLimit ? (60 * 1000) / requestsPerMinute! : 0
  let lastRequestTime = 0 // 记录上一个任务开始的时间戳
  // --- 新增逻辑结束 ---

  for (let i = 0; i < items.length; i++) {
    // --- 核心逻辑整合 ---
    // 1. 首先，等待并发池出现空位（如果已满）
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing)
    }

    // 2. 其次，等待满足速率限制的时间间隔
    if (hasRateLimit) {
      const now = Date.now()
      const elapsedTime = now - lastRequestTime
      if (elapsedTime < minInterval) {
        const delayTime = minInterval - elapsedTime
        await delay(delayTime)
      }
      // 更新"上一次请求时间"为当前（补足延迟后）的时间
      lastRequestTime = Date.now()
    }
    // --- 整合结束 ---

    const execute = async () => {
      try {
        results[i] = await processor(items[i])
      } catch (error) {
        console.error(`并发任务 ${i} 失败:`, error)
        results[i] = undefined
      }
    }

    const promise = execute().then(() => {
      const index = executing.indexOf(promise)
      if (index !== -1) executing.splice(index, 1)
    })
    executing.push(promise)
  }

  await Promise.all(executing)
  return results.filter((r): r is R => r !== undefined)
}

// ====== 导出 Prompt 管理 ======
export async function getDefaultPrompt(): Promise<string> {
  return realDefaultPrompt
}

export async function setNewPrompt(newPrompt: string): Promise<boolean> {
  defaultPrompt = newPrompt
  return true
}

// ====== 工具函数 ======
function splitSentences(text: string): string[] {
  const sentenceRegex = /[^。！？…!?]+[。！？…!?]+|[^。！？…!?]+$/g
  const sentences = text.match(sentenceRegex) || []
  return sentences.map(s => s.trim()).filter(s => s.length > 0)
}

function isLikelyTitle(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length < 100 &&
    (trimmed.endsWith('章') ||
      trimmed.endsWith('节') ||
      trimmed.endsWith('篇') ||
      /^第[一二三四五六七八九十\d]+[章节篇]/.test(trimmed) ||
      /^[1-9][.、]\s*\S/.test(trimmed) ||
      /^[一二三四五六七八九十][.、]\s*\S/.test(trimmed))
  )
}

function getHeadingLevel(line: string): number {
  const trimmed = line.trim()
  if (/^第[一二三四五六七八九十\d]+章/.test(trimmed)) return 1
  if (/^第[一二三四五六七八九十\d]+节/.test(trimmed)) return 2
  if (/^[1-9]\.\s*\S/.test(trimmed)) return 2
  if (/^[1-9][.1-9]*\s*\S/.test(trimmed)) return 3
  return 2
}

// ====== 文档解析 ======
async function parseWordDocument(documentPath: string): Promise<DocumentStructure> {
  try {
    const result = await mammoth.extractRawText({ path: documentPath })
    const text = result.value
    const lines = text.split('\n').filter(line => line.trim().length > 0)

    const sections: DocumentSection[] = []
    let currentSection: DocumentSection | null = null
    let sectionContent: string[] = []
    let documentTitle = ''

    for (const line of lines) {
      if (isLikelyTitle(line)) {
        if (currentSection && sectionContent.length > 0) {
          currentSection.content = sectionContent.join('\n')
          sections.push(currentSection)
        }

        if (!documentTitle) documentTitle = line.trim()

        currentSection = {
          title: line.trim(),
          content: '',
          level: getHeadingLevel(line)
        }
        sectionContent = []
      } else if (currentSection) {
        sectionContent.push(line)
      }
    }

    if (currentSection && sectionContent.length > 0) {
      currentSection.content = sectionContent.join('\n')
      sections.push(currentSection)
    }

    return {
      title: documentTitle,
      sections
    }
  } catch (error) {
    throw new Error(`解析Word文档失败: ${error.message}`)
  }
}

// ====== 文档主题总结 ======
async function summarizeDocumentTheme(
  docStructure: DocumentStructure,
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<{
  result: string
  total_tokens: number
}> {
  const systemPrompt = '你是一个专业的文档分析专家。请根据提供的文档目录结构，总结文档的整体框架和主题。'
  const userPrompt = `文档标题: ${docStructure.title}\n\n文档目录结构:\n${docStructure.sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}\n\n请总结这份文档的主要主题和整体框架：`

  try {
    return await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
  } catch (error) {
    console.error('总结文档主题时出错:', error)
    return {
      result: 'error',
      total_tokens: null
    }
  }
}

// ====== 校对结果解析 ======
function parseCorrections(result: string, ragChunks?: string[]): ProofreadingCorrection[] {
  try {
    const parsed = JSON.parse(result)
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (ragChunks) {
          return { ...item, References: [...ragChunks] }
        }
        return item
      })
    } else {
      console.warn('cannot analyze the proofreading data from LLM')
      return []
    }
  } catch {
    console.warn('解析校对结果失败，尝试提取文本:', result)
    return extractCorrectionsFromText(result)
  }
}

function extractCorrectionsFromText(text: string): ProofreadingCorrection[] {
  return []
}

// ====== RAG 查询 ======
interface QueryDocChunkOptions {
  maxSelectNum?: number
  enableDeduplication?: boolean
}

const DEFAULT_MAX_SELECT_NUM = 20

const queryDocChunk = async (
  repositoryNameList: string[],
  apiKey: string,
  apiURL: string,
  modelName: string,
  fileName: string,
  content: string,
  filter: string,
  selectNum: number,
  options: QueryDocChunkOptions = {}
): Promise<string[]> => {
  const { maxSelectNum = DEFAULT_MAX_SELECT_NUM, enableDeduplication = true } = options

  if (!Array.isArray(repositoryNameList) || repositoryNameList.length === 0) {
    console.warn('queryDocChunk: repositoryNameList is empty or invalid')
    return []
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid or missing apiKey')
  }

  if (!apiURL || typeof apiURL !== 'string') {
    throw new Error('Invalid or missing apiURL')
  }

  if (!modelName || typeof modelName !== 'string') {
    throw new Error('Invalid or missing modelName')
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    console.warn('queryDocChunk: empty or invalid content, returning empty result')
    return []
  }

  if (!Number.isInteger(selectNum) || selectNum <= 0) {
    console.warn(`queryDocChunk: invalid selectNum ${selectNum}, using default 1`)
    selectNum = 1
  }

  const effectiveSelectNum = Math.min(selectNum, maxSelectNum)
  const perRepoLimit = Math.min(effectiveSelectNum, 10)

  const chunkList: RAGQueryResult[] = []

  const queries = repositoryNameList.map(repoName =>
    queryDocuments(repoName, content.trim(), modelName, apiKey, apiURL, perRepoLimit, filter).catch(
      (err): RAGQueryResult[] => {
        console.error(`queryDocChunk: failed to query repository "${repoName}"`, err)
        return []
      }
    )
  )

  const results = await Promise.all(queries)

  for (const result of results) {
    if (Array.isArray(result)) {
      chunkList.push(...result)
    }
  }

  let uniqueChunks = chunkList
  if (enableDeduplication && chunkList.length > 0) {
    const seen = new Set<string>()
    uniqueChunks = chunkList.filter(item => {
      if (typeof item.text !== 'string') return false
      if (seen.has(item.text)) return false
      seen.add(item.text)
      return true
    })
  }
  console.info('-----------------------------------RAG Query----------------------------')
  console.info('the unique results of query:', uniqueChunks)
  console.log('the proofreading content:', content)

  const topChunks = uniqueChunks
    .filter(item => typeof item.score === 'number' && typeof item.text === 'string')
    .sort((a, b) => b.score - a.score)
    .slice(0, effectiveSelectNum)
  console.info('the top relative result of query:', topChunks)

  return topChunks.map(item => item.text)
}

// ====== 通用RAG校对函数 ======
async function proofreadTextWithRAG(
  text: string,
  systemContext: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  repositoryNameList?: string[],
  fileName?: string,
  embeddingConfig?: ApiSettings
): Promise<{ result: ProofreadingCorrection[]; use_tokens: number }> {
  try {
    let systemPrompt = systemContext
    if (repositoryNameList === undefined) {
      console.log('use normal proof without rag:')
      console.log('proof content:', text)
      const { result, total_tokens } = await OpenaiGen(
        systemPrompt,
        `需要校对的内容:\n${text}`,
        apiKey,
        modelName,
        apiURL
      )
      return { result: parseCorrections(result), use_tokens: total_tokens }
    } else if (repositoryNameList.length === 0) {
      if (repositoryNameList === undefined) {
        console.log('use normal proof without rag:')
        console.log('proof content:', text)
        const { result, total_tokens } = await OpenaiGen(
          systemPrompt,
          `需要校对的内容:\n${text}`,
          apiKey,
          modelName,
          apiURL
        )
        return { result: parseCorrections(result), use_tokens: total_tokens }
      } else if (repositoryNameList.length > 0 && fileName) {
        const embApiKey = embeddingConfig?.apiKey || apiKey
        const embApiURL = embeddingConfig?.apiURL || apiURL
        const embModelName = embeddingConfig?.modelName || modelName
        console.log('------------------------setting of RAG-------------------------------------')
        console.log('embedding key:', embApiKey)
        console.log('embedding URL:', embApiURL)
        console.log('embedding modelName:', embModelName)

        const ragChunks = await queryDocChunk(
          repositoryNameList,
          embApiKey,
          embApiURL,
          embModelName,
          fileName,
          text,
          '',
          3
        )

        if (ragChunks.length > 0) {
          const ragContext = `\n${ragText}:\n${ragChunks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
          systemPrompt += ragContext
        }

        const { result, total_tokens } = await OpenaiGen(
          systemPrompt,
          `需要校对的内容:\n${text}`,
          apiKey,
          modelName,
          apiURL
        )
        return { result: parseCorrections(result, ragChunks), use_tokens: total_tokens }
      } else {
        console.log("the proof mode don't catch any preload,please check!")
        throw error("the proof mode don't catch any preload,please check!")
      }
    }
  } catch (error) {
    console.error('校对文本失败:', error)
    return { result: [], use_tokens: 0 }
  }
}

// ====== 主校对函数 ======
export async function proofreadDocument(
  documentPath: string,
  mode: 'section' | 'sentence' | 'full',
  apiKey: string,
  modelName: string,
  apiURL: string,
  repositoryNameList?: string[],
  embeddingConfig?: ApiSettings,
  parallelSet: number = 30, // 并发限制
  setTimeLimit?: number // 每分钟最高发射频率
): Promise<{ proofResult: ProofreadingCorrection[]; token_usage: number }> {
  console.log('process mode is:', mode)
  console.log('process api is:', apiURL, modelName)
  let total_tokens = 0 // calculate the usage of tokens
  const option = setTimeLimit // set the limit of request per minute
    ? {
        requestsPerMinute: setTimeLimit
      }
    : undefined

  try {
    const fileName = path.basename(documentPath)

    if (mode === 'full') {
      const fullText = await mammoth.extractRawText({ path: documentPath }) // get full text
      const text = fullText.value.trim() // trim
      if (!text)
        return {
          proofResult: null,
          token_usage: 0
        }
      const { result, use_tokens } = await proofreadTextWithRAG(
        text,
        defaultPrompt,
        apiKey,
        modelName,
        apiURL,
        repositoryNameList,
        fileName,
        embeddingConfig
      )
      total_tokens += use_tokens

      return { proofResult: result, token_usage: total_tokens }
    }

    const docStructure = await parseWordDocument(documentPath)
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL)
    const nonEmptySections = docStructure.sections.filter(sec => sec.content.trim().length > 0)
    if (nonEmptySections.length === 0)
      return {
        proofResult: null,
        token_usage: 0
      }

    let allCorrections: ProofreadingCorrection[] = []

    if (mode === 'section') {
      const sectionResults = await runWithLimits(
        nonEmptySections,
        parallelSet,
        async section => {
          const systemContext = `${defaultPrompt}
文档标题: ${docStructure.title}
文档主题: ${documentTheme}
当前章节标题: ${section.title}`
          return proofreadTextWithRAG(
            section.content,
            systemContext,
            apiKey,
            modelName,
            apiURL,
            repositoryNameList,
            fileName,
            embeddingConfig
          )
        },
        option
      )
      let resultList: ProofreadingCorrection[][] = []
      sectionResults.forEach(item => {
        total_tokens += item.use_tokens
        resultList.push(item.result)
      })
      allCorrections = resultList.flat() // 展开二维数组，获取最后的结果数组
    } else if (mode === 'sentence') {
      const sentenceTasks: (() => Promise<{ result: ProofreadingCorrection[]; use_tokens: number }>)[] = []
      for (const section of nonEmptySections) {
        const sentences = splitSentences(section.content)
        const validSentences = sentences.filter(s => s.trim().length > 0)
        if (validSentences.length === 0) continue

        for (const sentence of validSentences) {
          sentenceTasks.push(async () => {
            const systemContext = `${defaultPrompt}
文档标题: ${docStructure.title}
文档主题: ${documentTheme}
当前章节标题: ${section.title}`
            return proofreadTextWithRAG(
              sentence,
              systemContext,
              apiKey,
              modelName,
              apiURL,
              repositoryNameList,
              fileName,
              embeddingConfig
            )
          })
        }
      }

      if (sentenceTasks.length > 0) {
        const sentenceResults = await runWithLimits(sentenceTasks, parallelSet, task => task(), option)
        let resultList: ProofreadingCorrection[][] = []
        sentenceResults.forEach(Items => {
          total_tokens += Items.use_tokens
          resultList.push(Items.result)
        })
        allCorrections = resultList.flat()
      }
    }

    // 确保可序列化
    const serializableCorrections = allCorrections.map(correction => ({
      original: correction.original,
      suggested: correction.suggested,
      reason: correction.reason,
      type: correction.type,
      ...(correction.References ? { References: correction.References } : {})
    }))

    console.log('校对结果:', serializableCorrections)
    return { proofResult: serializableCorrections, token_usage: total_tokens }
  } catch (error) {
    console.error('文档校对过程中出现错误:', error)
    throw error
  }
}
