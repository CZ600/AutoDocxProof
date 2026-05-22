import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import { loadDocx } from 'docx-edit'
import { cloneFormat, extractFormatProfile } from '../src/main/formatClone'

const FIXTURES_DIR = path.resolve(__dirname)
const SOURCE_DOC = path.join(FIXTURES_DIR, '测试文档1.docx')
const TARGET_DOC = path.join(FIXTURES_DIR, '格式测试文档.docx')
const OUTPUT_DOC = path.join(FIXTURES_DIR, 'output_format_cloned.docx')

describe('cloneFormat', () => {
  afterAll(() => {
    if (fs.existsSync(OUTPUT_DOC)) {
      fs.unlinkSync(OUTPUT_DOC)
    }
  })

  it('两个测试文档都能正常加载并提取样式档案', async () => {
    const sourceDoc = await loadDocx(SOURCE_DOC)
    const targetDoc = await loadDocx(TARGET_DOC)

    const sourceProfile = sourceDoc.getStyleProfile()
    const targetProfile = targetDoc.getStyleProfile()

    expect(sourceProfile).toBeDefined()
    expect(targetProfile).toBeDefined()
    expect(sourceProfile.defaults).toBeDefined()
    expect(targetProfile.defaults).toBeDefined()
    expect(Object.keys(sourceProfile.styles).length).toBeGreaterThan(0)
    expect(Object.keys(targetProfile.styles).length).toBeGreaterThan(0)
  })

  it('执行格式克隆后输出文件已生成', async () => {
    await cloneFormat(SOURCE_DOC, TARGET_DOC, OUTPUT_DOC)

    expect(fs.existsSync(OUTPUT_DOC)).toBe(true)
  })

  it('输出文件的样式档案与参考文档一致', async () => {
    const sourceDoc = await loadDocx(SOURCE_DOC)
    const outputDoc = await loadDocx(OUTPUT_DOC)

    const sourceProfile = sourceDoc.getStyleProfile()
    const outputProfile = outputDoc.getStyleProfile()

    // docDefaults 应一致
    expect(outputProfile.defaults.paragraphStyle).toEqual(sourceProfile.defaults.paragraphStyle)
    expect(outputProfile.defaults.runStyle).toEqual(sourceProfile.defaults.runStyle)

    // 按名称匹配验证命名样式
    for (const [, srcStyle] of Object.entries(sourceProfile.styles)) {
      const matched = Object.values(outputProfile.styles).find(
        dst => dst.name === srcStyle.name && dst.type === srcStyle.type
      )
      if (matched) {
        expect(matched.paragraphStyle).toEqual(srcStyle.paragraphStyle)
        expect(matched.runStyle).toEqual(srcStyle.runStyle)
      }
    }
  })

  it('extractFormatProfile 返回有效的样式档案', async () => {
    const profile = await extractFormatProfile(SOURCE_DOC)

    expect(profile).toBeDefined()
    expect(profile.defaults).toBeDefined()
    expect(profile.defaults.paragraphStyle).toBeDefined()
    expect(profile.defaults.runStyle).toBeDefined()
    expect(typeof profile.styles).toBe('object')
    expect(Object.keys(profile.styles).length).toBeGreaterThan(0)

    // 验证命名样式包含必要字段
    const firstStyle = Object.values(profile.styles)[0]
    expect(firstStyle.name).toBeDefined()
    expect(firstStyle.type).toBeDefined()
  })

  it('输出文件的段落文本内容未被改变', async () => {
    const targetDoc = await loadDocx(TARGET_DOC)
    const outputDoc = await loadDocx(OUTPUT_DOC)

    const targetParagraphs = targetDoc.getParagraphs()
    const outputParagraphs = outputDoc.getParagraphs()

    expect(outputParagraphs.length).toBe(targetParagraphs.length)

    for (let i = 0; i < targetParagraphs.length; i++) {
      expect(outputParagraphs[i].getText()).toBe(targetParagraphs[i].getText())
    }
  })
})
