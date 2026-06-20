// 诊断"1223"数据库：检查向量是否正常 + 用日志实例句子做真实 KNN 查询
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const os = require('os')
const OpenAI = require('openai').default
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'AutoDocxProofreading', 'vector-db', 'knowledge.db')
const EMB_MODEL = 'text-embedding-embeddinggemma-300m'
const EMB_URL = 'http://127.0.0.1:1234/v1'

// 日志里用过的两段校对查询实例
const QUERY_SENTENCES = [
  '新一代模型通过支持超长上下文（如百万级Token）并结合外部记忆存储及检索机制，能够在多次交互中持续追踪用户身份、项目历史与个人偏好。',
  '传统AI对话是一次性的——用户提问，模型回答，会话结束即被遗忘。'
]

async function getEmbedding(text) {
  const o = new OpenAI({ apiKey: 'lm-studio', baseURL: EMB_URL })
  const r = await o.embeddings.create({ model: EMB_MODEL, input: [text] })
  return r.data[0].embedding
}

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  // 找到"1223"对应的表名（sanitize 后可能是 t_1223）
  const tables = await db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`
  )
  console.log('所有知识库:', tables.map(t => t.name))

  // 匹配 1223（可能是 "1223"、"t_1223"）
  const target = tables.find(t => /1223/.test(t.name))
  if (!target) {
    console.log('\n❌ 没有找到包含 "1223" 的知识库表')
    await db.close()
    return
  }
  console.log(`\n目标表: ${target.name}`)

  // 1. 维度 + 行数
  const ddl = await db.get(`SELECT sql FROM sqlite_master WHERE name = ?`, target.name)
  const dimMatch = /FLOAT\[\s*(\d+)\s*\]/.exec(ddl.sql || '')
  const declaredDim = dimMatch ? parseInt(dimMatch[1]) : 0
  const cnt = await db.get(`SELECT COUNT(*) AS c FROM "${target.name}"`)
  console.log(`声明维度: ${declaredDim}, 文档数: ${cnt.c}`)

  // 2. 检查每条文档的向量是否全零（抽样前5条 + 统计）
  const samples = await db.all(`SELECT id, text, vec_to_json(embedding) AS emb FROM "${target.name}" LIMIT 5`)
  let zeroCount = 0
  for (const s of samples) {
    const arr = s.emb ? JSON.parse(s.emb) : null
    const nonZero = arr ? arr.filter(v => v !== 0).length : -1
    if (nonZero === 0) zeroCount++
    console.log(`  id=${s.id} 维度=${arr ? arr.length : 0} 非零=${nonZero} 文本前15字="${(s.text || '').slice(0, 15).replace(/\n/g, ' ')}"`)
  }
  // 全库统计零向量比例
  const allRows = await db.all(`SELECT vec_to_json(embedding) AS emb FROM "${target.name}"`)
  const totalZero = allRows.filter(r => {
    const a = r.emb ? JSON.parse(r.emb) : null
    return a && a.filter(v => v !== 0).length === 0
  }).length
  console.log(`\n📊 全库零向量统计: ${totalZero}/${allRows.length} 条是零向量 ${totalZero === allRows.length ? '⚠️ 全部失效！' : totalZero === 0 ? '✅ 全部正常' : '⚠️ 部分失效'}`)

  // 3. 用实例句子做 KNN 查询
  console.log('\n========== 用日志实例句子做 KNN 查询 ==========')
  for (const q of QUERY_SENTENCES) {
    console.log(`\n查询: "${q.slice(0, 40)}..."`)
    const qemb = await getEmbedding(q)
    const qNonZero = qemb.filter(v => v !== 0).length
    console.log(`  查询向量维度=${qemb.length} 非零=${qNonZero} ${qNonZero === 0 ? '⚠️ 查询向量也是零！' : ''}`)
    try {
      const rows = await db.all(
        `SELECT id, distance, substr(text,1,25) AS preview FROM "${target.name}" WHERE embedding MATCH ? AND k = 3 ORDER BY distance`,
        '[' + qemb.join(',') + ']'
      )
      console.log(`  返回 ${rows.length} 条:`)
      for (const r of rows) {
        console.log(`    id=${r.id} distance=${r.distance}(${typeof r.distance}) 预览="${r.preview.replace(/\n/g, ' ')}"`)
      }
    } catch (e) {
      console.log(`  查询报错: ${e.message}`)
    }
  }

  await db.close()
}
main().catch(e => { console.error('诊断失败:', e.message); process.exit(1) })
