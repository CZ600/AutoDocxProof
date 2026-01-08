// composables/useProxy.ts
import { computed, ref, watch } from 'vue'
import { useProxyStore } from '../stores/proxyStore'
import { ElMessage } from 'element-plus'
import { error } from 'node:console'

/**
 * 代理设置管理
 * 封装代理的启用、禁用、端口设置等操作
 */
export function useProxy() {
    const proxyStore = useProxyStore()

    // 使用计算属性获取和处理代理状态
    const proxyEnabled_ = computed({
        get: () => {
            return proxyStore.proxySettings.enabled

        },
        set: (enabled: boolean) => {
            proxyStore.setProxySettings(enabled, proxyPort_.value)
        }
    })

    const proxyPort_ = computed({
        get: () => {
            return proxyStore.proxySettings.port
        },
        set: (port: number) => {
            proxyStore.setProxySettings(proxyEnabled_.value, port)
        }
    })

    // 设置代理参数
    const setProxyPort_ = (port: number) => {
        try {
            proxyPort_.value = port
            ElMessage
        }
        catch (err) {
            console.log('set port error:', err)
            ElMessage(
                {
                    type: 'error',
                    message: "代理设置失败：${err}!"
                }
            )
        }
    }

    return {
        // 状态
        proxyEnabled_,
        proxyPort_,
    }
}
