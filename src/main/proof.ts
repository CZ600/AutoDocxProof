import * as fs from 'fs'
import * as mammoth from 'mammoth'
import { OpenaiGen, getModelResponse } from './chat'
import path from 'path'
import { app } from 'electron'
import { queryDocuments, getAllDocuments } from './lancedb'
import { error } from 'console'
import { ProofreadProgressPayload } from '../shared/proofreadProgress'
import {
  buildPromptFromSettings,
  clonePromptSettings,
  DEFAULT_PROMPT_SETTINGS,
  normalizePromptSettings,
  PromptSettings,
  buildBackgroundInstruction,
  AppLanguage
} from '../shared/promptSettings'
import { ModelProvider } from '../shared/modelProviders'
import * as zhCNPrompts from '../shared/prompts/zh-CN'
import * as enPrompts from '../shared/prompts/en'

// ====== 类型定义 ======
interface ProofreadingCorrection {
  original: string
  suggested: string
  reason: string
  type: 'Typo' | 'Punctuation' | 'Grammar' | 'Consistency' | string
  References?: string[]
  filtered?: boolean
  filterReason?: string
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
  provider?: ModelProvider
}

async function callModelAPI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  provider?: ModelProvider
): Promise<{ result: string; total_tokens: number }> {
  const actualProvider = provider || ModelProvider.OPENAI_COMPATIBLE

  if (actualProvider === ModelProvider.OPENAI_COMPATIBLE) {
    return await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
  }

  return await getModelResponse(actualProvider, systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====== Locale helpers ======
let currentLocale: AppLanguage = 'zh-CN'

function getPrompts() {
  return currentLocale === 'zh-CN' ? zhCNPrompts : enPrompts
}

function getLocalizedProgressMessages() {
  return getPrompts().PROGRESS_MESSAGES
}

function getLocalizedConsoleMessages() {
  return getPrompts().CONSOLE_MESSAGES
}

function getLocalizedReviewFilterReasons() {
  return getPrompts().REVIEW_FILTER_REASONS
}

function getLocalizedRagText(): string {
  return getPrompts().RAG_TEXT
}

function getLocalizedUserPromptText(): string {
  return getPrompts().USER_PROMPT_TEXT
}

function buildLocalizedDocumentContextInjection(title: string, theme: string, sectionTitle: string): string {
  return getPrompts().buildDocumentContextInjection(title, theme, sectionTitle)
}

function buildLocalizedThemeUserPrompt(title: string, sections: { title: string }[]): string {
  return getPrompts().buildThemeUserPrompt(title, sections)
}

function buildLocalizedThemeSystemPrompt(): string {
  return getPrompts().THEME_SUMMARIZATION_SYSTEM_PROMPT
}

function buildLocalizedReviewPrompt(backgroundInstruction: string): string {
  return getPrompts().buildReviewPrompt(backgroundInstruction)
}

function buildLocalizedReviewUserPrompt(
  corrections: { original: string; suggested: string; reason: string; type: string }[]
): string {
  return getPrompts().buildReviewUserPrompt(corrections)
}

// ====== 全局 Prompt ======
let currentPromptSettings: PromptSettings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS)
let promptSettingsLoaded = false

function getPromptSettingsFilePath() {
  return path.join(app.getPath('userData'), 'prompt-settings.json')
}

function ensurePromptSettingsLoaded() {
  if (promptSettingsLoaded) return

  try {
    const filePath = getPromptSettingsFilePath()
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      currentPromptSettings = normalizePromptSettings(JSON.parse(fileContent))
    } else {
      currentPromptSettings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS)
    }
  } catch (error) {
    console.error(getLocalizedConsoleMessages().loadPromptFailed, error)
    currentPromptSettings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS)
  }

  promptSettingsLoaded = true
}

function persistPromptSettings() {
  const filePath = getPromptSettingsFilePath()
  fs.writeFileSync(filePath, JSON.stringify(currentPromptSettings, null, 2), 'utf-8')
}

