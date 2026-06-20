// 删除所有维度异常（非768）的 vec0 虚拟表及其 shadow tables
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const os = require('os')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'AutoDocxProofreading', 'vector-db', 'knowledge.db')
const CORRECT_DIM = 768

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  const tables = await db.all(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`
  )
  const bad = []
  for (const t of tables) {
    const dimMatch = /FLOAT\[\s*(\d+)\s*\]/.exec(t.sql || '')
    const dim = dimMatch ? parseInt(dimMatch[1]) : 0
    if (dim !== CORRECT_DIM) bad.push({ name: t.name, dim })
  }

  if (bad.length === 0) {
    console.log('✅ 没有维度异常的表，无需清理')
    await db.close()
    return
  }

  console.log(`发现 ${bad.length} 个维度异常的表，准备删除:`)
  for (const b of bad) {
    console.log(`  - ${b.name} (维度=${b.dim})`)
    // DROP 虚拟表会自动级联删除其 shadow tables
    await db.exec(`DROP TABLE IF EXISTS "${b.name}"`)
  }
  console.log('\n✅ 清理完成')

  // 确认剩余
  const remaining = await db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND (rootpage=0 OR sql LIKE '%vec0%')`
  )
  console.log(`剩余知识库表: ${remaining.length ? remaining.map(r => r.name).join(', ') : '(空)'}`)
  await db.close()
}
main().catch(e => { console.error(e.message); process.exit(1) })
