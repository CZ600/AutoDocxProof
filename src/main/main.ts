import { app, BrowserWindow, session } from 'electron' // app是必须引入的，
import path from 'path'

// 将LanceDB原生模块路径添加到PATH环境变量，确保运行时能正确加载

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
      symbolColor: '#807e85ff',
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

  // 判断是否为开发环境
  const isDev = MAIN_WINDOW_VITE_DEV_SERVER_URL !== undefined

  let nativeModulePath
  if (isDev) {
    // 开发环境：假设原生模块在项目根目录的 resources/ 下
    // const projectRoot = app.getAppPath(); // 项目根目录
    // nativeModulePath = path.join(projectRoot, 'resources', 'lancedb-win32-x64-msvc');
    // 开发环境不设置
  } else {
    // 生产环境：原生模块应位于 resources/ 目录下（且需 unpacked）
    const installDir = path.dirname(app.getPath('exe'))
    const resourcesPath = path.join(installDir, 'resources')
    nativeModulePath = path.join(resourcesPath, 'lancedb-win32-x64-msvc')
  }

  process.env.LANCEDB_NATIVE_PATH = nativeModulePath
  process.env.PATH = `${nativeModulePath};${process.env.PATH}`

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
