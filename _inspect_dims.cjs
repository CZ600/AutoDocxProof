// 检查所有知识库表的声明维度，找出维度错误的表
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const os = require('os')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'AutoDocxProofreading', 'vector-db', 'knowledge.db')

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  const tables = await db.all(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`
  )
  console.log(`共 ${tables.length} 个知识库表:\n`)
  for (const t of tables) {
    const dimMatch = /FLOAT\[\s*(\d+)\s*\]/.exec(t.sql || '')
    const dim = dimMatch ? parseInt(dimMatch[1]) : 0
    const cnt = await db.get(`SELECT COUNT(*) AS c FROM "${t.name}"`)
    // nomic 标准是 768 维；192 维是之前 base64 bug 的产物
    const status = dim === 768 ? '✅ 正确(768)' : `⚠️ 维度异常(${dim})，需删除重建`
    console.log(`  ${t.name}: 维度=${dim}, 文档数=${cnt.c}  ${status}`)
  }
  await db.close()
}
main().catch(e => { console.error(e.message); process.exit(1) })
