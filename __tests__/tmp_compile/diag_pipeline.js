// 完整模拟 reduceAIDetectionDocument 的段落收集阶段（不含 LLM），
// 统计各过滤环节拦截了多少段，最终 validParagraphs 有多少段。
const { loadDocx } = require('docx-edit')

function stripZeroWidth(t){return (t||'').replace(/[\u200B-\u200D\uFEFF]/g,'')}
function stripAutoNumbering(text){
  if(!text||text.length<3)return text
  let r=text.replace(/^第[一二三四五六七八九十百千\d]+[章节篇部]\s*/,'');if(r!==text&&r.length>0)return r
  r=text.replace(/^[IVXLCDM]{2,}[.\s\t、):，]+\s*/,'');if(r!==text&&r.length>0)return r
  r=text.replace(/^[IVXLCDM]{2,}(?=[A-Z][a-z]|[一-鿿])/,'');if(r!==text&&r.length>0)return r
  r=text.replace(/^\d+(\.\d+)+[.\s\t、):，]+\s*/,'');if(r!==text&&r.length>0)return r
  return text
}
function isParagraphInTableCell(para){let n=para.vnode&&para.vnode.parent;while(n){if(n.type==='table-cell')return true;n=n.parent}return false}
function isTOCSdt(n){return Boolean(n&&n.type==='sdt'&&n.props&&n.props.docPartGallery==='Table of Contents')}
function inTocSdt(para){let n=para.vnode&&para.vnode.parent;while(n){if(isTOCSdt(n))return true;n=n.parent}return false}
function hasTocField(para){if(typeof para.getFields!=='function')return false;let f=[];try{f=para.getFields()||[]}catch{return false}return f.some(x=>/^\s*TOC\b/i.test((x&&x.instruction)||''))}
function isTocPara(para){return inTocSdt(para)||hasTocField(para)}

function isLikelyTitle(line){
  const t=line.trim();if(!t||t.length>=100)return false
  if(/第[一二三四五六七八九十\d]+[章节篇]/.test(t))return true
  if(/^(摘要|Abstract|引言|绪论|结论|致谢|附录|目录|前言|导言)$/i.test(t))return true
  const cn=(t.match(/[一-鿿]/g)||[]).length;const mx=cn>0?30:100
  if(/^[1-9][.、]\s*\S/.test(t)&&t.length<=mx)return true
  return false
}
function shouldExcludeFromReduceAI(line){
  const t=line.trim()
  if(t.length<20)return true
  if(/^图\s*[\d.]+/.test(t))return true
  if(/^表\s*[\d.]+/.test(t))return true
  if(/^\[\d+\]/.test(t))return true
  const tabs=(t.match(/\t/g)||[]).length;if(tabs>=3)return true
  return false
}
function isReferenceSection(title){return /参考文献|references?|引用文献/i.test(title||'')}

// mergeFormulaFragments 简化版（按行）
function mergeFormulaFragments(lines){return lines}

async function main(){
  const file=String.raw`D:\project\test\毕设终稿_new.docx`
  const doc=await loadDocx(file)
  const body=doc.getBody()

  // 1. 收集 TOC 文本
  const toc=new Set()
  for(const p of body.getParagraphs()){if(isTocPara(p)){const t=stripZeroWidth(p.getText()||'');if(t.trim())toc.add(t)}}

  // 2. 复刻 extractDocxEditHeadings
  const paragraphs=body.getParagraphs()
  const sections=[];let cur=null;let content=[];let foundHeadings=false
  for(const p of paragraphs){
    if(isParagraphInTableCell(p))continue
    const rawText=(p.getText()||'').trim()
    const text=stripAutoNumbering(rawText)
    const hl=p.getHeadingLevel()
    if(hl!==null&&hl!==undefined&&text.length>0){
      foundHeadings=true
      if(cur&&content.length>0){cur.content=content.join('\n');sections.push(cur)}
      cur={title:text,content:'',level:hl};content=[]
    }else if(cur&&text.length>0){content.push(text)}
  }
  if(cur&&content.length>0){cur.content=content.join('\n');sections.push(cur)}
  console.log('extractDocxEditHeadings: 提取到',sections.length,'个章节, foundHeadings=',foundHeadings)

  // 3. 复刻 reduceAI 的段落收集
  let valid=0,titleSkip=0,excludeSkip=0,tocSkip=0,refSkip=0,inRef=false
  const sectionsWithContent=sections.filter(s=>s.content.trim().length>0)
  for(const section of sections){
    if(isReferenceSection(section.title)){inRef=true;continue}
    if(inRef){if(section.level<=1){inRef=false}else{continue}}
    const paras=mergeFormulaFragments(section.content.split('\n'))
    for(const para of paras){
      if(isLikelyTitle(para)){titleSkip++;continue}
      if(shouldExcludeFromReduceAI(para)){excludeSkip++;continue}
      if(toc.size>0&&toc.has(stripZeroWidth(para))){tocSkip++;continue}
      valid++
    }
  }
  console.log('\n=== reduceAI 段落收集统计 ===')
  console.log('标题跳过(isLikelyTitle):',titleSkip)
  console.log('排除跳过(shouldExclude):',excludeSkip)
  console.log('目录跳过(TOC):',tocSkip)
  console.log('参考文献章节跳过:',refSkip)
  console.log('>>> 最终会改写的正文段落数:',valid)
  console.log('\n(注：此脚本未复刻 isMostlyEnglishText；仅验证章节+目录+过滤)')
}
main().catch(e=>{console.error(e);process.exit(1)})
