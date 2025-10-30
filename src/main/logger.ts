import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// 创建日志目录和文件路径
const logDir = path.join(app.getAppPath(), '..', '..', 'logs')
const logFile = path.join(logDir, 'main.log')

// 确保日志目录存在
function ensureLogDir(): void {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  } catch (error) {
    // 如果创建日志目录失败，则只能打印到控制台
    console.error('Failed to create log directory:', error)
  }
}

// 写入日志的方法
function writeLog(message: string): void {
  try {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`
    
    ensureLogDir()
    fs.appendFileSync(logFile, logMessage, 'utf8')
  } catch (error) {
    // 如果写入日志失败，则只能打印到控制台
    console.error('Failed to write to log file:', error)
  }
}

// 在开发环境中导出额外的方法用于测试
if (process.env.NODE_ENV === 'development') {
  Object.assign(global, { writeLog })
}

export { writeLog, logFile }