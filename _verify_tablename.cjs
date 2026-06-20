// 用项目实际依赖的 sqlite3 + vec0 扩展，验证纯数字表名 + 双引号标识符能正确建/插/查/删
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

function sanitizeTableName(name) {
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  if (/^[0-9_]/.test(sanitized)) {
    sanitized = `t_${sanitized}`
  }
  return sanitized
}
function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"'
}
function vectorToSql(vec) {
  return '[' + vec.join(',') + ']'
}

const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

async function main() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)
  const ver = (await db.get('SELECT vec_version() AS v')).v
  console.log('vec0 loaded:', ver)

  const cases = ['123', 'select', '中文仓库', 'my_repo_1', '1abc']
  const dim = 4
  for (const rawName of cases) {
    const tableName = sanitizeTableName(rawName)
    const q = quoteIdent(tableName)
    try {
      await db.exec(
        `CREATE VIRTUAL TABLE ${q} USING vec0(
          id INTEGER PRIMARY KEY,
          text TEXT,
          filename TEXT,
          embedding FLOAT[${dim}] distance=cosine,
          metadata TEXT
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
      await db.exec(`DROP TABLE IF EXISTS ${q}`)
      console.log(`✅ "${rawName}" → tableName="${tableName}" CREATE/INSERT/SELECT/DROP 全通过 (查到 ${rows.length} 行)`)
    } catch (e) {
      console.log(`❌ "${rawName}" → tableName="${tableName}" 失败: ${e.message}`)
    }
  }
  await db.close()
}

main().catch(e => { console.error(e); process.exit(1) })
