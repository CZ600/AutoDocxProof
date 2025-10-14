import * as fs from 'fs'
import * as mammoth from 'mammoth'
import { OpenaiGen } from './chat'
import path from 'path'
import { queryDocuments } from './lancedb'

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

// ====== 新增：并发控制工具函数 ======
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
        results[i] = undefined // 或可返回空数组等
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

// 并发上限常量
const MAX_CONCURRENCY = 30

export async function getDefaultPrompt(): Promise<string> {
  return defaultPrompt
}

export async function setNewPrompt(newPrompt: string): Promise<boolean> {
  defaultPrompt = newPrompt
  return true
}

// 工具函数：切分句子
async function splitSentences(text: string): Promise<string[]> {
  const sentenceRegex = /[^。！？…!?]+[。！？…!?]*/g
  const sentences = text.match(sentenceRegex) || []
  return sentences.map(s => s.trim()).filter(s => s.length > 0)
}

// 判断是否为标题
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

// 获取标题层级
function getHeadingLevel(line: string): number {
  const trimmed = line.trim()
  if (/^第[一二三四五六七八九十\d]+章/.test(trimmed)) return 1
  if (/^第[一二三四五六七八九十\d]+节/.test(trimmed)) return 2
  if (/^[1-9]\.\s*\S/.test(trimmed)) return 2
  if (/^[1-9][.1-9]*\s*\S/.test(trimmed)) return 3
  return 2
}

// 解析 Word 文档结构
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
// 分析文档主题
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

