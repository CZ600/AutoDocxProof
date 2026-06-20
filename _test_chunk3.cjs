// 验证：overlap 回拨对齐 + findBestSplitPoint 修复后，是否还切断单词
const DEFAULT_QUALITY_CONFIG = { minChunkLength: 20, minWordCount: 3, maxPunctuationRatio: 0.5, minAlphanumericRatio: 0.3 }
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
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\r\n/g, '\n').replace(/\n\n+/g, '\n\n')
    .replace(/([^\n])\n([^\n])/g, '$1 $2').replace(/[ \t]+/g, ' ').split('\n').map(l => l.trim()).join('\n').trim()
}
function alignToTokenBoundary(text, pos, limit = text.length) {
  const n = text.length
  if (pos >= n) return n
  if (/[\u4e00-\u9fa5]/.test(text[pos])) return pos
  let p = pos
  while (p < n && /\s/.test(text[p])) p++
  if (p < n && /[A-Za-z0-9]/.test(text[p])) {
    while (p < n && /[A-Za-z0-9]/.test(text[p])) p++
  }
  let candidate = p
  while (candidate < n && /[^\u4e00-\u9fa5A-Za-z0-9]/.test(text[candidate]) && !/\s/.test(text[candidate])) candidate++
  while (candidate < n && /\s/.test(text[candidate])) candidate++
  const sentenceRe = /[。！？]+|[.!?]+(?=\s|$)/g
  sentenceRe.lastIndex = candidate
  let sm
  while ((sm = sentenceRe.exec(text)) !== null) {
    if (sm.index >= limit) break
    let s = sm.index + sm[0].length
    while (s < n && /[\s\n]/.test(text[s])) s++
    if (s < limit) return s
    break
  }
  return candidate >= n ? n : candidate
}
function findBestSplitPoint(text, maxPos) {
  const paragraphEnd = text.lastIndexOf('\n\n', maxPos)
  if (paragraphEnd > maxPos * 0.5) return paragraphEnd + 2
  const sentenceRe = /[。！？]+|[.!?]+(?=\s|$)/g
  let bestSentenceEnd = -1, m
  while ((m = sentenceRe.exec(text)) !== null) { if (m.index > maxPos) break; bestSentenceEnd = m.index + m[0].length }
  if (bestSentenceEnd > maxPos * 0.5) { let e = bestSentenceEnd; while (e < text.length && /[\s\n]/.test(text[e])) e++; return e }
  const phraseRe = /[，、；]+|[,;]+(?=\s|$)/g
  let bestPhraseEnd = -1, pm
  while ((pm = phraseRe.exec(text)) !== null) { if (pm.index > maxPos) break; bestPhraseEnd = pm.index + pm[0].length }
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
    if (isValidChunk(chunk, qualityConfig)) chunks.push(chunk)
    else if (endPos <= currentPos) endPos = currentPos + Math.min(minChunkSize, normalizedText.length - currentPos)
    let nextPos = endPos - overlap
    if (nextPos > currentPos && nextPos < endPos) nextPos = alignToTokenBoundary(normalizedText, nextPos, endPos)
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

// 核心检测：每个 chunk 的首词和尾词必须是完整单词（在原文中能找到）。
// 重叠区会重复，但绝不允许出现 "ction"/"tured"/"026" 这种残词。
let allGood = true
chunks.forEach((c, i) => {
  const head = c.slice(0, 35)
  const tail = c.slice(-35)
  console.log(`--- chunk ${i} (len=${c.length}) ---`)
  console.log(`  头: ...${head}...`)
  console.log(`  尾: ...${tail}...`)
  // 取首词、尾词，检查是否是原文里出现的完整 token
  const firstWord = (c.match(/^[A-Za-z]+/) || [''])[0]
  const lastWord = (c.match(/[A-Za-z]+$/) || [''])[0]
  if (firstWord && !sample.includes(firstWord)) { console.log(`  ❌ 首词 "${firstWord}" 是残词（原文中不存在）`); allGood = false }
  if (lastWord && !sample.includes(lastWord)) { console.log(`  ❌ 尾词 "${lastWord}" 是残词（原文中不存在）`); allGood = false }
  console.log()
})
console.log(allGood ? '✅ 首尾单词均完整（无残词）' : '❌ 仍存在残词')

