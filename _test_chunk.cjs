// 复现：用日志里的真实文本跑现有切分逻辑，看是否切断词/句子
// 直接 require 编译前的 ts 不行，这里把 pdfUtils 的纯函数逻辑原样拷出来跑。
// 用 chunkSize=500（与 ipcHandlers.ts 实际调用一致）。

const DEFAULT_QUALITY_CONFIG = {
  minChunkLength: 20, minWordCount: 3, maxPunctuationRatio: 0.5, minAlphanumericRatio: 0.3
}

function isValidChunk(text, config = DEFAULT_QUALITY_CONFIG) {
  if (!text || text.trim().length < config.minChunkLength) return false
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g)?.length || 0
  const totalWordCount = words.length + Math.floor(chineseChars / 2)
  if (totalWordCount < config.minWordCount) return false
  const punctuationCount = (trimmed.match(/[.,;:!?。，、；：！？…—\-\(\)\[\]\{\}]/g) || []).length
  if (punctuationCount / trimmed.length > config.maxPunctuationRatio) return false
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9\u4e00-\u9fa5]/g) || []).length
  if (alphanumericCount / trimmed.length < config.minAlphanumericRatio) return false
  return true
}

function normalizeText(text) {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map(line => line.trim()).join('\n').trim()
}

function findBestSplitPoint(text, maxPos) {
  const paragraphEnd = text.lastIndexOf('\n\n', maxPos)
  if (paragraphEnd > maxPos * 0.5) return paragraphEnd + 2
  const sentenceEnds = [
    text.lastIndexOf('。', maxPos), text.lastIndexOf('！', maxPos), text.lastIndexOf('？', maxPos),
    text.lastIndexOf('. ', maxPos), text.lastIndexOf('! ', maxPos), text.lastIndexOf('? ', maxPos),
    text.lastIndexOf('.\n', maxPos), text.lastIndexOf('!\n', maxPos), text.lastIndexOf('?\n', maxPos)
  ]
  const bestSentenceEnd = Math.max(...sentenceEnds)
  if (bestSentenceEnd > maxPos * 0.6) {
    const punctuation = text[bestSentenceEnd]
    let endPos = bestSentenceEnd + 1
    if (punctuation === '.' || punctuation === '!' || punctuation === '?') {
      while (endPos < text.length && /[\s\n]/.test(text[endPos])) endPos++
    }
    return endPos
  }
  const phraseEnds = [
    text.lastIndexOf('，', maxPos), text.lastIndexOf('、', maxPos), text.lastIndexOf('；', maxPos),
    text.lastIndexOf(', ', maxPos), text.lastIndexOf('; ', maxPos), text.lastIndexOf(',\n', maxPos)
  ]
  const bestPhraseEnd = Math.max(...phraseEnds)
  if (bestPhraseEnd > maxPos * 0.7) return bestPhraseEnd + 1
  const singleLineBreak = text.lastIndexOf('\n', maxPos)
  if (singleLineBreak > maxPos * 0.7) return singleLineBreak + 1
  const spaceEnd = text.lastIndexOf(' ', maxPos)
  if (spaceEnd > maxPos * 0.5) return spaceEnd + 1
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
        endPos = Math.min(currentPos + maxChunkSize, normalizedText.length)
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

// 模拟日志里的真实文本（中英混合 + 参考文献列表）
const sample = `近年来，大模型技术经历了从"能说会道"到"能办事落地"的范式跃迁，正深刻重塑人工智能的发展格局。从ChatGPT引发的生成式AI浪潮，到"AI+"的转变，意味着技术必须从实验室走向千行百业的场景融合，向更务实、更可控、更普惠的方向演进。正如"十五五"规划纲要所提出的，鼓励多模态、智能体、具身智能、群体智能等技术创新，探索通用人工智能发展。

美美与共：2026 AI赋能文化产业发展报告. 北京大学文化产业研究院, 2026-02-17.

[5] Wang, X., Cui, Y., Wang, J. et al. Multimodal features extraction via cross-attention for enhanced representation. Computer Science Review, 61, 100925 (2026).

[9] From vectors to knowledge graphs: A comprehensive survey of structured representation challenges. IEEE TKDE, 2026.

2026，AI行业有哪些创新机会？ CBNData-第一财经商业数据中心, 2025-11-28.`

const chunks = splitTextIntoChunks(sample, 500, 100, 100)
console.log(`共切出 ${chunks.length} 个 chunk:\n`)
chunks.forEach((c, i) => {
  // 检查首尾是否有被切断的迹象
  const head = c.slice(0, 25)
  const tail = c.slice(-25)
  console.log(`--- chunk ${i} (len=${c.length}) ---`)
  console.log(`  头: ...${head}...`)
  console.log(`  尾: ...${tail}...`)
  console.log()
})
