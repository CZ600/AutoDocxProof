// 端到端验证 sanitizeTableName 新逻辑 + refreshTableDimensions 解析 + listRepositories 过滤
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const VEC0_PATH = require.resolve('sqlite-vec-windows-x64/vec0.dll')

// 复刻修复后的 sanitizeTableName
function sanitizeTableName(name) {
  if (!name || typeof name !== 'string') throw new Error('empty')
  let s = name.replace(/["\x00-\x1f\x7f]/g, '_')
  if (/^[0-9]/.test(s)) s = `t_${s}`
  return s
}
function quoteIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"'
}
function vectorToSql(v) { return '[' + v.join(',') + ']' }

// 复刻修复后的 refreshTableDimensions 正则
function parseDimFromSql(sql) {
  const m = /(\w+)\s*\(?[^)]*FLOAT\[\s*(\d+)\s*\]/.exec(sql || '')
  if (!m) return null
  const s = sql || ''
  const nameMatch =
    /CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i.exec(s) ||
    /CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/i.exec(s) ||
    /CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\[([^\]]+)\]/i.exec(s) ||
    /CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s"`\[\].]+)/i.exec(s)
  return nameMatch ? { name: nameMatch[1], dim: parseInt(m[2], 10) } : null
}

async function main() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.loadExtension(VEC0_PATH)

  const inputs = ['测试数据库', '知识库/2024', '123', '我的Repo 1', 'select', 'MyRepo', '含"引号"的名字']
  console.log('=== 建表 + sanitize 映射 ===')
  for (const raw of inputs) {
    const t = sanitizeTableName(raw)
    const q = quoteIdent(t)
    try {
      await db.exec(`CREATE VIRTUAL TABLE ${q} USING vec0(id INTEGER PRIMARY KEY, text TEXT, filename TEXT, embedding FLOAT[8] distance=cosine, metadata TEXT)`)
      console.log(`  "${raw}" → 表名="${t}"  quoteIdent=${q}  ✅`)
    } catch (e) {
      console.log(`  "${raw}" → 表名="${t}"  ❌ ${e.message}`)
    }
  }

  console.log('\n=== refreshTableDimensions 解析（中文表名能否正确提取维度）===')
  const rows = await db.all(`SELECT sql FROM sqlite_master WHERE type='table' AND sql LIKE '%vec0%'`)
  for (const r of rows) {
    const parsed = parseDimFromSql(r.sql)
    console.log(`  解析到: name="${parsed?.name}", dim=${parsed?.dim}`)
  }

  console.log('\n=== 建表语句原始格式（确认引号包裹的表名长什么样）===')
  const sample = await db.all(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name = '我的Repo 1'`)
  console.log('  sql:', sample[0]?.sql.slice(0, 80))

  await db.close()
}
main().catch(e => { console.error(e); process.exit(1) })
