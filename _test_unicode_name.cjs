// 验证 vec0 是否支持中文/Unicode 表名（配合双引号标识符）
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"'
}
function vectorToSql(vec) {
  return '[' + vec.join(',') + ']'
}

async function main() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  // 测试各种 sanitize 策略下的表名
  const cases = [
    { raw: '测试数据库', sanitized: '测试数据库' },           // 保留中文
    { raw: '知识库/2024', sanitized: '知识库_2024' },         // 中文+斜杠转下划线
    { raw: '123', sanitized: 't_123' },                       // 数字开头加前缀
    { raw: '我的Repo 1', sanitized: '我的Repo_1' },           // 中文+英文+空格
    { raw: 'select', sanitized: 'select' }                    // 关键字（双引号包裹）
  ]

  for (const { raw, sanitized } of cases) {
    const q = quoteIdent(sanitized)
    try {
      await db.exec(
        `CREATE VIRTUAL TABLE ${q} USING vec0(
          id INTEGER PRIMARY KEY, text TEXT, filename TEXT,
          embedding FLOAT[4] distance=cosine, metadata TEXT
        )`
      )
      const id = Math.floor(Math.random() * 1000)
      await db.run(
        `INSERT INTO ${q} (id, text, filename, embedding, metadata) VALUES (?, ?, ?, ?, ?)`,
        id, 'hello', 'a.txt', vectorToSql([0.1, 0.2, 0.3, 0.4]), '{}'
      )
      const rows = await db.all(
        `SELECT id, text, distance FROM ${q} WHERE embedding MATCH ? AND k = 1 ORDER BY distance`,
        vectorToSql([0.1, 0.2, 0.3, 0.4])
      )
      // 验证 listRepositories 的查询能命中
      const listed = await db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND (rootpage=0 OR sql LIKE '%vec0%')`
      )
      const inList = listed.some(r => r.name === sanitized)
      console.log(`✅ "${raw}" → sanitized="${sanitized}" CREATE/INSERT/SELECT 通过, 在listRepositories结果中=${inList}`)
    } catch (e) {
      console.log(`❌ "${raw}" → sanitized="${sanitized}" 失败: ${e.message}`)
    }
  }
  await db.close()
}
main().catch(e => { console.error(e); process.exit(1) })
