// electron-builder afterPack 钩子：在打包后、签名前 flip Electron Fuses
// 替代原 electron-forge 的 FusesPlugin，与旧配置的安全开关完全等价
// 文档参考: https://www.electron.build/docs/tutorials/adding-electron-fuses/
const path = require('path')
const fs = require('fs')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName
  // electron-builder 的 context 用 appOutDir（不是 appOutPath）
  const appOutPath = context.appOutDir || context.appOutPath || context.outDir

  // 定位 electron 可执行文件。不依赖 packager API 的不确定属性，
  // 直接用 fs 在 appOutPath 下查找（排除卸载器/Squirrel 等干扰 exe）
  let electronPath
  if (platform === 'darwin') {
    // macOS: 在 .app/Contents/MacOS/ 下，可执行文件名 = app 名
    const appFiles = fs.readdirSync(appOutPath).filter(f => f.endsWith('.app'))
    if (appFiles.length !== 1) {
      throw new Error(`afterPack(darwin): 无法定位 .app，候选: ${appFiles.join(', ')}`)
    }
    const appName = appFiles[0].replace(/\.app$/, '')
    electronPath = path.join(appOutPath, appFiles[0], 'Contents', 'MacOS', appName)
  } else {
    // win32 / linux: 在 appOutPath 根目录，排除卸载器/Squirrel
    const candidates = fs
      .readdirSync(appOutPath)
      .filter(f => {
        const lower = f.toLowerCase()
        if (platform === 'win32' && !lower.endsWith('.exe')) return false
        // 排除卸载器、Squirrel 工具
        return !/uninstall|squirrel|setup/i.test(lower)
      })
    if (candidates.length === 0) {
      throw new Error(`afterPack(${platform}): appOutPath 下找不到可执行文件: ${appOutPath}`)
    }
    // 取第一个（通常只有一个主 exe）
    electronPath = path.join(appOutPath, candidates[0])
  }

  await flipFuses(electronPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true
  })
}
