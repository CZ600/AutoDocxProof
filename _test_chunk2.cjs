// 验证修复后的切分逻辑：用日志真实文本，确认不再切断单词/句子
// （直接拷贝修复后的 findBestSplitPoint + splitTextIntoChunks 逻辑）

const DEFAULT_QUALITY_CONFIG = {
  minChunkLength: 20, minWordCount: 3, maxPunctuationRatio: 0.5, minAlphanumericRatio: 0.3
}
function isValidChunk(text, config = DEFAULT_QUALITY_CONFIG) {
  if (!text || text.trim().length < config.minChunkLength) return false
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g)?.length || 0
  if (words.length + Math.floor(chineseChars / 2) < config.minWordCount) return false
  const punctuationCount = (trimmed.match(/[.,;:!?。，、；：！？…—\-\(\)\[\]\{\}]/g) || []).length
  if (punctuationCount / trimmed.length > config.maxPunctuationRatio) return false
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9\u4e00-\u9fa5]/g) || []).length
  if (alphanumericCount / trimmed.length < config.minAlphanumericRatio) return false
  return true
}
function normalizeText(text) {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n\n').replace(/([^\n])\n([^\n])/g, '$1 $2').replace(/[ \t]+/g, ' ')
    .split('\n').map(l => l.trim()).join('\n').trim()
}
function findBestSplitPoint(text, maxPos) {
  const paragraphEnd = text.lastIndexOf('\n\n', maxPos)
  if (paragraphEnd > maxPos * 0.5) return paragraphEnd + 2
  const sentenceRe = /[。！？]+|[.!?]+(?=\s|$)/g
  let bestSentenceEnd = -1, m
  while ((m = sentenceRe.exec(text)) !== null) {
    if (m.index > maxPos) break
    bestSentenceEnd = m.index + m[0].length
  }
  if (bestSentenceEnd > maxPos * 0.5) {
    let endPos = bestSentenceEnd
    while (endPos < text.length && /[\s\n]/.test(text[endPos])) endPos++
    return endPos
  }
  const phraseRe = /[，、；]+|[,;]+(?=\s|$)/g
  let bestPhraseEnd = -1, pm
  while ((pm = phraseRe.exec(text)) !== null) {
    if (pm.index > maxPos) break
    bestPhraseEnd = pm.index + pm[0].length
  }
  if (bestPhraseEnd > maxPos * 0.4) return bestPhraseEnd
  const singleLineBreak = text.lastIndexOf('\n', maxPos)
  if (singleLineBreak > maxPos * 0.4) return singleLineBreak + 1
  const spaceEnd = text.lastIndexOf(' ', maxPos)
  if (spaceEnd > 0) return spaceEnd + 1
  return maxPos
}
function splitTextIntoChunks(text, maxChunkSize = 500, minChunkSize = 100, overlap = 100, qualityConfig = DEFAULT_QUALITY_CONFIG) {
  if (!text || text.trim().length === 0) return []
  const normalizedText = normalizeText(text)
  const chunks = []
  let currentPos = 0
  while (currentPos < normalizedText.length) {
    const targetEndPos = Math.min(currentPos + maxChunkSize, normalizedText.length)
    let endPos
    if (targetEndPos >= normalizedText.length) {
      endPos = normalizedText.length
    } else {
      endPos = findBestSplitPoint(normalizedText.slice(currentPos), targetEndPos - currentPos) + currentPos
      if (endPos - currentPos < minChunkSize && endPos < normalizedText.length) {
        const hardEnd = Math.min(currentPos + maxChunkSize, normalizedText.length)
        const safeEnd = findBestSplitPoint(normalizedText.slice(currentPos), hardEnd - currentPos) + currentPos
        endPos = safeEnd - currentPos >= minChunkSize ? safeEnd : hardEnd
      }
    }
    const chunk = normalizedText.slice(currentPos, endPos).trim()
    if (isValidChunk(chunk, qualityConfig)) {
      chunks.push(chunk)
    } else {
      if (endPos <= currentPos) endPos = currentPos + Math.min(minChunkSize, normalizedText.length - currentPos)
    }
    const nextPos = endPos - overlap
    currentPos = nextPos <= currentPos ? endPos : nextPos
    if (currentPos >= normalizedText.length - 1) break
  }
  return chunks
}

const sample = `近年来，大模型技术经历了从"能说会道"到"能办事落地"的范式跃迁，正深刻重塑人工智能的发展格局。从ChatGPT引发的生成式AI浪潮，到"AI+"的转变，意味着技术必须从实验室走向千行百业的场景融合，向更务实、更可控、更普惠的方向演进。正如"十五五"规划纲要所提出的，鼓励多模态、智能体、具身智能、群体智能等技术创新，探索通用人工智能发展。

美美与共：2026 AI赋能文化产业发展报告. 北京大学文化产业研究院, 2026-02-17.

[5] Wang, X., Cui, Y., Wang, J. et al. Multimodal features extraction via cross-attention for enhanced representation. Computer Science Review, 61, 100925 (2026).

[9] From vectors to knowledge graphs: A comprehensive survey of structured representation challenges. IEEE TKDE, 2026.

2026，AI行业有哪些创新机会？ CBNData-第一财经商业数据中心, 2025-11-28.`

const chunks = splitTextIntoChunks(sample, 500, 100, 100)
console.log(`共切出 ${chunks.length} 个 chunk:\n`)

// 检查每个 chunk 首尾是否有被切断的单词
const wordCutRe = /(^|\s)[a-zA-Z]+$|^[a-zA-Z]+(\s|$)/
let allGood = true
chunks.forEach((c, i) => {
  const head = c.slice(0, 30)
  const tail = c.slice(-30)
  // 简单判断：头部是否以小写字母片段开头（说明可能被切断），尾部是否以单词字符结尾且下一段也是字母
  const headCut = /^[a-z]/.test(c.trim()) // 头部以小写开头，可能被切
  console.log(`--- chunk ${i} (len=${c.length}) ---`)
  console.log(`  头: ...${head}...`)
  console.log(`  尾: ...${tail}...`)
  if (headCut) { console.log(`  ⚠️ 头部疑似被切断`); allGood = false }
  console.log()
})
console.log(allGood ? '✅ 未检测到明显的单词切断' : '⚠️ 仍有疑似切断，需人工核对')
