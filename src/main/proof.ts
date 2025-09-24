import * as fs from 'fs'
import * as mammoth from 'mammoth'
import { OpenaiGen } from './chat'
import { url } from 'inspector'
import { deflate } from 'zlib'

interface ProofreadingCorrection {
  original: string
  suggested: string
  reason: string
  type: 'Typo' | 'Punctuation' | 'Grammar' | 'Consistency' | string
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

let defaultPrompt = `
你是一个专业的中文文本校对专家。请仔细检查文本中的错别字、标点错误和语法问题。
要求：
1. 只校对错别字、标点错误、语法错误
2. 保持原文意思不变
3. 不要进行风格改写或内容扩展
4. 按照指定的JSON格式返回结果
请校对用户提供的当前章节的文本，找出其中的错别字、标点错误和语法问题，并按照以下JSON格式返回：
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
function parseCorrections(result: string): ProofreadingCorrection[] {
  try {
    const parsed = JSON.parse(result)
    if (Array.isArray(parsed)) return parsed
  } catch {
    console.warn('解析校对结果失败，尝试提取文本:', result)
    return extractCorrectionsFromText(result)
  }
  return []
}

// 从非标准文本中提取校对信息（可扩展）
function extractCorrectionsFromText(text: string): ProofreadingCorrection[] {
  // 可根据实际返回格式扩展
  return []
}

// 校对单个段落
async function proofreadSection(
  section: DocumentSection,
  documentTitle: string,
  documentTheme: string,
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<ProofreadingCorrection[]> {
  const systemPrompt =
    defaultPrompt +
    `
  文档标题: ${documentTitle}
文档主题: ${documentTheme}
当前章节标题: ${section.title}`

  const userPrompt = `当前章节内容: ${section.content}`

  try {
    const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
    return parseCorrections(result)
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
  apiURL: string
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
    const userPrompt = `
需要校对的内容:
${sentence}`

    try {
      const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
      const corrections = parseCorrections(result)
      allCorrections.push(...corrections)
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
  apiURL: string
): Promise<ProofreadingCorrection[]> {
  const systemPrompt = defaultPrompt

  const userPrompt = `需要校对的内容：${text}`

  try {
    const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
    return parseCorrections(result)
  } catch (error) {
    console.error('全文校对失败:', error)
    return []
  }
}

// 主函数：统一校对接口
export async function proofreadDocument(
  documentPath: string,
  mode: 'section' | 'sentence' | 'full',
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<ProofreadingCorrection[]> {
  console.log('process mode is: ', mode)
  console.log('process api is: ', apiURL, apiURL, modelName)
  try {
    if (mode === 'full') {
      const result = await mammoth.extractRawText({ path: documentPath })
      return await proofreadEntireDocument(result.value, apiKey, modelName, apiURL)
    }

    const docStructure = await parseWordDocument(documentPath)
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL)
    const allCorrections: ProofreadingCorrection[] = []

    for (const section of docStructure.sections) {
      let corrections: ProofreadingCorrection[] = []

      if (mode === 'section') {
        corrections = await proofreadSection(section, docStructure.title, documentTheme, apiKey, modelName, apiURL)
      } else if (mode === 'sentence') {
        corrections = await proofreadSectionBySentence(
          section,
          docStructure.title,
          documentTheme,
          apiKey,
          modelName,
          apiURL
        )
      }

      allCorrections.push(...corrections)
    }
    console.log('校对结果:', allCorrections)

    return allCorrections
  } catch (error) {
    console.error('文档校对过程中出现错误:', error)
    throw error
  }
}