// 解析模型返回的校对结果
function parseCorrections(result: string, RAGResult?: string[]): ProofreadingCorrection[] {
  try {
    const parsed = JSON.parse(result)
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (RAGResult) {
          return { ...item, References: [...RAGResult] }
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

// 从非标准文本中提取校对信息（可扩展）
function extractCorrectionsFromText(text: string): ProofreadingCorrection[] {
  return []
}

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
    queryDocuments(repoName, content.trim(), modelName, apiKey, apiURL, perRepoLimit, filter, fileName).catch(
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

  const topChunks = uniqueChunks
    .filter(item => typeof item.score === 'number' && typeof item.text === 'string')
    .sort((a, b) => b.score - a.score)
    .slice(0, effectiveSelectNum)

  return topChunks.map(item => item.text)
}

// 校对单个段落
async function proofreadSection(
  section: DocumentSection,
  documentTitle: string,
  documentTheme: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  repositoryNameList?: string[],
  fileName?: string
): Promise<ProofreadingCorrection[]> {
  const systemPrompt =
    defaultPrompt +
    `
文档标题: ${documentTitle}
文档主题: ${documentTheme}
当前章节标题: ${section.title}`

  const userPrompt = `当前章节内容: ${section.content}`

  try {
    if (repositoryNameList && fileName) {
      const resultRAG = await queryDocChunk(
        repositoryNameList,
        apiKey,
        apiURL,
        modelName,
        fileName,
        section.content,
        '',
        3
      )
      const ragContext =
        resultRAG.length > 0
          ? `\n${ragText}:
${resultRAG.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
          : ''
      const newSysPrompt = systemPrompt + ragContext
      const result = await OpenaiGen(newSysPrompt, userPrompt, apiKey, modelName, apiURL)
      return parseCorrections(result, resultRAG)
    } else {
      const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
      return parseCorrections(result)
    }
  } catch (error) {
    console.error(`校对章节 "${section.title}" 时出错:`, error)
    return []
  }
}

// 逐句校对
async function proofreadSectionBySentence(
  section: DocumentSection,
  documentTitle: string,
  documentTheme: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  repositoryNameList?: string[],
  fileName?: string
): Promise<ProofreadingCorrection[]> {
  const sentences = await splitSentences(section.content)
  const allCorrections: ProofreadingCorrection[] = []

  const systemPrompt =
    defaultPrompt +
    `
文档标题: ${documentTitle}
文档主题: ${documentTheme}
当前章节标题: ${section.title}
`

  for (const sentence of sentences) {
    if (!sentence.trim()) continue
    const userPrompt = `需要校对的内容:\n${sentence}`

    try {
      if (repositoryNameList && fileName) {
        const resultRAG = await queryDocChunk(repositoryNameList, apiKey, apiURL, modelName, fileName, sentence, '', 3)
        const ragContext =
          resultRAG.length > 0
            ? `\n${ragText}:
${resultRAG.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
            : ''
        const newSysPrompt = systemPrompt + ragContext
        const result = await OpenaiGen(newSysPrompt, userPrompt, apiKey, modelName, apiURL)
        const corrections = parseCorrections(result, resultRAG)
        allCorrections.push(...corrections)
      } else {
        const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
        const corrections = parseCorrections(result)
        allCorrections.push(...corrections)
      }
    } catch (error) {
      console.error(`校对句子失败:`, sentence, error)
    }
  }

  return allCorrections
}

// 全文校对
async function proofreadEntireDocument(
  text: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  RAGchunk?: string[]
): Promise<ProofreadingCorrection[]> {
  let systemPrompt = defaultPrompt
  if (RAGchunk && RAGchunk.length > 0) {
    const ragContext = `\n${ragText}:
${RAGchunk.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    systemPrompt += ragContext
  }

  const userPrompt = `需要校对的内容：${text}`

  try {
    const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
    return parseCorrections(result, RAGchunk)
  } catch (error) {
    console.error('全文校对失败:', error)
    return []
  }
}

// 主函数：统一校对接口，支持rag和并行处理（并发量默认为30
export async function proofreadDocument(
  documentPath: string,
  mode: 'section' | 'sentence' | 'full',
  apiKey: string,
  modelName: string,
  apiURL: string,
  repositoryNameList?: string[],
  embeddingConfig?: apiSettings
): Promise<ProofreadingCorrection[]> {
  console.log('process mode is:', mode)
  console.log('process api is:', apiURL, modelName)

  try {
    const fileName = path.basename(documentPath)

    if (mode === 'full') {
      const result = await mammoth.extractRawText({ path: documentPath })
      const text = result.value.trim()
      if (!text) return []

      // 使用独立的embedding配置进行RAG查询
      const embeddingApiKey = embeddingConfig?.apiKey || apiKey
      const embeddingApiURL = embeddingConfig?.apiURL || apiURL
      const embeddingModelName = embeddingConfig?.modelName || modelName

      if (repositoryNameList) {
        const chunks = await queryDocChunk(
          repositoryNameList,
          embeddingApiKey,
          embeddingApiURL,
          embeddingModelName,
          fileName,
          text,
          '',
          3
        )
        return await proofreadEntireDocument(text, apiKey, modelName, apiURL, chunks)
      } else {
        return await proofreadEntireDocument(text, apiKey, modelName, apiURL)
      }
    }

    const docStructure = await parseWordDocument(documentPath)
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL)

    // 跳过空内容段落
    const nonEmptySections = docStructure.sections.filter(sec => sec.content.trim().length > 0)
    if (nonEmptySections.length === 0) return []

    let allCorrections: ProofreadingCorrection[] = []

    if (mode === 'section') {
      // 使用独立的embedding配置进行RAG查询
      const embeddingApiKey = embeddingConfig?.apiKey || apiKey
      const embeddingApiURL = embeddingConfig?.apiURL || apiURL
      const embeddingModelName = embeddingConfig?.modelName || modelName

      // 并行处理段落
      const sectionResults = await runWithConcurrencyLimit(nonEmptySections, MAX_CONCURRENCY, async section => {
        return await proofreadSection(
          section,
          docStructure.title,
          documentTheme,
          apiKey,
          modelName,
          apiURL,
          repositoryNameList,
          fileName
        )
      })
      allCorrections = sectionResults.flat()
    } else if (mode === 'sentence') {
      // 对每个段落内的句子进行并行处理
      const sentenceTasks: (() => Promise<ProofreadingCorrection[]>)[] = []
      for (const section of nonEmptySections) {
        const sentences = await splitSentences(section.content)
        const validSentences = sentences.filter(s => s.trim().length > 0)
        if (validSentences.length === 0) continue

        // 为每个句子创建校对任务（闭包捕获上下文）
        for (const sentence of validSentences) {
          sentenceTasks.push(async () => {
            const systemPrompt =
              defaultPrompt +
              `
文档标题: ${docStructure.title}
文档主题: ${documentTheme}
当前章节标题: ${section.title}
`

            const userPrompt = `需要校对的内容:\n${sentence}`

            try {
              if (repositoryNameList && fileName) {
                const resultRAG = await queryDocChunk(
                  repositoryNameList,
                  apiKey,
                  apiURL,
                  modelName,
                  fileName,
                  sentence,
                  '',
                  3
                )
                const ragContext =
                  resultRAG.length > 0
                    ? `\n${ragText}:
${resultRAG.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
                    : ''
                const newSysPrompt = systemPrompt + ragContext
                const result = await OpenaiGen(newSysPrompt, userPrompt, apiKey, modelName, apiURL)
                return parseCorrections(result, resultRAG)
              } else {
                const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
                return parseCorrections(result)
              }
            } catch (error) {
              console.error(`校对句子失败:`, sentence, error)
              return []
            }
          })
        }
      }

      // 并行执行所有句子任务
      if (sentenceTasks.length > 0) {
        const sentenceResults = await runWithConcurrencyLimit(sentenceTasks, MAX_CONCURRENCY, task => task())
        allCorrections = sentenceResults.flat()
      }
    }

    // 确保返回的对象是可序列化的，移除任何可能的循环引用或不可序列化的属性
    const serializableCorrections = allCorrections.map(correction => {
      return {
        original: correction.original,
        suggested: correction.suggested,
        reason: correction.reason,
        type: correction.type,
        ...(correction.References ? { References: correction.References } : {})
      }
    })

    console.log('校对结果:', serializableCorrections)
    return serializableCorrections
  } catch (error) {
    console.error('文档校对过程中出现错误:', error)
    throw error
  }
}
