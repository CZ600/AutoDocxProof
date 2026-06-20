// 诊断用户真实 knowledge.db：检查 embedding 数据是否正常、KNN 查询 distance 是否为 null
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const os = require('os')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'AutoDocxProofreading', 'vector-db', 'knowledge.db')

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  // 1. 列出所有 vec0 虚拟表
  const tables = await db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`
  )
  console.log('知识库（虚拟表）:', tables.map(t => t.name))

  for (const { name } of tables) {
    console.log(`\n========== 检查表: ${name} ==========`)
    // 2. 看建表语句里的维度
    const ddl = await db.get(`SELECT sql FROM sqlite_master WHERE name = ?`, name)
    const dimMatch = /FLOAT\[\s*(\d+)\s*\]/.exec(ddl.sql || '')
    console.log(`  声明维度: ${dimMatch ? dimMatch[1] : '未知'}`)

    // 3. 统计行数
    const cnt = await db.get(`SELECT COUNT(*) AS c FROM "${name}"`)
    console.log(`  文档数: ${cnt.c}`)

    // 4. 取一条数据，看 embedding 长什么样
    const sample = await db.get(`SELECT id, text, embedding, vec_to_json(embedding) AS emb_json FROM "${name}" LIMIT 1`)
    if (sample) {
      const embArr = sample.emb_json ? JSON.parse(sample.emb_json) : null
      console.log(`  样本 id=${sample.id}, text 前20字="${(sample.text || '').slice(0, 20)}"`)
      console.log(`  样本 embedding 维度: ${embArr ? embArr.length : 'null/解析失败'}`)
      console.log(`  样本 embedding 前5个值: ${embArr ? embArr.slice(0, 5).map(v => v.toFixed(4)) : 'null'}`)
      // 检查是否全零向量（坏数据常见特征）
      if (embArr) {
        const nonZero = embArr.filter(v => v !== 0).length
        console.log(`  非零元素数: ${nonZero}/${embArr.length} ${nonZero === 0 ? '⚠️ 全零向量！' : ''}`)
      }
    } else {
      console.log('  表为空')
    }

    // 5. 关键：做一次真实 KNN 查询，看 distance 是否为 null
    //    用样本自己的向量查自己，distance 应该接近 0
    if (sample && sample.emb_json) {
      try {
        const knn = await db.all(
          `SELECT id, distance FROM "${name}" WHERE embedding MATCH ? AND k = 3 ORDER BY distance`,
          sample.emb_json
        )
        console.log(`  KNN 自查询 distance: ${knn.map(r => `${r.id}=${r.distance}(${typeof r.distance})`).join(', ')}`)
      } catch (e) {
        console.log(`  KNN 查询报错: ${e.message}`)
      }
    }
  }

  await db.close()
}
main().catch(e => { console.error('诊断失败:', e.message); process.exit(1) })
