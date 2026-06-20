// 验证修复后的 getEmbedding 在各种错误 baseURL 下都能给出清晰报错，
// 并在正确 baseURL 下正常返回向量。直接 import 修复后的 normalizeOpenAIBaseURL 逻辑副本。
import OpenAI from 'openai'

function normalizeOpenAIBaseURL(rawURL) {
  let url = (rawURL || '').trim().replace(/\/+$/, '')
  url = url.replace(/\/embeddings$/i, '').replace(/\/chat\/completions$/i, '')
  if (!/\/v\d+(\/|$)/i.test(url)) {
    url = `${url}/v1`
  }
  return url
}

async function tryOne(label, rawURL) {
  const norm = normalizeOpenAIBaseURL(rawURL)
  const openai = new OpenAI({ apiKey: 'lm-studio', baseURL: norm })
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-embeddinggemma-300m',
      input: ['Some text to embed']
    })
    const anyResp = response
    if (anyResp && typeof anyResp.error === 'string' && anyResp.error) {
      console.log(`[${label}] 规范化后=${norm} → 明确报错: ${anyResp.error}`)
      return
    }
    if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
      console.log(`[${label}] 规范化后=${norm} → data 缺失（不应发生）`)
      return
    }
    console.log(`[${label}] 规范化后=${norm} → ✅ 维度=${response.data[0].embedding.length}`)
  } catch (e) {
    console.log(`[${label}] 规范化后=${norm} → 抛错: ${e.status ?? ''} ${e.message.slice(0, 80)}`)
  }
}

await tryOne('用户少填 /v1:  http://127.0.0.1:1234', 'http://127.0.0.1:1234')
await tryOne('用户多填 /embeddings: http://127.0.0.1:1234/v1/embeddings', 'http://127.0.0.1:1234/v1/embeddings')
await tryOne('末尾斜杠: http://127.0.0.1:1234/v1/', 'http://127.0.0.1:1234/v1/')
await tryOne('正确写法: http://127.0.0.1:1234/v1', 'http://127.0.0.1:1234/v1')
