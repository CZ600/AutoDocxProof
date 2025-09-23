import * as fs from 'fs'
import * as path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { Replacement } from './replacement.interface' // 请根据实际情况定义 Replacement 接口

/**
 * 替换docx文件中的文本内容
 * @param filePath {string} - docx文件路径
 * @param replacements {Replacement[]} - 替换规则列表
 */
export function replaceTextInDocx(filePath: string, replacements: Replacement[]): void {
  // 读取原docx文件
  const docxData = fs.readFileSync(filePath)

  // 使用PizZip解压文件
  const zip = new PizZip(docxData)

  // 使用Docxtemplater加载文件
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  // 记录成功替换的次数
  let replacedCount = 0

  // 获取文档中的所有段落文本
  let fullText = doc.getFullText()

  // 遍历替换规则列表
  replacements.forEach(replacement => {
    const originalText = replacement.original
    const suggestedText = replacement.suggested

    // 检查文档中是否存在要替换的文本
    const matches = fullText.match(new RegExp(originalText, 'g'))

    if (matches) {
      // 统计替换前后出现的次数
      const matchCount = matches.length
      console.log(`找到 '${originalText}' 进行替换，总共匹配 ${matchCount} 次。`)

      // 输出每次替换的内容
      matches.forEach((match, index) => {
        console.log(`替换第${index + 1}次：'${match}' -> '${suggestedText}'`)
      })

      // 执行替换
      fullText = fullText.replace(new RegExp(originalText, 'g'), suggestedText)

      replacedCount += matchCount
    } else {
      console.log(`未找到 '${originalText}' 进行替换。`)
    }
  })

  try {
    // 更新文档中的文本内容
    // 使用docxtemplater的setData来更新替换后的文本
    doc.setData({ content: fullText })

    // 执行替换操作
    doc.render()
  } catch (error) {
    console.error('替换时出错:', error)
    throw error
  }

  // 获取替换后的文件内容
  const outputData = doc.getZip().generate({ type: 'nodebuffer' })

  // 获取文件目录并生成新的文件路径
  const dirPath = path.dirname(filePath)
  const newFilePath = path.join(dirPath, `replaced_${path.basename(filePath)}`)

  // 保存新文件
  fs.writeFileSync(newFilePath, outputData)

  console.log(`替换完成，共替换了 ${replacedCount} 个对象，保存为: ${newFilePath}`)
}
