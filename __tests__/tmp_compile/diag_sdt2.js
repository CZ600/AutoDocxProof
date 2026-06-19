// 诊断 v2：列出文档里所有 SDT 的形态，看正文是否被 SDT 包住
const { loadDocx } = require('docx-edit')

async function main() {
  const files = [
    String.raw`D:\project\test\毕设终稿_new.docx`,
  ]
  for (const file of files) {
    console.log('\n===== ' + file + ' =====')
    let doc
    try { doc = await loadDocx(file) } catch (e) { console.log('load fail:', e.message); continue }
    const body = doc.getBody()
    const sdts = body.getStructuredDocumentTags()
    console.log(`body 内 SDT 总数: ${sdts.length}`)
    let idx = 0
    for (const sdt of sdts) {
      idx++
      const isTOC = sdt.isTableOfContents()
      const isTOF = sdt.isTableOfFigures()
      let paras = []
      try { paras = sdt.getParagraphs() || [] } catch {}
      const texts = paras.map(p => ((p.getText() || '').replace(/[\u200B-\u200D\uFEFF]/g, '')).trim()).filter(Boolean)
      console.log(`\n--- SDT #${idx} ---`)
      console.log(`  gallery=${JSON.stringify(sdt.getGalleryType())} alias=${JSON.stringify(sdt.getAlias())} contentType=${JSON.stringify(sdt.getContentType())} tag=${JSON.stringify(sdt.getTag())}`)
      console.log(`  isTOC=${isTOC} isTOF=${isTOF} inBody=${sdt.isInDocumentBody()}`)
      console.log(`  内部段落总数=${paras.length} (非空=${texts.length})`)
      console.log(`  前5条文本:`)
      for (const t of texts.slice(0, 5)) console.log(`    ${JSON.stringify(t.slice(0, 50))}`)
      if (texts.length > 5) console.log(`    ... (共 ${texts.length} 条)`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
