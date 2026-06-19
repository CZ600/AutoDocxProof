/**
 * 降低AI率 — 目录（Table of Contents）自动跳过 测试
 *
 * 测试目标：验证 proof.ts 中新增的目录检测逻辑：
 *   1. SDT 目录：被 <w:sdt docPartGallery="Table of Contents"> 包裹的段落
 *   2. 字段目录：含 TOC 域代码（fldChar begin/separate/end + instrText "TOC ..."）的段落
 *   3. 回归保护：不含目录的普通文档，collectTableOfContentsTexts 返回空集合
 *
 * 实现说明：
 *   - 用 JSZip 构造合成 .docx（与 __tests__/wordProcess.test.js 风格一致）。
 *   - proof.ts 在模块顶层 import 了 electron 的 app、./chat、./lancedb，需用 vi.mock
 *     把它们桩掉，否则 vitest 加载模块会失败（参考 smartFormatAgent.test.ts 的 mock 用法）。
 *   - collectTableOfContentsTexts 本身不依赖 electron / LLM，是纯 docx-edit 逻辑，可直接验证。
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import JSZip from 'jszip'

// ====== 模块 mock：屏蔽 electron / chat / lancedb 顶层副作用 ======
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata' },
}))

vi.mock('../src/main/chat', () => ({
  OpenaiGen: vi.fn(),
  getModelResponse: vi.fn(),
}))

vi.mock('../src/main/lancedb', () => ({
  queryDocuments: vi.fn(),
  getAllDocuments: vi.fn(),
}))

import { collectTableOfContentsTexts } from '../src/main/proof'

// ====== 测试夹具 ======

const TMP_DIR = path.resolve(__dirname, 'reduceAiTocSkip_tmp')

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
}

/** 公共的 [Content_Types].xml / 关系部件，避免每个用例重复 */
function addCommonParts(zip: JSZip) {
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
}

