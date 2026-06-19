const path = require('path')
const mammoth = require('mammoth')
const { loadDocx } = require('docx-edit')

async function main() {
  const file = String.raw`D:\project\test\毕设终稿_new.docx`
  // 1. mammoth raw text
  const r = await mammoth.extractRawText({ path: file })
  const lines = r.value.split('\n').map(s => s.trim()).filter(Boolean)
  console.log('=== mammoth extractRawText: total non-empty lines =', lines.length, '===')
  const tocStart = lines.findIndex(l => l === '目录')
  console.log('目录 title index:', tocStart)
  if (tocStart >= 0) {
    console.log('--- around 目录 ---')
    for (let i = tocStart; i < Math.min(tocStart + 12, lines.length); i++) {
      console.log('  ', JSON.stringify(lines[i]))
    }
  }

  // 2. docx-edit
  const doc = await loadDocx(file)
  const body = doc.getBody()
  const paras = body.getParagraphs()
  console.log('\n=== docx-edit body.getParagraphs() count =', paras.length, '===')
  const entries = body.getEntries ? body.getEntries({ includeSpecial: true }) : null
  console.log('body.getEntries(includeSpecial:true) count:', entries ? entries.length : 'no method')

  // 检查 direct children 是否含 sdt
  const tree = doc.toComponentTree()
  function walk(node, depth, acc) {
    if (!node || !node.children) return
    for (const c of node.children) {
      if (c.type === 'sdt') {
        acc.push(c)
      }
      walk(c, depth + 1, acc)
    }
  }
  const sdts = []
  for (const part of tree.children) walk(part, 0, sdts)
  console.log('tree 中 sdt 节点数:', sdts.length)
  if (sdts.length) {
    const sdt = sdts[0]
    console.log('第一个 sdt 的 props keys:', Object.keys(sdt.props || {}))
    console.log('第一个 sdt 的 props:', JSON.stringify(sdt.props || {}).slice(0, 300))
    // 收集 sdt 下所有段落文本
    function collectPara(n, arr) {
      if (!n || !n.children) return
      for (const c of n.children) {
        if (c.type === 'paragraph') arr.push(c.props.text || '')
        else collectPara(c, arr)
      }
    }
    const sdtParas = []
    collectPara(sdt, sdtParas)
    console.log('第一个 sdt 下段落数:', sdtParas.length)
    console.log('前 8 条 sdt 段落文本:', sdtParas.slice(0, 8))
  }

  // 在 body 段落里找目录条目
  let foundTocEntries = 0
  for (const p of paras) {
    const t = p.getText().trim()
    if (t === '摘  要' || t === 'Abstract' || /^1\.1 研究背景与意义/.test(t)) {
      foundTocEntries++
    }
  }
  console.log('docx-edit body.getParagraphs() 命中目录条目数:', foundTocEntries)
}
main().catch(e => { console.error(e); process.exit(1) })
