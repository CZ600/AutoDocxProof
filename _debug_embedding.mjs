// 直接复现 getEmbedding 的行为，定位 data 字段为空的真正原因
import OpenAI from 'openai'

const baseURL = 'http://127.0.0.1:1234/v1'

const cases = [
  { label: 'baseURL 带 /v1', baseURL: 'http://127.0.0.1:1234/v1' },
  { label: 'baseURL 带 /v1/ (末尾斜杠)', baseURL: 'http://127.0.0.1:1234/v1/' },
  { label: 'baseURL 不带 /v1', baseURL: 'http://127.0.0.1:1234' },
  { label: 'baseURL 带 /v1/embeddings (用户最容易填错)', baseURL: 'http://127.0.0.1:1234/v1/embeddings' }
]

for (const c of cases) {
  const openai = new OpenAI({ apiKey: 'lm-studio', baseURL: c.baseURL })
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-embeddinggemma-300m',
      input: ['Some text to embed']
    })
    console.log(`[${c.label}] data 长度 = ${response?.data?.length}, 首个 embedding 维度 = ${response?.data?.[0]?.embedding?.length}`)
  } catch (e) {
    console.log(`[${c.label}] 失败: ${e.status} ${e.message}`)
  }
}
