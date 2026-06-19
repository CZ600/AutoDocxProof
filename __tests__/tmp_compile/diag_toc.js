// 诊断：到底是 SDT 检测还是字段检测误伤了正文
const { loadDocx } = require('docx-edit')

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

async function main() {
  const files = [
    String.raw`D:\project\test\毕设终稿_new.docx`,
  ]
  for (const file of files) {
    console.log('\n===== ' + file + ' =====')
    let doc
    try { doc = await loadDocx(file) } catch (e) { console.log('load fail:', e.message); continue }
    const body = doc.getBody()
    const paras = body.getParagraphs()
    let total = 0, sdtHit = 0, fieldHit = 0, either = 0
    const fieldSamples = []
    const sdtNonEmpty = []
    for (const p of paras) {
      const t = (p.getText() || '').replace(/[\u200B-\u200D\uFEFF]/g, '')
      if (!t.trim()) continue
      total++
      const s = isParagraphInTableOfContentsSDT(p)
      const f = paragraphHasTOCField(p)
      if (s) { sdtHit++; if (sdtNonEmpty.length < 4) sdtNonEmpty.push(t.slice(0, 40)) }
      if (f) {
        fieldHit++
        // 抓 instruction 样本
        let instrs = []
        try { instrs = (p.getFields() || []).map(x => (x && x.instruction) || '') } catch {}
        if (fieldSamples.length < 8) fieldSamples.push({ text: t.slice(0, 40), instrs })
      }
      if (s || f) either++
    }
    console.log(`非空段落总数: ${total}`)
    console.log(`SDT目录命中: ${sdtHit}`)
    console.log(`字段(TOC)命中: ${fieldHit}`)
    console.log(`并集(=被跳过): ${either}`)
    console.log('SDT命中样本:', JSON.stringify(sdtNonEmpty, null, 2))
    console.log('字段命中样本(text + instrs):', JSON.stringify(fieldSamples, null, 2))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