function getCurrentPromptSettings(): PromptSettings {
  ensurePromptSettingsLoaded()
  return clonePromptSettings(currentPromptSettings)
}

function getCurrentEffectivePrompt(): string {
  ensurePromptSettingsLoaded()
  return buildPromptFromSettings(currentPromptSettings, currentLocale)
}

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
    onItemCompleted?: (completed: number, total: number) => void
  }
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length)
  const executing: Promise<void>[] = []
  let completedCount = 0

  // --- 新增逻辑: 速率限制初始化 ---
  const { requestsPerMinute, onItemCompleted } = options || {}
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
        completedCount += 1
        onItemCompleted?.(completedCount, items.length)
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
  return buildPromptFromSettings(DEFAULT_PROMPT_SETTINGS, currentLocale)
}

export async function setNewPrompt(newPrompt: string): Promise<boolean> {
  const nextSettings = normalizePromptSettings({
    ...getCurrentPromptSettings(),
    customPromptEnabled: true,
    customPrompt: newPrompt
  })
  currentPromptSettings = nextSettings
  persistPromptSettings()
  return true
}

export async function getPromptSettings(): Promise<PromptSettings> {
  return getCurrentPromptSettings()
}

export async function setPromptSettings(settings: PromptSettings): Promise<boolean> {
  currentPromptSettings = normalizePromptSettings(settings)
  persistPromptSettings()
  return true
}

export async function getEffectivePrompt(): Promise<string> {
  return getCurrentEffectivePrompt()
}

export async function resetPromptSettings(): Promise<boolean> {
  currentPromptSettings = clonePromptSettings(DEFAULT_PROMPT_SETTINGS)
  persistPromptSettings()
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
function splitSectionIntoParagraphs(section: DocumentSection): DocumentSection[] {
  const paragraphs = section.content
    .split('\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)

  return paragraphs.map((paragraph, index) => ({
    title: paragraphs.length > 1 ? `${section.title} - Paragraph ${index + 1} (Section ${index + 1})` : section.title,
    content: paragraph,
    level: section.level
  }))
}

function getSectionsForProofreading(sections: DocumentSection[]): DocumentSection[] {
  const nonEmptySections = sections.filter(section => section.content.trim().length > 0)
  if (nonEmptySections.length !== 1) {
    return nonEmptySections
  }

  const paragraphSections = splitSectionIntoParagraphs(nonEmptySections[0])
  return paragraphSections.length > 1 ? paragraphSections : nonEmptySections
}

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
    throw new Error(`${getLocalizedConsoleMessages().parseWordFailed}${error.message}`)
  }
}

// ====== 文档主题总结 ======
async function summarizeDocumentTheme(
  docStructure: DocumentStructure,
  apiKey: string,
  modelName: string,
  apiURL: string,
  provider?: ModelProvider
): Promise<{
  result: string
  total_tokens: number
}> {
  const systemPrompt = buildLocalizedThemeSystemPrompt()
  const userPrompt = buildLocalizedThemeUserPrompt(docStructure.title, docStructure.sections)

  try {
    return await callModelAPI(systemPrompt, userPrompt, apiKey, modelName, apiURL, provider)
  } catch (error) {
    console.error(getLocalizedConsoleMessages().summarizeThemeError, error)
    return {
      result: 'error',
      total_tokens: null
    }
  }
}

// ====== 校对结果解析 ======
function parseCorrections(result: string, ragChunks?: string[]): ProofreadingCorrection[] {
  // 首先尝试直接解析
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
  } catch (error) {
    console.warn('直接解析JSON失败，尝试清理和提取:', error)
    return extractCorrectionsFromText(result, ragChunks)
  }
}

