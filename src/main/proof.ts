import * as fs from 'fs'
import { OpenaiGen } from './chat'
import * as mammoth from 'mammoth'

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

async function proofreadLargeDocument(
  documentPath: string,
  apiURL: string,
  apiKey: string,
  modelName: string
): Promise<ProofreadingCorrection[]> {
  try {
    // 1. 读取并解析Word文档
    const docStructure = await parseWordDocument(documentPath)

    // 2. 总结全文框架和主题
    const documentTheme = await summarizeDocumentTheme(docStructure, apiKey, modelName, apiURL)

    // 3. 根据目录划分单元
    const sections = docStructure.sections

    // 4. 对每个小单元进行校对
    const allCorrections: ProofreadingCorrection[] = []

    for (const section of sections) {
      const corrections = await proofreadSection(section, docStructure.title, documentTheme, apiKey, modelName, apiURL)
      allCorrections.push(...corrections)
    }

    return allCorrections
  } catch (error) {
    console.error('文档校对过程中出现错误:', error)
    throw error
  }
}

async function parseWordDocument(documentPath: string): Promise<DocumentStructure> {
  try {
    // 使用mammoth读取Word文档
    const result = await mammoth.extractRawText({ path: documentPath })
    const text = result.value

    // 解析文档结构
    // 将文档按照段落分小块
    const lines = text.split('\n').filter(line => line.trim().length > 0) // 过滤掉去除首尾空白后长度为0的行

    const sections: DocumentSection[] = []
    let currentSection: DocumentSection | null = null
    let sectionContent: string[] = []
    let documentTitle = ''
    // 循环便利所有的小块
    for (const line of lines) {
      // 检测标题（简单的标题识别逻辑）
      if (isLikelyTitle(line)) {
        // 保存前一个章节
        if (currentSection && sectionContent.length > 0) {
          currentSection.content = sectionContent.join('\n')
          sections.push(currentSection)
        }

        // 设置文档标题（第一个标题）
        if (!documentTitle) {
          documentTitle = line.trim()
        }

        // 创建新章节
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

    // 保存最后一个章节
    if (currentSection && sectionContent.length > 0) {
      currentSection.content = sectionContent.join('\n')
      sections.push(currentSection)
    }

    return {
      title: documentTitle,
      sections: sections
    }
  } catch (error) {
    throw new Error(`解析Word文档失败: ${error.message}`)
  }
}

// 用于检测标题，如果有标题的代表含义，则认为它是一个标题
function isLikelyTitle(line: string): boolean {
  // 简单的标题识别逻辑
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

async function summarizeDocumentTheme(
  docStructure: DocumentStructure,
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<string> {
  const systemPrompt = '你是一个专业的文档分析专家。请根据提供的文档目录结构，总结文档的整体框架和主题。'

  const userPrompt = `文档标题: ${docStructure.title}
  
文档目录结构:
${docStructure.sections.map((section, index) => `${index + 1}. ${section.title}`).join('\n')}

请总结这份文档的主要主题和整体框架：`

  try {
    const theme = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
    return theme
  } catch (error) {
    console.error('总结文档主题时出错:', error)
    return '文档主题分析失败'
  }
}

async function proofreadSection(
  section: DocumentSection,
  documentTitle: string,
  documentTheme: string,
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<ProofreadingCorrection[]> {
  const systemPrompt = `你是一个专业的中文文本校对专家。请仔细检查文本中的错别字、标点错误和语法问题。
要求：
1. 只校对错别字、标点错误、语法错误
2. 保持原文意思不变
3. 不要进行风格改写或内容扩展
4. 按照指定的JSON格式返回结果`

  const userPrompt = `文档标题: ${documentTitle}
文档主题: ${documentTheme}
当前章节标题: ${section.title}
当前章节内容:
${section.content}

请校对上述文本，找出其中的错别字、标点错误和语法问题，并按照以下JSON格式返回：

[
  {
    "original": "原文错误内容",
    "suggested": "建议修改内容",
    "reason": "错误原因说明",
    "type": "错误类型(Typo/Punctuation/Grammar/Consistency)"
  }
]

如果没有任何错误，请返回空数组[]。只返回JSON数组，不要添加其他说明文字。`

  try {
    const result = await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)

    // 解析返回的JSON结果
    let corrections: ProofreadingCorrection[] = []
    try {
      corrections = JSON.parse(result)
    } catch (parseError) {
      console.warn('解析校对结果失败，可能返回了非JSON格式:', result)
      // 如果解析失败，尝试从文本中提取信息
      corrections = extractCorrectionsFromText(result)
    }

    return corrections
  } catch (error) {
    console.error(`校对章节 "${section.title}" 时出错:`, error)
    return []
  }
}

function extractCorrectionsFromText(text: string): ProofreadingCorrection[] {
  // 简单的文本解析逻辑，用于处理非标准JSON格式的返回
  const corrections: ProofreadingCorrection[] = []

  // 这里可以添加更复杂的文本解析逻辑
  // 目前只是示例，实际应用中需要根据具体返回格式调整

  return corrections
}

// 导出主要函数
export { proofreadLargeDocument, ProofreadingCorrection }
