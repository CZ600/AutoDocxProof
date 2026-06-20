// 探测为何 SDK 不抛异常——查看完整返回体
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: 'lm-studio', baseURL: 'http://127.0.0.1:1234' })
try {
  const response = await openai.embeddings.create({
    model: 'text-embedding-embeddinggemma-300m',
    input: ['Some text to embed']
  })
  console.log('RAW response:', JSON.stringify(response).slice(0, 400))
  console.log('typeof response.data:', typeof response.data)
  console.log('keys:', Object.keys(response))
} catch (e) {
  console.log('失败: status=', e.status, 'message=', e.message)
  console.log('full error:', JSON.stringify(e, null, 2).slice(0, 800))
}