/** 生成一个 .docx 到指定路径，bodyXml 为 <w:body> 内部内容（不含 <w:body> 标签本身） */
async function writeDocx(filePath: string, bodyInnerXml: string) {
  const zip = new JSZip()
  addCommonParts(zip)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${bodyInnerXml}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr>
  </w:body>
</w:document>`
  )
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  fs.writeFileSync(filePath, buf)
  return filePath
}

/**
 * 构造一个 Word 标准目录内容控件（SDT），其 docPartGallery="Table of Contents"。
 * 内部放若干目录条目段落（含制表符 + 页码，模拟真实目录）。
 */
function tocSdtXml(entries: { text: string; pageTab?: boolean }[]): string {
  const paras = entries
    .map(
      e =>
        `      <w:p><w:r><w:t xml:space="preserve">${e.text}${e.pageTab === false ? '' : '\t1'}</w:t></w:r></w:p>`
    )
    .join('\n')
  return `    <w:sdt>
      <w:sdtPr>
        <w:id w:val="123456"/>
        <w:docPartObj>
          <w:docPartGallery w:val="Table of Contents"/>
          <w:docPartUnique/>
        </w:docPartObj>
      </w:sdtPr>
      <w:sdtContent>
${paras}
      </w:sdtContent>
    </w:sdt>`
}

/** 构造一个含 TOC 域代码（fldChar begin/separate/end + instrText）的段落 */
function tocFieldParagraphXml(instruction: string, resultText: string): string {
  return `    <w:p>
      <w:r>
        <w:fldChar w:fldCharType="begin"/>
      </w:r>
      <w:r>
        <w:instrText xml:space="preserve">${instruction}</w:instrText>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="separate"/>
      </w:r>
      <w:r>
        <w:t xml:space="preserve">${resultText}</w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="end"/>
      </w:r>
    </w:p>`
}

/** 普通正文段落 */
function bodyParagraphXml(text: string): string {
  return `    <w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

// ====== 测试用例 ======

describe('降低AI率 — 目录自动跳过 (collectTableOfContentsTexts)', () => {
  beforeAll(() => {
    ensureTmpDir()
  })

  it('SDT 目录：应收集 SDT 内所有目录条目文本', async () => {
    const file = path.join(TMP_DIR, 'sdt_toc.docx')
    const entries = [
      { text: '摘  要' },
      { text: 'Abstract' },
      { text: '第 1 章\t绪论' },
      { text: '1.1 研究背景与意义' },
    ]
    const body = [
      tocSdtXml(entries),
      bodyParagraphXml('这是正文段落，不应被识别为目录。'),
    ].join('\n')
    await writeDocx(file, body)

    const tocTexts = await collectTableOfContentsTexts(file)

    expect(tocTexts.size).toBe(entries.length)
    for (const e of entries) {
      // 每条目录文本都应被收集（含追加的制表符+页码 "\t1"）
      const expected = `${e.text}\t1`
      expect(tocTexts.has(expected)).toBe(true)
    }
    // 正文不应进入目录集合
    expect(tocTexts.has('这是正文段落，不应被识别为目录。')).toBe(false)
  }, 15000)

  it('字段目录：无 SDT 但含 TOC 域代码的段落应被识别（兜底）', async () => {
    const file = path.join(TMP_DIR, 'field_toc.docx')
    const body = [
      // 标题段落
      bodyParagraphXml('目录'),
      // TOC 域代码段落
      tocFieldParagraphXml(' TOC \\o "1-3" \\h \\z \\u ', '摘  要 .......... I'),
      // 普通正文（含 TOC 字样的普通文本，不应被识别为域代码）
      bodyParagraphXml('本节讨论了 table of contents 的设计思路，属于普通正文。'),
    ].join('\n')
    await writeDocx(file, body)

    const tocTexts = await collectTableOfContentsTexts(file)

    // 至少应包含 TOC 域代码段落的文本
    expect(tocTexts.size).toBeGreaterThanOrEqual(1)
    expect(Array.from(tocTexts).some(t => t.includes('摘  要'))).toBe(true)
    // 普通正文（仅文本含 "table of contents" 但不是 fldChar 域）不应被误判
    expect(tocTexts.has('本节讨论了 table of contents 的设计思路，属于普通正文。')).toBe(false)
    expect(tocTexts.has('目录')).toBe(false)
  }, 15000)

  it('回归保护：不含目录的普通文档应返回空集合', async () => {
    const file = path.join(TMP_DIR, 'plain.docx')
    const body = [
      bodyParagraphXml('第一章 绪论'),
      bodyParagraphXml('随着人工智能技术的发展，自然语言处理取得了长足的进步。'),
      bodyParagraphXml('图 1.1 展示了系统架构图。'),
    ].join('\n')
    await writeDocx(file, body)

    const tocTexts = await collectTableOfContentsTexts(file)
    expect(tocTexts.size).toBe(0)
  }, 15000)

  it('混合文档：SDT 目录与正文并存，仅目录被收集', async () => {
    const file = path.join(TMP_DIR, 'mixed.docx')
    const body = [
      tocSdtXml([{ text: '第一章 引言' }, { text: '1.1 背景' }]),
      bodyParagraphXml('随着深度学习的兴起，图神经网络成为研究热点。'),
      bodyParagraphXml('本章将详细介绍相关理论与方法。'),
    ].join('\n')
    await writeDocx(file, body)

    const tocTexts = await collectTableOfContentsTexts(file)

    expect(tocTexts.size).toBe(2)
    expect(tocTexts.has('第一章 引言\t1')).toBe(true)
    expect(tocTexts.has('1.1 背景\t1')).toBe(true)
    // 两段正文都不应进入
    expect(tocTexts.has('随着深度学习的兴起，图神经网络成为研究热点。')).toBe(false)
    expect(tocTexts.has('本章将详细介绍相关理论与方法。')).toBe(false)
  }, 15000)

  it('读取不存在的文件应返回空集合而非抛出', async () => {
    const tocTexts = await collectTableOfContentsTexts(
      path.join(TMP_DIR, 'definitely_does_not_exist.docx')
    )
    expect(tocTexts.size).toBe(0)
  }, 15000)
})
