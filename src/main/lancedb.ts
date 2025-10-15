import { app } from 'electron'
import path from 'path'
import { getEmbedding } from './chat'
import * as arrow from 'apache-arrow'

let lancedb: typeof import('@lancedb/lancedb') | null = null

async function getLanceDB() {
  if (!lancedb) {
    try {
      lancedb = await import('@lancedb/lancedb')
    } catch (error) {
      console.error('Failed to import LanceDB:', error)
      throw error
    }
  }
  return lancedb
}

const DB_PATH = path.join(app.getPath('userData'), 'vector-db')
let db: lancedb.Connection | null = null

// ========================
// 🛠️ 工具函数
// ========================

/**
 * 安全地将 repositoryName 转为合法表名
 */
function sanitizeTableName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Repository name must be a non-empty string')
  }
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
}

/**
 * 生成唯一 ID
 */
function generateId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

/**
 * 创建表的 schema
 */
function createTableSchema(dimension: number): arrow.Schema {
  return new arrow.Schema([
    new arrow.Field('id', new arrow.Int32(), false),
    new arrow.Field('text', new arrow.Utf8(), true),
    new arrow.Field('filename', new arrow.Utf8(), true),
    new arrow.Field('vector', new arrow.FixedSizeList(dimension, new arrow.Field('item', new arrow.Float32())), false),
    new arrow.Field('metadata', new arrow.Utf8(), true) // 存储 JSON 字符串
  ])
}

// ========================
// 🔌 数据库连接管理
// ========================

/**
 * 初始化数据库连接（幂等）
 */
export async function initLanceDB(): Promise<lancedb.Connection> {
  if (!db) {
    try {
      const ldb = await getLanceDB()
      db = await ldb.connect(DB_PATH)
      console.log(`✅ Connected to LanceDB at ${DB_PATH}`)
    } catch (error) {
      console.error('Failed to connect to LanceDB:', error)
      throw new Error(`数据库连接失败: ${error.message}`)
    }
  }
  return db
}

/**
 * 关闭数据库连接
 */
export async function closeLanceDB(): Promise<void> {
  if (db) {
    try {
      // LanceDB 可能没有显式的 close 方法，根据实际 API 调整
      db = null
      console.log('✅ LanceDB connection closed')
    } catch (error) {
      console.error('Failed to close LanceDB:', error)
    }
  }
}

// ========================
// 🗃️ 数据库级操作（跨表）
// ========================

/**
 * 获取所有知识库（表）名称列表
 */
export async function listRepositories(): Promise<string[]> {
  try {
    await initLanceDB()
    const tables = await db!.tableNames()
    // 过滤掉 LanceDB 内部表（通常以下划线开头）
    return tables.filter((name: string) => !name.startsWith('_'))
  } catch (error) {
    console.error('Failed to list repositories:', error)
    throw new Error(`获取知识库列表失败: ${error.message}`)
  }
}

/**
 * 创建一个空的知识库表（不插入数据）
 * @param repositoryName 知识库名称
 * @param modelName embedding 模型名（用于确定向量维度）
 */
export async function createRepository(
  repositoryName: string,
  modelName: string,
  apiKey: string,
  apiURL: string
): Promise<void> {
  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)
    console.log('Creating repository:', repositoryName, 'with model:', modelName)

    // 检查是否已存在
    const existingTables = await db!.tableNames()
    if (existingTables.includes(tableName)) {
      throw new Error(`Repository "${repositoryName}" already exists`)
    }

    // 获取 embedding 维度
    const sampleEmbedding = await getEmbedding('Sample text for schema creation', modelName, apiKey, apiURL)
    const dimension = sampleEmbedding.length

    // 创建表
    const schema = createTableSchema(dimension)
    const ldb = await getLanceDB()
    await db!.createTable(tableName, [], { schema })

    console.log(`✅ Created repository: ${repositoryName} (dim=${dimension})`)
  } catch (error) {
    console.error('Failed to create repository:', error)
    throw new Error(`创建知识库失败: ${error.message}`)
  }
}

/**
 * 删除整个知识库（表）
 */
export async function deleteRepository(repositoryName: string): Promise<void> {
  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)

    const tables = await db!.tableNames()
    if (!tables.includes(tableName)) {
      throw new Error(`Repository "${repositoryName}" does not exist`)
    }

    await db!.dropTable(tableName)
    console.log(`🗑️ Deleted repository: ${repositoryName}`)
  } catch (error) {
    console.error('Failed to delete repository:', error)
    throw new Error(`删除知识库失败: ${error.message}`)
  }
}

// ========================
// 📄 表内文档操作（单表）
// ========================

/**
 * 获取或创建指定知识库的表（内部使用）
 */
