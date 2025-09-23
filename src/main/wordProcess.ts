import * as fs from 'fs-extra'
import JSZip from 'jszip'

interface Replacement {
  original: string
  suggested: string
}

/**
 * 安全替换 Word 文档正文中的文本（仅处理 <w:t> 标签内的内容）
 * 1. 解码XML实体为可读文本
 * 2. 执行替换操作
 * 3. 重新编码为XML安全字符串
 * 4. 严格保留原始XML结构
 *
 * @param inputPath 原始 .docx 文件路径
 * @param outputPath 输出 .docx 文件路径
 * @param replacements 替换规则数组
 */
export async function replaceTextInDocx(
  inputPath: string,
  outputPath: string,
  replacements: Replacement[]
): Promise<void> {
  // 1. 读取原始文件
  console.log('replace items:', replacements)
  const content = await fs.readFile(inputPath)
  const zip = await JSZip.loadAsync(content)

  // 2. 仅处理正文文件（关键改进：只关注正文）
  const filePath = 'word/document.xml'
  const file = zip.file(filePath)
  if (!file) {
    throw new Error(`[ERROR] 正文文件不存在: ${filePath}`)
  }

  try {
    let xmlStr = await file.async('text')
    if (typeof xmlStr !== 'string' || xmlStr.trim() === '') {
      throw new Error(`[ERROR] 正文文件为空: ${filePath}`)
    }

    // 辅助函数：XML实体解码（&amp; → &）
    const decodeXmlEntities = (str: string): string => {
      return str
        .replace(/&amp;/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
    }

    // 辅助函数：XML实体编码（& → &amp;）
    const encodeXmlEntities = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    // 辅助函数：正则特殊字符转义
    const escapeRegExp = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // 核心：匹配所有 <w:t> 标签（关键改进：精准定位文本节点）
    const tTagRegex = /(<w:t\b[^>]*>)([^<]*)(<\/w:t>)/g
    let hasReplaced = false

    const newXmlStr = xmlStr.replace(tTagRegex, (match, openTag, textContent, closeTag) => {
      // 步骤1: XML解码 → 用户可读文本
      const plainText = decodeXmlEntities(textContent)
      console.log(`[INFO] 正在处理文本: ${plainText}`)
      let replacedText = plainText

      // 步骤2: 应用替换规则（关键改进：在解码后的文本上操作）
      for (const { original, suggested } of replacements) {
        if (!original) continue

        // 严格转义原始字符串（防止正则注入）
        const safeOriginal = escapeRegExp(original)
        const regex = new RegExp(safeOriginal, 'g')

        const before = replacedText
        replacedText = replacedText.replace(regex, suggested)

        if (replacedText !== before) {
          hasReplaced = true
        }
      }

      // 步骤3: 重新编码为XML安全字符串
      const safeReplacedText = encodeXmlEntities(replacedText)

      // 步骤4: 重建原始XML结构
      return `${openTag}${safeReplacedText}${closeTag}`
    })

    if (hasReplaced) {
      zip.file(filePath, newXmlStr)
      console.log(`[SUCCESS] 已替换正文文本: ${filePath}`)
    } else {
      console.log(`[INFO] 未找到匹配的替换内容: ${filePath}`)
    }

    // 4. 生成新 DOCX 文件
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // 5. 写入输出文件
    await fs.writeFile(outputPath, buffer)
    console.log(`[INFO] 文档已保存至: ${outputPath}`)
  } catch (err) {
    console.error(`[FATAL] 处理正文文件失败: ${filePath}`, err)
    throw err
  }
}