function extractCorrectionsFromText(text: string, ragChunks?: string[]): ProofreadingCorrection[] {
  try {
    // 1. 清理可能的代码块标记
    let cleanedText = text.trim()

    // 移除代码块标记（```json, ```, 或者其他语言标记）
    cleanedText = cleanedText.replace(/^```[\w]*\n?/g, '')
    cleanedText = cleanedText.replace(/\n?```$/g, '')

    // 移除可能的 "json" 标记
    cleanedText = cleanedText.replace(/^json\s*/i, '')

    // 移除可能的解释性文字（如 "以下是JSON:", "返回结果:" 等）
    cleanedText = cleanedText.replace(/^.*?以下.*?[::：]\s*/, '')
    cleanedText = cleanedText.replace(/^.*?返回.*?[::：]\s*/, '')

    // 提取JSON数组（寻找第一个 [ 和最后一个 ]）
    const firstBracket = cleanedText.indexOf('[')
    const lastBracket = cleanedText.lastIndexOf(']')

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonString = cleanedText.substring(firstBracket, lastBracket + 1)
      console.log('提取到的JSON字符串:', jsonString)

      const parsed = JSON.parse(jsonString)
      if (Array.isArray(parsed)) {
        const corrections = parsed
          .map(item => {
            // 验证每个字段的存在性
            if (item.original && item.suggested && item.reason) {
              if (ragChunks) {
                return { ...item, References: [...ragChunks] }
              }
              return item
            }
            return null
          })
          .filter((item): item is ProofreadingCorrection => item !== null)

        if (corrections.length > 0) {
          console.log(`成功解析出 ${corrections.length} 个校对结果`)
          return corrections
        }
      }
    }

    // 2. 尝试解析单个JSON对象
    try {
      const singleObject = JSON.parse(cleanedText)
      if (singleObject && typeof singleObject === 'object' && !Array.isArray(singleObject)) {
        if (singleObject.original && singleObject.suggested && singleObject.reason) {
          console.log('解析到单个校对结果')
          return ragChunks ? [{ ...singleObject, References: [...ragChunks] }] : [singleObject]
        }
      }
    } catch (e) {
      // 单对象解析失败，继续
    }

    // 3. 如果以上都失败，尝试从文本中提取信息
    console.warn('JSON解析完全失败，尝试从文本中手动提取')
    return parseCorrectionsFromPlainText(text, ragChunks)
  } catch (error) {
    console.error('所有解析方法都失败:', error)
    console.error('原始文本:', text)
    return []
  }
}

