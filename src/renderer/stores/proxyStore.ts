import { defineStore } from 'pinia'
import { reactive } from 'vue'

export interface ProxySettings {
  enabled: boolean
  port: number
}

const defaultProxySettings: ProxySettings = {
  enabled: false,
  port: 33210
}

export const useProxyStore = defineStore(
  'proxySettings',
  () => {
    const proxySettings = reactive<ProxySettings>({ ...defaultProxySettings })

    async function setProxySettings(enabled: boolean, port: number) {
      proxySettings.enabled = enabled
      proxySettings.port = port

      const electronAPI = window.electronAPI
      if (electronAPI && electronAPI.setProxySettings) {
        try {
          const result = await electronAPI.setProxySettings(enabled, port)
          if (!result.success) {
            console.error('Failed to apply proxy settings:', result.error)
            return false
          }
          return true
        } catch (error) {
          console.error('Error calling setProxySettings:', error)
          return false
        }
      }
      return false
    }

    return {
      proxySettings,
      setProxySettings
    }
  },
  {
    persist: {
      key: 'proxySettings',
      storage: localStorage,
      paths: ['proxySettings']
    }
  }
)
