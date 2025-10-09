import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import path from 'path'
import { getEmbedding } from './chat' // 引入您提供的embedding函数

// 数据库存储路径（使用Electron的userData目录）
const DB_PATH = path.join(app.getPath('userData'), 'vector-db')
let db: any
let table: any

/**
 * 初始化LanceDB连接
 * LanceDB可以作为嵌入式向量数据库运行，适合本地AI应用 [[6]]
 */
export async function initLanceDB() {
  try {
    db = await lancedb.connect(DB_PATH)
    console.log(`Connected to LanceDB at ${DB_PATH}`)
    return db
  } catch (error) {
    console.error('Failed to connect to LanceDB:', error)
    throw error
  }
}

/**
 * 获取或创建文档表
 * LanceDB支持创建表并在需要时自动推断模式 [[9]]
 */
export async function getOrCreateTable(modelName: string, apiKey: string, apiURL: string) {
  if (table) return table

  try {
    // 尝试打开现有表
    table = await db.openTable('documents')
    console.log('Using existing documents table')
    return table
  } catch (error) {
    // 表不存在，创建新表
    console.log('Documents table not found, creating new table...')

    // 生成示例embedding以获取向量维度
    const sampleEmbedding = await getEmbedding('Sample text for dimension detection', modelName, apiKey, apiURL)
    const dimension = sampleEmbedding.length

    // 创建表结构，LanceDB需要指定向量维度 [[3]]
    const schema = [
      { name: 'id', type: 'int32' },
      { name: 'text', type: 'string' },
      { name: 'vector', type: { type: 'vector', dimension: dimension } },
      { name: 'metadata', type: 'struct' }
    ]

    table = await db.createTable('documents', [], {
      schema,
      existOk: true // 如果表已存在则直接使用 [[9]]
    })

    console.log(`Created new documents table with vector dimension: ${dimension}`)
    return table
  }
}

/**
 * 插入文档到向量数据库
 * 支持自动创建表并在插入前生成embedding [[4]]
 */
export async function insertDocument(
  text: string,
  id: number,
  metadata: Record<string, any> = {},
  modelName: string,
  apiKey: string,
  apiURL: string
) {
  if (!db) await initLanceDB()

  // 生成embedding向量
  const embedding = await getEmbedding(text, modelName, apiKey, apiURL)

  // 获取或创建表
  const tbl = await getOrCreateTable(modelName, apiKey, apiURL)

  // 插入数据
  await tbl.add([
    {
      id,
      text,
      vector: embedding,
      metadata
    }
  ])

  console.log(`Document inserted with ID: ${id}`)
  return { id, text, metadata }
}

/**
 * 查询相似文档（向量搜索）
 * 使用LanceDB的向量搜索功能执行相似度查询 [[4]]
 */
export async function queryDocuments(
  queryText: string,
  modelName: string,
  apiKey: string,
  apiURL: string,
  limit: number = 5,
  filter: string = ''
) {
  if (!db) await initLanceDB()

  // 生成查询embedding
  const embedding = await getEmbedding(queryText, modelName, apiKey, apiURL)

  // 获取表
  const tbl = await getOrCreateTable(modelName, apiKey, apiURL)
  if (!tbl) throw new Error('Documents table does not exist')

  // 执行向量搜索
  let searchQuery = tbl.search(embedding).limit(limit)

  // 应用过滤器（如果提供）
  if (filter) {
    searchQuery = searchQuery.where(filter)
  }

  const results = await searchQuery.toArray()

  // 转换结果格式
  return results.map((result: any) => ({
    id: result.id,
    text: result.text,
    score: result._distance, // 相似度分数（距离越小越相似）
    metadata: result.metadata
  }))
}

/**
 * 更新文档
 * LanceDB支持更新操作，可以修改现有记录 [[3]]
 */
export async function updateDocument(
  id: number,
  newText: string,
  newMetadata: Record<string, any> = {},
  modelName: string,
  apiKey: string,
  apiURL: string
) {
  if (!db) await initLanceDB()

  // 生成新的embedding
  const embedding = await getEmbedding(newText, modelName, apiKey, apiURL)

  // 获取表
  const tbl = await getOrCreateTable(modelName, apiKey, apiURL)
  if (!tbl) throw new Error('Documents table does not exist')

  // 执行更新
  await tbl.update(
    [
      {
        id,
        text: newText,
        vector: embedding,
        metadata: newMetadata
      }
    ],
    { where: `id = ${id}` }
  )

  console.log(`Document updated with ID: ${id}`)
  return { id, text: newText, metadata: newMetadata }
}

/**
 * 删除文档
 * 使用LanceDB的删除功能移除指定文档 [[3]]
 */
export async function deleteDocument(id: number) {
  if (!db) await initLanceDB()

  // 获取表
  const tbl = await getOrCreateTable('default', 'dummy', 'dummy')
  if (!tbl) throw new Error('Documents table does not exist')

  // 执行删除
  await tbl.delete(`id = ${id}`)

  console.log(`Document deleted with ID: ${id}`)
  return { id }
}

/**
 * 获取所有文档（仅用于调试）
 */
export async function getAllDocuments() {
  if (!db) await initLanceDB()

  const tbl = await getOrCreateTable('default', 'dummy', 'dummy')
  if (!tbl) throw new Error('Documents table does not exist')

  return await tbl.toArrow()
}
