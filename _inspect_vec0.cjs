const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

async function main() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  await db.exec(
    `CREATE VIRTUAL TABLE t_123 USING vec0(
      id INTEGER PRIMARY KEY,
      text TEXT,
      filename TEXT,
      embedding FLOAT[4] distance=cosine,
      metadata TEXT
    )`
  )

  console.log('=== sqlite_master 所有表 ===')
  const rows = await db.all(`SELECT name, type, rootpage, sql FROM sqlite_master WHERE type='table'`)
  for (const r of rows) {
    const sqlPreview = (r.sql || '(NULL)').slice(0, 60).replace(/\n/g, ' ')
    console.log(`  name=${r.name.padEnd(28)} type=${r.type} rootpage=${String(r.rootpage).padEnd(3)} sql=${sqlPreview}`)
  }

  console.log('\n=== 只挑虚拟表（rootpage=0 或 sql 含 vec0） ===')
  const vtables = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`)
  console.log(vtables.map(r => r.name))

  console.log('\n=== 测试 DROP TABLE t_123 后是否自动清理 shadow tables ===')
  await db.exec(`DROP TABLE IF EXISTS "t_123"`)
  const after = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`)
  console.log('DROP 后剩余表:', after.map(r => r.name))

  await db.close()
}
main().catch(e => { console.error(e); process.exit(1) })
