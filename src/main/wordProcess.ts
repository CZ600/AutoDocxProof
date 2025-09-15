// 首先，你需要安装依赖：
// npm install docxtemplater pizzip file-saver

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { saveAs } from 'file-saver'

/**
 * 替换 Word 文档中指定占位符的文本
 * @param {File} wordFile - 用户选择的 Word 文件 (File 对象)
 * @param {Object} replacements - 替换映射对象，例如 { "{oldText1}": "newText1", "{oldText2}": "newText2" }
 * @returns {Promise<Blob>} - 返回处理后的新文档 Blob
 */
async function replaceTextInWordDoc(wordFile, replacements) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = function (event) {
      try {
        // 读取文件内容为 ArrayBuffer
        const content = event.target.result
        // 使用 PizZip 解压 .docx 文件
        const zip = new PizZip(content)
        // 创建 docxtemplater 实例
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true
        })

        // 设置数据，这里的键对应文档中的占位符（如 {placeholder}）
        doc.setData(replacements)

        // 渲染文档，执行替换
        doc.render()

        // 生成新的 .docx 文件的 Blob
        const blob = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })

        resolve(blob)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = function () {
      reject(new Error('Failed to read the file.'))
    }

    // 读取文件
    reader.readAsArrayBuffer(wordFile)
  })
}

// 使用示例
// 假设你有一个 <input type="file" id="fileInput"> 元素
document.getElementById('fileInput').addEventListener('change', async event => {
  const file = event.target.files[0]
  if (!file) return

  const replacements = {
    '{Name}': '张三', // 文档中应包含 {Name} 作为占位符
    '{Date}': '2023-10-27' // 文档中应包含 {Date} 作为占位符
    // 添加更多替换项
  }

  try {
    const newDocBlob = await replaceTextInWordDoc(file, replacements)
    // 下载新文件
    saveAs(newDocBlob, 'modified_document.docx')
    console.log('文档替换完成并已下载。')
  } catch (error) {
    console.error('替换失败:', error)
  }
})
