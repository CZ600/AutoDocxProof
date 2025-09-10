import { app } from 'electron' // 新增导入
import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'
import path from 'path' // 新增导入
import fs from 'fs'
import { promises } from 'dns'
// 定义数据类型（TypeScript 类型安全）
export interface User {
  id?: number
  name: string
  email: string
  created_at?: string
}

export interface apiSettings {
  id?: number
  apiURL: string
  apiKey: string
  modelName: string
  created_at?: string
}

export class DB {
  private static instance: Database
  // 使用系统标准路径
  private static get DB_PATH(): string {
    // 获取系统标准用户数据目录
    const userDataPath = app.getPath('userData')
    // 创建 data 子目录（避免污染根目录）
    return path.join(userDataPath, 'data', 'app.db')
  }
  static async getInstance(): Promise<Database> {
    if (!DB.instance) {
      // 确保目录存在（自动创建）
      const dir = path.dirname(DB.DB_PATH)
      await fs.promises.mkdir(dir, { recursive: true })

      DB.instance = await open({
        filename: DB.DB_PATH,
        driver: sqlite3.Database
      })

      // 初始化表结构
      await DB.instance.exec(`
        CREATE TABLE IF NOT EXISTS api_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          apiURL TEXT NOT NULL,
          apiKey TEXT NOT NULL,
          modelName TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }
    return DB.instance
  }

  /**
   * 插入一条 API 设置记录
   * @param setting apiSettings 对象（不含 id）
   * @returns 新记录的 id
   */
  static async insetAPISetting(settings: Omit<apiSettings, 'id' | 'created_at'>): // omit 删除 id 和 created_at 字段
  Promise<number> {
    const db = await DB.getInstance()
    const result = await db.run(
      `INSERT INTO api_settings (apiURL,apiKey,modelName) VALUES (?,?,?))`,
      settings.apiURL,
      settings.apiKey,
      settings.modelName
    )
    return result.lastID
  }

  // 根据id查询api记录

  static async getAPISettingById(id: number): Promise<apiSettings | null> {
    const db = await DB.getInstance()
    const result = await db.get(`SELECT * FROM api_settings WHERE id = ?`, id)
    return result || null
  }
  // 删除指定的数据集
  static async deleteAPISettingById(id: number): Promise<void> {
    const db = await DB.getInstance()
    await db.run(`DELETE FROM api_settings WHERE id = ?`, id)
  }

  // 删除所有数据集
  static async deleteALLSettings(): Promise<void> {
    const db = await DB.getInstance()
    await db.run(`DELETE FROM api_settings`)
  }

  /**
   * 查询所有 API 设置记录
   * @returns apiSettings 数组
   */
  static async getAllAPISettings(): Promise<apiSettings[]> {
    // 返回apiSettings 数组
    const db = await DB.getInstance()
    const rows = await db.all<apiSettings[]>(
      `SELECT id, apiURL, apiKey, modelName, created_at FROM api_settings ORDER BY created_at DESC`
    )
    return rows
  }
}
