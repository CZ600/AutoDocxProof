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

const ragText =
  '以下内容是校对的参考内容，请结合这些文字进行校对工作（如果是双语内容，则对翻译校对），校对规则遵循之前讲述的要求'

// ====== 并发控制工具函数（保留原逻辑） ======
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  maxConcurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length)
  const executing: Promise<void>[] = []

  for (let i = 0; i < items.length; i++) {
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

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results.filter((r): r is R => r !== undefined)
}

const MAX_CONCURRENCY = 30

// ====== 导出 Prompt 管理 ======
export async function getDefaultPrompt(): Promise<string> {
  return defaultPrompt
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
): Promise<string> {
  const systemPrompt = '你是一个专业的文档分析专家。请根据提供的文档目录结构，总结文档的整体框架和主题。'
  const userPrompt = `文档标题: ${docStructure.title}\n\n文档目录结构:\n${docStructure.sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}\n\n请总结这份文档的主要主题和整体框架：`

  try {
    return await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
  } catch (error) {
    console.error('总结文档主题时出错:', error)
    return '文档主题分析失败'
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
): Promise<ProofreadingCorrection[]> {
  try {
    let systemPrompt = systemContext
    if (repositoryNameList === undefined) {
      console.log('use normal proof without rag:')
      console.log('proof content:', text)
      const result = await OpenaiGen(systemPrompt, `需要校对的内容:\n${text}`, apiKey, modelName, apiURL)
      return parseCorrections(result)
    } else if (repositoryNameList.length === 0) {
      if (repositoryNameList === undefined) {
        console.log('use normal proof without rag:')
        console.log('proof content:', text)
        const result = await OpenaiGen(systemPrompt, `需要校对的内容:\n${text}`, apiKey, modelName, apiURL)
        return parseCorrections(result)
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

        const result = await OpenaiGen(systemPrompt, `需要校对的内容:\n${text}`, apiKey, modelName, apiURL)
        return parseCorrections(result, ragChunks)
      } else {
        console.log("the proof mode don't catch any preload,please check!")
        throw error("the proof mode don't catch any preload,please check!")
      }
    }
  } catch (error) {
    console.error('校对文本失败:', error)
    return []
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
  embeddingConfig?: ApiSettings
): Promise<ProofreadingCorrection[]> {
  console.log('process mode is:', mode)
  console.log('process api is:', apiURL, modelName)

  try {
    const fileName = path.basename(documentPath)

    if (mode === 'full') {
      const result = await mammoth.extractRawText({ path: documentPath }) // get full text
      const text = result.value.trim() // trim
      if (!text) return []

      return await proofreadTextWithRAG(
        text,
        defaultPrompt,
        apiKey,
        modelName,
        apiURL,
        repositoryNameList,
        fileName,
        embeddingConfig
      )
    }

    const docStructure = await parseWordDocument(documentPath)
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL)
    const nonEmptySections = docStructure.sections.filter(sec => sec.content.trim().length > 0)
    if (nonEmptySections.length === 0) return []

    let allCorrections: ProofreadingCorrection[] = []

    if (mode === 'section') {
      const sectionResults = await runWithConcurrencyLimit(nonEmptySections, MAX_CONCURRENCY, async section => {
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
      })
      allCorrections = sectionResults.flat()
    } else if (mode === 'sentence') {
      const sentenceTasks: (() => Promise<ProofreadingCorrection[]>)[] = []
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
        const sentenceResults = await runWithConcurrencyLimit(sentenceTasks, MAX_CONCURRENCY, task => task())
        allCorrections = sentenceResults.flat()
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
    return serializableCorrections
  } catch (error) {
    console.error('文档校对过程中出现错误:', error)
    throw error
  }
}
