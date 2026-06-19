// 端到端诊断：完整复刻 reduceAIDetectionDocument 的段落过滤流程，
// 找出"我的 TOC 跳过逻辑"实际拦截了哪些段落，特别是哪些是正文被误伤。
const { loadDocx } = require('docx-edit')

function stripZeroWidth(text) {
  return (text || '').replace(/[\u200B-\u200D\uFEFF]/g, '')
}
function isTableOfContentsSdtNode(node) {
  return Boolean(node && node.type === 'sdt' && node.props && node.props.docPartGallery === 'Table of Contents')
}
function isParagraphInTableOfContentsSDT(para) {
  let node = para.vnode && para.vnode.parent
  while (node) {
    if (isTableOfContentsSdtNode(node)) return true
    node = node.parent
  }
  return false
}
function paragraphHasTOCField(para) {
  if (typeof para.getFields !== 'function') return false
  let fields = []
  try { fields = para.getFields() || [] } catch { return false }
  return fields.some(f => /^\s*TOC\b/i.test((f && f.instruction) || ''))
}
function isTableOfContentsParagraph(para) {
  return isParagraphInTableOfContentsSDT(para) || paragraphHasTOCField(para)
}

// 复刻 proof.ts 里 collectTableOfContentsTexts 的收集逻辑
async function collectTocTexts(file) {
  const doc = await loadDocx(file)
  const body = doc.getBody()
  const toc = new Set()
  for (const para of body.getParagraphs()) {
    if (!isTableOfContentsParagraph(para)) continue
    const t = stripZeroWidth((typeof para.getText === 'function' ? para.getText() : '') || '')
    if (t.trim()) toc.add(t)
  }
  return { toc, doc }
}

async function main() {
  const file = String.raw`D:\project\test\毕设终稿_new.docx`
  const { toc, doc } = await collectTocTexts(file)
  console.log('=== 我收集的 TOC 文本集合 (', toc.size, ' 条) ===')
  for (const t of toc) console.log('  ' + JSON.stringify(t.slice(0, 50)))

  // 关键：遍历 body 所有非空段落，统计"正文里恰好和 TOC 集合某条文本完全相同"的段落
  // 即 reduceAI 流程里按行匹配会误伤的情况
  const body = doc.getBody()
  const allParas = body.getParagraphs()
  let total = 0, matchedInBody = 0
  const bodyMatches = []
  for (const p of allParas) {
    const t = stripZeroWidth((p.getText() || ''))
    if (!t.trim()) continue
    total++
    if (toc.has(t)) {
      matchedInBody++
      // 这个段落本身在不在 SDT 里？
      const inSdt = isParagraphInTableOfContentsSDT(p)
      bodyMatches.push({ text: t.slice(0, 50), inSdt })
    }
  }
  console.log('\n=== body 非空段落总数:', total, '===')
  console.log('其中"文本命中 TOC 集合"的段落:', matchedInBody)
  console.log('这些命中段落 inSdt 分布:')
  const inSdtCount = bodyMatches.filter(m => m.inSdt).length
  const notInSdtCount = bodyMatches.filter(m => !m.inSdt).length
  console.log(`  在 SDT 内: ${inSdtCount} (真目录，应跳过)`)
  console.log(`  不在 SDT 内: ${notInSdtCount} (正文被文本误匹配! 这是 bug)`)

  // 重点：列出不在 SDT 内、但文本命中 TOC 集合的段落（即被误伤的正文）
  console.log('\n=== 被误伤的正文段落（不在SDT内但文本命中TOC集合）===')
  const falsePositives = bodyMatches.filter(m => !m.inSdt)
  for (const m of falsePositives.slice(0, 30)) {
    console.log('  ' + JSON.stringify(m.text))
  }
  if (falsePositives.length > 30) console.log(`  ... 共 ${falsePositives.length} 条`)
}
main().catch(e => { console.error(e); process.exit(1) })
