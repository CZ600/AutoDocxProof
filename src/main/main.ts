import { app, BrowserWindow, session } from 'electron' // app是必须引入的，
import path from 'path'
import { registerIpcHandlers } from './ipcHandlers'
import { initLanceDB } from './lancedb'
// main.js 或主进程中的其他文件
// main.js 或打包入口

// 为pdf-parse库提供浏览器API的polyfill
// 为了在nodejs环境下正常使用pdf-parse库而添加的
if (typeof (global as any).DOMMatrix === 'undefined') {
  ;(global as any).DOMMatrix = class DOMMatrix {
    constructor() {
      // 空实现
    }
  }
}

if (typeof (global as any).ImageData === 'undefined') {
  ;(global as any).ImageData = class ImageData {
    constructor() {
      // 空实现
    }
  }
}

if (typeof (global as any).Path2D === 'undefined') {
  ;(global as any).Path2D = class Path2D {
    constructor() {
      // 空实现
    }
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 1200,
    title: 'AutoDocxProofreading',
    // autoHideMenuBar: true, // 禁用菜单栏
    icon: path.join(process.resourcesPath, 'assets', 'logo.ico'),

    ...(process.platform === 'linux' ? { icon: path.join(process.resourcesPath, 'assets', 'logo.ico') } : {}),

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    // 设置窗口样式
    // remove the default titlebar
    titleBarStyle: 'hidden',
    // expose window controls in Windows/Linux
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
    titleBarOverlay: {
      color: 'rgba(255, 255, 255, 0)',
      symbolColor: '#011216ff',
      height: 60
    }
  })

  // load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

app.whenReady().then(async () => {
  // 当应用准备好之后，回调函数
  console.log('app is ready')
  console.log('then will create a window')

  console.log('中文测试')
  createWindow()

  // 设置 Content-Security-Policy（CSP），跨站脚本攻击 (XSS) 和其他代码注入攻击
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["script-src 'self'"]
      }
    })
  })
  // 当窗口被激活的时候，要判断是否有窗口打开，如果没有打开，那么就创建一个窗口（也是针对苹果系统作出的优化）
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
  // 进行数据库初始化操作
  try {
    await initLanceDB()
    console.log('LanceDB initialized successfully')
  } catch (error) {
    console.error('Failed to initialize LanceDB:', error)
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // 当所有的窗口都关闭的时候并且不是macos的时候，那么关闭软件
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

registerIpcHandlers()
