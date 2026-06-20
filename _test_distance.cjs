// 探测 sqlite-vec KNN 查询返回的距离列到底叫什么名字
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

async function main() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)
  await db.exec(
    `CREATE VIRTUAL TABLE t USING vec0(id INTEGER PRIMARY KEY, text TEXT, embedding FLOAT[4] distance=cosine)`
  )
  await db.run(`INSERT INTO t (id, text, embedding) VALUES (1, 'aa', '[1,0,0,0]')`)
  await db.run(`INSERT INTO t (id, text, embedding) VALUES (2, 'bb', '[0,1,0,0]')`)

  console.log('=== 用 SELECT id, text, distance 试探 ===')
  try {
    const rows = await db.all(`SELECT id, text, distance FROM t WHERE embedding MATCH ? AND k = 2 ORDER BY distance`, '[1,0,0,0]')
    console.log('distance 列:', JSON.stringify(rows))
  } catch (e) { console.log('distance 列报错:', e.message) }

  console.log('\n=== 用 SELECT * 看所有列 ===')
  try {
    const rows = await db.all(`SELECT * FROM t WHERE embedding MATCH ? AND k = 2`, '[1,0,0,0]')
    console.log('SELECT *:', JSON.stringify(rows))
  } catch (e) { console.log('SELECT * 报错:', e.message) }

  console.log('\n=== 用 vec_distance / _distance 试探 ===')
  for (const col of ['_distance', 'vec_distance', 'similarity', 'score']) {
    try {
      const rows = await db.all(`SELECT id, ${col} FROM t WHERE embedding MATCH ? AND k = 1`, '[1,0,0,0]')
      console.log(`${col}:`, JSON.stringify(rows))
    } catch (e) { console.log(`${col} 报错:`, e.message) }
  }

  console.log('\n=== 模拟真实：用 ? 参数化绑定 JSON 字符串向量 ===')
  const queryVec = '[1,0,0,0]'
  try {
    const rows = await db.all(`SELECT id, text, distance FROM t WHERE embedding MATCH ? AND k = 2 ORDER BY distance`, queryVec)
    console.log('参数化绑定:', JSON.stringify(rows))
    console.log('distance 类型:', rows.map(r => `${r.id}: score=${r.distance} (${typeof r.distance})`))
  } catch (e) { console.log('参数化绑定报错:', e.message) }

  console.log('\n=== 模拟带 filename 列的真实表结构 ===')
  await db.exec(`DROP TABLE t`)
  await db.exec(
    `CREATE VIRTUAL TABLE t USING vec0(id INTEGER PRIMARY KEY, text TEXT, filename TEXT, embedding FLOAT[4] distance=cosine, metadata TEXT)`
  )
  await db.run(`INSERT INTO t (id, text, filename, embedding, metadata) VALUES (1, 'aa', 'f.txt', '[1,0,0,0]', '{}')`)
  await db.run(`INSERT INTO t (id, text, filename, embedding, metadata) VALUES (2, 'bb', 'f.txt', '[0,1,0,0]', '{}')`)
  try {
    const rows = await db.all(
      `SELECT id, text, filename, distance, metadata FROM t WHERE embedding MATCH ? AND k = 2 ORDER BY distance`,
      queryVec
    )
    console.log('完整结构:', JSON.stringify(rows, null, 2))
  } catch (e) { console.log('完整结构报错:', e.message) }

  await db.close()
}
main().catch(e => { console.error(e); process.exit(1) })