function parseCorrectionsFromPlainText(text: string, ragChunks?: string[]): ProofreadingCorrection[] {
  const corrections: ProofreadingCorrection[] = []
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  console.log('尝试从纯文本中提取校对结果，共', lines.length, '行')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 查找包含 "original" 的行
    if (/original|原文|原内容/.test(line)) {
      const correction: Partial<ProofreadingCorrection> = {}

      // 提取 original 值
      const originalMatch = line.match(/["'""“”]([^""“”]+)["'""“”]/)
      if (originalMatch) {
        correction.original = originalMatch[1].trim()
      }

      // 在后续行中查找 suggested
      if (i + 1 < lines.length) {
        const suggestedLine = lines[i + 1]
        const suggestedMatch = suggestedLine.match(/["'""“”]([^""“”]+)["'""“”]/)
        if (suggestedMatch) {
          correction.suggested = suggestedMatch[1].trim()
        }
      }

      // 在后续行中查找 reason
      if (i + 2 < lines.length) {
        const reasonLine = lines[i + 2]
        const reasonMatch = reasonLine.match(/["'""“”]([^""“”]+)["'""“”]/)
        if (reasonMatch) {
          correction.reason = reasonMatch[1].trim()
        }

        // 查找 type
        const typeMatch = reasonLine.match(/"type":\s*["']([^"']+)["']/)
        if (typeMatch) {
          correction.type = typeMatch[1]
        }
      }

      // 如果找到了所有必需字段，添加到结果中
      if (correction.original && correction.suggested && correction.reason) {
        if (ragChunks) {
          correction.References = [...ragChunks]
        }
        corrections.push(correction as ProofreadingCorrection)
      }
    }
  }

  console.log('从纯文本中提取到', corrections.length, '个校对结果')
  return corrections
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
  embeddingConfig?: ApiSettings,
  provider?: ModelProvider
): Promise<{ result: ProofreadingCorrection[]; use_tokens: number }> {
  try {
    let systemPrompt = systemContext

    // 如果没有提供 repositoryNameList 或者为空数组，使用正常校对
    if (!repositoryNameList || repositoryNameList.length === 0) {
      console.log('use normal proof without rag:')
      console.log('proof content:', text)
      const { result, total_tokens } = await callModelAPI(
        systemPrompt,
        `${getLocalizedUserPromptText()}:\n${text}`,
        apiKey,
        modelName,
        apiURL,
        provider
      )
      return { result: parseCorrections(result), use_tokens: total_tokens }
    }

    // 使用 RAG 的校对（repositoryNameList 有内容）
    if (repositoryNameList.length > 0 && fileName) {
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
        const ragContext = `\n${getLocalizedRagText()}:\n${ragChunks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        systemPrompt += ragContext
      }

      const { result, total_tokens } = await callModelAPI(
        systemPrompt,
        `${getLocalizedUserPromptText()}:\n${text}`,
        apiKey,
        modelName,
        apiURL,
        provider
      )
      return { result: parseCorrections(result, ragChunks), use_tokens: total_tokens }
    }
  } catch (error) {
    console.error(getLocalizedConsoleMessages().proofTextFailed, error)
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
  parallelSet: number = 30,
  setTimeLimit?: number,
  onProgress?: (payload: ProofreadProgressPayload) => void,
  provider?: ModelProvider
): Promise<{ proofResult: ProofreadingCorrection[]; token_usage: number }> {
  console.log('process mode is:', mode)
  console.log('process api is:', apiURL, modelName)
  const progressMessages = getLocalizedProgressMessages()
  const effectivePrompt = getCurrentEffectivePrompt()
  let total_tokens = 0 // calculate the usage of tokens
  const option = setTimeLimit // set the limit of request per minute
    ? {
        requestsPerMinute: setTimeLimit
      }
    : undefined

  try {
    const fileName = path.basename(documentPath)

    if (mode === 'full') {
      onProgress?.({
        stage: 'splitting',
        mode,
        message: progressMessages.splitting
      })
      const fullText = await mammoth.extractRawText({ path: documentPath }) // get full text
      const text = fullText.value.trim() // trim
      if (!text)
        return {
          proofResult: null,
          token_usage: 0
        }
      const { result, use_tokens } = await proofreadTextWithRAG(
        text,
        effectivePrompt,
        apiKey,
        modelName,
        apiURL,
        repositoryNameList,
        fileName,
        embeddingConfig,
        provider
      )
      total_tokens += use_tokens

      onProgress?.({
        stage: 'completed',
        mode,
        percent: 100,
        message: progressMessages.completed
      })
      return { proofResult: result, token_usage: total_tokens }
    }

    onProgress?.({
      stage: 'splitting',
      mode,
      message: progressMessages.splitting
    })
    const docStructure = await parseWordDocument(documentPath)
    onProgress?.({
      stage: 'theme',
      mode,
      message: progressMessages.theme
    })
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL, provider)
    const nonEmptySections = getSectionsForProofreading(docStructure.sections)
    if (nonEmptySections.length === 0)
      return {
        proofResult: null,
        token_usage: 0
      }

    let allCorrections: ProofreadingCorrection[] = []

    if (mode === 'section') {
      onProgress?.({
        stage: 'proofreading',
        mode,
        total: nonEmptySections.length,
        completed: 0,
        percent: 0,
        message: progressMessages.proofreading
      })
      const sectionResults = await runWithLimits(
        nonEmptySections,
        parallelSet,
        async section => {
          const systemContext = `${effectivePrompt}\n${buildLocalizedDocumentContextInjection(docStructure.title, documentTheme.result, section.title)}`
          return proofreadTextWithRAG(
            section.content,
            systemContext,
            apiKey,
            modelName,
            apiURL,
            repositoryNameList,
            fileName,
            embeddingConfig,
            provider
          )
        },
        {
          ...option,
          onItemCompleted: (completed, total) => {
            onProgress?.({
              stage: 'proofreading',
              mode,
              total,
              completed,
              percent: total > 0 ? Math.min(95, Math.floor((completed / total) * 95)) : 0,
              message: progressMessages.proofreading
            })
          }
        }
      )
      let resultList: ProofreadingCorrection[][] = []
      sectionResults.forEach(item => {
        total_tokens += item.use_tokens
        resultList.push(item.result)
      })
      allCorrections = resultList.flat()
    } else if (mode === 'sentence') {
      const sentenceTasks: (() => Promise<{ result: ProofreadingCorrection[]; use_tokens: number }>)[] = []
      for (const section of nonEmptySections) {
        const sentences = splitSentences(section.content)
        const validSentences = sentences.filter(s => s.trim().length > 0)
        if (validSentences.length === 0) continue

        for (const sentence of validSentences) {
          sentenceTasks.push(async () => {
            const systemContext = `${effectivePrompt}\n${buildLocalizedDocumentContextInjection(docStructure.title, documentTheme.result, section.title)}`
            return proofreadTextWithRAG(
              sentence,
              systemContext,
              apiKey,
              modelName,
              apiURL,
              repositoryNameList,
              fileName,
              embeddingConfig,
              provider
            )
          })
        }
      }

      onProgress?.({
        stage: 'proofreading',
        mode,
        total: sentenceTasks.length,
        completed: 0,
        percent: 0,
        message: progressMessages.proofreading
      })

      if (sentenceTasks.length > 0) {
        const sentenceResults = await runWithLimits(sentenceTasks, parallelSet, task => task(), {
          ...option,
          onItemCompleted: (completed, total) => {
            onProgress?.({
              stage: 'proofreading',
              mode,
              total,
              completed,
              percent: total > 0 ? Math.min(95, Math.floor((completed / total) * 95)) : 0,
              message: progressMessages.proofreading
            })
          }
        })
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
      ...(correction.References ? { References: correction.References } : {}),
      ...(correction.filtered ? { filtered: correction.filtered } : {}),
      ...(correction.filterReason ? { filterReason: correction.filterReason } : {})
    }))

    console.log('校对结果:', serializableCorrections)
    onProgress?.({
      stage: 'completed',
      mode,
      percent: 100,
      message: progressMessages.completed
    })
    return { proofResult: serializableCorrections, token_usage: total_tokens }
  } catch (error) {
    console.error(getLocalizedConsoleMessages().documentProofError, error)
    throw error
  }
}

// ====== 校对结果审核 ======

const REVIEW_BATCH_SIZE = 100

function buildReviewPrompt(backgroundInstruction: string): string {
  return buildLocalizedReviewPrompt(backgroundInstruction)
}

function buildReviewUserPrompt(corrections: ProofreadingCorrection[]): string {
  return buildLocalizedReviewUserPrompt(corrections)
}

export async function reviewCorrections(
  corrections: ProofreadingCorrection[],
  backgroundInstruction: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  onProgress?: (completed: number, total: number) => void,
  provider?: ModelProvider
): Promise<{ reviewedResult: ProofreadingCorrection[]; token_usage: number }> {
  const filterReasons = getLocalizedReviewFilterReasons()

  if (!corrections || corrections.length === 0) {
    return { reviewedResult: [], token_usage: 0 }
  }

  const reviewSystemPrompt = buildReviewPrompt(backgroundInstruction)
  let totalTokens = 0

  if (corrections.length > REVIEW_BATCH_SIZE) {
    const batches: ProofreadingCorrection[][] = []
    for (let i = 0; i < corrections.length; i += REVIEW_BATCH_SIZE) {
      batches.push(corrections.slice(i, i + REVIEW_BATCH_SIZE))
    }

    let allReviewed: ProofreadingCorrection[] = []
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]
      const userPrompt = buildReviewUserPrompt(batch)

      const { result, total_tokens } = await callModelAPI(
        reviewSystemPrompt,
        userPrompt,
        apiKey,
        modelName,
        apiURL,
        provider
      )
      totalTokens += total_tokens

      const reviewed = parseCorrections(result)
      for (const original of batch) {
        const matched = reviewed.find(r => r.original === original.original && r.suggested === original.suggested)
        if (matched && matched.filtered) {
          original.filtered = true
          original.filterReason = matched.filterReason || filterReasons.reviewRejected
        } else if (matched && !matched.filtered) {
          original.filtered = false
        } else {
          const fallbackMatch = reviewed.find(r => r.original === original.original)
          if (fallbackMatch) {
            if (fallbackMatch.filtered) {
              original.filtered = true
              original.filterReason = fallbackMatch.filterReason || filterReasons.reviewRejected
            } else {
              original.filtered = true
              original.filterReason = fallbackMatch.filterReason || filterReasons.reviewOriginalCorrect
            }
          } else {
            original.filtered = false
          }
        }
      }
      allReviewed.push(...batch)

      const batchFiltered = batch.filter(c => c.filtered)
      if (batchFiltered.length > 0) {
        console.log(`[审核] 第${batchIdx + 1}批: 过滤 ${batchFiltered.length}/${batch.length} 条建议`)
        batchFiltered.forEach(c => {
          console.log(
            `  - 过滤: "${c.original}" → "${c.suggested}" | 原因: ${c.filterReason || filterReasons.noReason}`
          )
        })
      } else {
        console.log(`[审核] 第${batchIdx + 1}批: 保留全部 ${batch.length} 条建议`)
      }

      if (onProgress) {
        onProgress(Math.min((batchIdx + 1) * REVIEW_BATCH_SIZE, corrections.length), corrections.length)
      }
    }

    return { reviewedResult: allReviewed, token_usage: totalTokens }
  }

  const userPrompt = buildReviewUserPrompt(corrections)
  const { result, total_tokens } = await OpenaiGen(reviewSystemPrompt, userPrompt, apiKey, modelName, apiURL)
  totalTokens = total_tokens

  const reviewed = parseCorrections(result)

  for (const original of corrections) {
    const matched = reviewed.find(r => r.original === original.original && r.suggested === original.suggested)
    if (matched && matched.filtered) {
      original.filtered = true
      original.filterReason = matched.filterReason || filterReasons.reviewRejected
    } else if (matched && !matched.filtered) {
      original.filtered = false
    } else {
      const fallbackMatch = reviewed.find(r => r.original === original.original)
      if (fallbackMatch) {
        if (fallbackMatch.filtered) {
          original.filtered = true
          original.filterReason = fallbackMatch.filterReason || filterReasons.reviewRejected
        } else {
          original.filtered = true
          original.filterReason = fallbackMatch.filterReason || filterReasons.reviewOriginalCorrect
        }
      } else {
        original.filtered = false
      }
    }
  }

  const filtered = corrections.filter(c => c.filtered)
  if (filtered.length > 0) {
    console.log(`[审核] 过滤 ${filtered.length}/${corrections.length} 条建议`)
    filtered.forEach(c => {
      console.log(`  - 过滤: "${c.original}" → "${c.suggested}" | 原因: ${c.filterReason || filterReasons.noReason}`)
    })
  } else {
    console.log(`[审核] 保留全部 ${corrections.length} 条建议`)
  }

  return { reviewedResult: corrections, token_usage: totalTokens }
}

export function getCurrentBackgroundInstruction(): string {
  ensurePromptSettingsLoaded()
  return buildBackgroundInstruction(currentPromptSettings, currentLocale)
}

export function setLocale(locale: AppLanguage): void {
  currentLocale = locale
}

export function getLocale(): AppLanguage {
  return currentLocale
}
