// 探查 docx-edit 树中 sdt 下段落是否保留 fldChar/instrText 子节点
// 以及段落文本是否含域指令残留
const { loadDocx } = require('docx-edit')

async function main() {
  const file = String.raw`D:\project\test\毕设终稿_new.docx`
  const doc = await loadDocx(file)
  const tree = doc.toComponentTree()

  // 找第一个 sdt
  function findSdt(node) {
    if (!node || !node.children) return null
    for (const c of node.children) {
      if (c.type === 'sdt') return c
      const r = findSdt(c); if (r) return r
    }
    return null
  }
  let sdt = null
  for (const part of tree.children) { sdt = sdt || findSdt(part) }
  if (!sdt) { console.log('no sdt'); return }

  // 收集 sdt 下所有段落
  function collect(n, arr) {
    if (!n || !n.children) return
    for (const c of n.children) {
      if (c.type === 'paragraph') arr.push(c)
      else collect(c, arr)
    }
  }
  const paras = []
  collect(sdt, paras)
  console.log('sdt 下段落数:', paras.length)

  // 看前 3 个非空段落的子节点类型分布
  let shown = 0
  for (const p of paras) {
    const txt = (p.props.text || '').trim()
    if (!txt) continue
    const childTypes = (p.children || []).map(c => c.type)
    const typeSet = [...new Set(childTypes)]
    console.log(`\n段落: ${JSON.stringify(txt.slice(0, 40))}`)
    console.log('  子节点类型集合:', typeSet)
    console.log('  子节点数:', (p.children || []).length)
    // 检查是否有任何子节点的 type 含 field/fldChar/instr
    const fieldish = (p.children || []).filter(c =>
      /field|fld|instr|char/i.test(c.type || '')
    )
    console.log('  field类子节点:', fieldish.length, fieldish.map(f => f.type))
    // props.style.styleId
    console.log('  style.styleId:', (p.props.style || {}).styleId)
    shown++
    if (shown >= 3) break
  }
}
main().catch(e => { console.error(e); process.exit(1) })