export async function getOrCreateTable(
  repositoryName: string,
  modelName: string,
  apiKey: string,
  apiURL: string
): Promise<any> {
  await initLanceDB()
  const tableName = sanitizeTableName(repositoryName)

  // 先尝试打开
  try {
    return await db!.openTable(tableName)
  } catch (openError) {
    // 表不存在，尝试创建
    try {
      const sampleEmbedding = await getEmbedding('Sample text for dimension detection', modelName, apiKey, apiURL)
      const dimension = sampleEmbedding.length
      const schema = createTableSchema(dimension)
      const ldb = await getLanceDB()
      return await db!.createTable(tableName, [], { schema })
    } catch (createError: any) {
      // 如果是因为表已存在而失败，再次尝试打开
      if (createError.message?.includes('already exists') || createError.message?.includes('Table already exists')) {
        return await db!.openTable(tableName)
      }
      console.error('Failed to create table:', createError)
      throw new Error(`创建表失败: ${createError.message}`)
    }
  }
}

/**
 * 插入文档（自动生成 ID）
 */
export async function insertDocument(
  repositoryName: string,
  text: string,
  filename: string,
  metadata: Record<string, any> = {},
  modelName: string,
  apiKey: string,
  apiURL: string
): Promise<{ id: number; text: string; filename: string; metadata: Record<string, any> }> {
  if (!filename) {
    throw new Error('filename is required')
  }
  if (!text || text.trim().length === 0) {
    throw new Error('text cannot be empty')
  }

  try {
    const table = await getOrCreateTable(repositoryName, modelName, apiKey, apiURL)
    const embedding = await getEmbedding(text, modelName, apiKey, apiURL)
    const id = generateId()

    await table.add([
      {
        id,
        text,
        filename,
        vector: embedding,
        metadata: JSON.stringify(metadata)
      }
    ])

    console.log(`📥 Inserted doc into ${repositoryName} (file: ${filename}, id: ${id})`)
    return { id, text, filename, metadata }
  } catch (error) {
    console.error('Failed to insert document:', error)
    throw new Error(`插入文档失败: ${error.message}`)
  }
}

/**
 * 查询相似文档（支持按 filename 过滤）
 * @param filter SQL WHERE 子句条件（不包括 filename），例如: "id > 100"
 */
export async function queryDocuments(
  repositoryName: string,
  queryText: string,
  modelName: string,
  apiKey: string,
  apiURL: string,
  limit: number = 5,
  filter: string = '',
  filename?: string
): Promise<Array<{ id: number; text: string; filename: string; score: number; meta: any }>> {
  try {
    const table = await getOrCreateTable(repositoryName, modelName, apiKey, apiURL)
    const embedding = await getEmbedding(queryText, modelName, apiKey, apiURL)
    console.log('qureyText:', queryText)

    let whereClause = filter
    if (filename) {
      // 转义单引号以防止 SQL 注入
      const pureFilename = path.basename(filename)
      const escapedFilename = pureFilename.replace(/'/g, "''")
      whereClause = whereClause
        ? `filename = '${escapedFilename}' AND (${whereClause})`
        : `filename = '${escapedFilename}'`
    }

    let searchQuery = table.search(embedding).limit(limit)
    if (whereClause) {
      searchQuery = searchQuery.where(whereClause)
    }

    const results = await searchQuery.toArray()
    const resultMap = results.map((r: any) => ({
      id: r.id,
      text: r.text,
      filename: r.filename,
      score: r._distance,
      meta: r.metadata ? JSON.parse(r.metadata) : {}
    }))
    resultMap.forEach((element: any) => {
      console.log('the query result text:', element.text)
      console.log('the query result score:', element.score)
    })
    console.log(`🔍 RAG查询详情:
  仓库: ${repositoryName}
  查询文本: ${queryText.substring(0, 50)}...
  实际WHERE条件: ${whereClause}
  返回结果数: ${results.length}
  首条结果分数: ${results[0]?._distance}`)
    return resultMap
  } catch (error) {
    console.error('Failed to query documents:', error)
    throw new Error(`查询文档失败: ${error.message}`)
  }
}

/**
 * 查询指定文件的所有文档（非向量搜索，全量返回）
 */
export async function getDocumentsByFilename(
  repositoryName: string,
  filename: string
): Promise<Array<{ id: number; text: string; filename: string; meta: any }>> {
  if (!filename) {
    throw new Error('filename is required')
  }

  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)
    const table = await db!.openTable(tableName)

    const escapedFilename = filename.replace(/'/g, "''")

    // 使用 query().where() 替代 filter()
    const results = await table.query().where(`filename = '${escapedFilename}'`).toArray()

    return results.map((r: any) => ({
      id: r.id,
      text: r.text,
      filename: r.filename,
      meta: r.metadata ? JSON.parse(r.metadata) : {}
    }))
  } catch (error) {
    console.error('Failed to get documents by filename:', error)
    throw new Error(`获取文件文档失败: ${error.message}`)
  }
}

/**
 * 删除指定文件的所有文档（弃用）
 */
