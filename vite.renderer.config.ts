import type { ConfigEnv, UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { pluginExposeRenderer } from './vite.base.config'
import path from 'path'

// https://vitejs.dev/config
export default defineConfig(env => {
  const forgeEnv = env as ConfigEnv<'renderer'>
  const { root, mode, forgeConfigSelf } = forgeEnv
  const name = forgeConfigSelf.name ?? ''

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`
    },
    plugins: [
      pluginExposeRenderer(name),
      vue(),
      VueI18nPlugin({
        include: path.resolve(__dirname, 'src/renderer/i18n/locales/**')
      })
    ],
    resolve: {
      preserveSymlinks: true,
      alias: {
        'vue-i18n': path.resolve(__dirname, 'node_modules/vue-i18n/dist/vue-i18n.runtime.mjs')
      }
    },
    clearScreen: false
  } as UserConfig
})