export async function deleteDocumentsByFilename(repositoryName: string, filename: string): Promise<number> {
  if (!filename) {
    throw new Error('filename is required')
  }

  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)
    const table = await db!.openTable(tableName)

    const escapedFilename = filename.replace(/'/g, "''")
    await table.delete(`filename = '${escapedFilename}'`)

    console.log(`🗑️ Deleted all docs with filename: ${filename} in ${repositoryName}`)

    // LanceDB 的 delete 方法可能不返回删除数量，这里返回 1 表示操作成功
    return 1
  } catch (error) {
    console.error('Failed to delete documents by filename:', error)
    throw new Error(`删除文件文档失败: ${error.message}`)
  }
}

/**
 * 更新文档（保留 filename 不变）
 */
export async function updateDocument(
  repositoryName: string,
  id: number,
  newText: string,
  newMeta: Record<string, any> = {},
  modelName: string,
  apiKey: string,
  apiURL: string
): Promise<{ id: number; text: string; meta: Record<string, any> }> {
  try {
    const table = await getOrCreateTable(repositoryName, modelName, apiKey, apiURL)
    const embedding = await getEmbedding(newText, modelName, apiKey, apiURL)

    // 先查询获取原始 filename
    const existingDocs = await table.query().where(`id = ${id}`).limit(1).toArray()

    if (existingDocs.length === 0) {
      throw new Error(`Document with id ${id} not found`)
    }

    const existingDoc = existingDocs[0]

    // 使用 LanceDB 的 update 方法
    await table.update({
      where: `id = ${id}`,
      values: {
        text: newText,
        vector: embedding,
        metadata: JSON.stringify(newMeta)
      }
    })

    console.log(`✏️ Updated doc ${id} in ${repositoryName}`)
    return { id, text: newText, meta: newMeta }
  } catch (error) {
    console.error('Failed to update document:', error)
    throw new Error(`更新文档失败: ${error.message}`)
  }
}

/**
 * 删除单个文档（按 ID）
 */
export async function deleteDocument(repositoryName: string, id: number): Promise<{ id: number }> {
  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)
    const table = await db!.openTable(tableName)

    await table.delete(`id = ${id}`)
    console.log(`🗑️ Deleted doc ${id} from ${repositoryName}`)

    return { id }
  } catch (error) {
    console.error('Failed to delete document:', error)
    throw new Error(`删除文档失败: ${error.message}`)
  }
}

/**
 * 删除指定文件名的所有文档（修复后的版本）
 */
export async function deleteDocumentByName(repositoryName: string, filename: string): Promise<{ filename: string }> {
  if (!filename) {
    throw new Error('filename is required')
  }

  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)
    const table = await db!.openTable(tableName)

    const escapedFilename = filename.replace(/'/g, "''")
    await table.delete(`filename = '${escapedFilename}'`)

    console.log(`🗑️ Deleted docs with filename: ${filename} from ${repositoryName}`)

    return { filename }
  } catch (error) {
    console.error('Failed to delete document by name:', error)
    throw new Error(`删除文档失败: ${error.message}`)
  }
}

/**
 * 获取指定知识库中所有不重复的文件名列表
 * @param repositoryName 知识库名称
 * @returns 去重后的文件名数组
 */
export async function listFilenamesInRepository(repositoryName: string): Promise<string[]> {
  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)

    // 检查表是否存在
    const tables = await db!.tableNames()
    if (!tables.includes(tableName)) {
      throw new Error(`Repository "${repositoryName}" does not exist`)
    }

    const table = await db!.openTable(tableName)

    // 查询所有文档的filename字段
    const results = await table.query().select('filename').toArray()

    // 提取并去重文件名
    const filenames = [...new Set(results.map((r: any) => r.filename).filter(Boolean))]

    console.log(`📁 Found ${filenames.length} unique filenames in ${repositoryName}`)
    return filenames
  } catch (error) {
    console.error('Failed to list filenames:', error)
    throw new Error(`获取文件名列表失败: ${error.message}`)
  }
}

/**
 * 查询指定表中的所有对象
 * @param repositoryName 知识库名称
 * @returns 表中所有文档的数组
 */
export async function getAllDocuments(
  repositoryName: string
): Promise<Array<{ id: number; text: string; filename: string; meta: any }>> {
  try {
    await initLanceDB()
    const tableName = sanitizeTableName(repositoryName)

    // 检查表是否存在
    const tables = await db!.tableNames()
    if (!tables.includes(tableName)) {
      throw new Error(`Repository "${repositoryName}" does not exist`)
    }

    const table = await db!.openTable(tableName)

    // 查询所有文档
    const results = await table.query().toArray()

    return results.map((r: any) => ({
      id: r.id,
      text: r.text,
      filename: r.filename,
      meta: r.metadata ? JSON.parse(r.metadata) : {}
    }))
  } catch (error) {
    console.error('Failed to get all documents:', error)
    throw new Error(`获取所有文档失败: ${error.message}`)
  }
}
