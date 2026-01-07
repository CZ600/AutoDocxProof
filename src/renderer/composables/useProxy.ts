// composables/useProxy.ts
import { ref, watch } from 'vue'
import { useProxyStore } from '../stores/proxyStore'
import { ElMessage } from 'element-plus'

/**
 * 代理设置管理
 * 封装代理的启用、禁用、端口设置等操作
 */
export function useProxy() {
    const proxyStore = useProxyStore()

    // 代理状态
    const proxyEnabled = ref(false)
    const proxyPort = ref(33210)

    /**
     * 初始化 - 从 store 恢复设置
     */
    const initialize = () => {
        if (proxyStore.proxySettings.enabled) {
            proxyEnabled.value = proxyStore.proxySettings.enabled
            proxyPort.value = proxyStore.proxySettings.port
        }
    }

    /**
     * 设置代理状态
     */
    const setProxyEnabled = async (enabled: boolean) => {
        const success = await proxyStore.setProxySettings(enabled, proxyPort.value)
        if (success) {
            proxyEnabled.value = enabled
            ElMessage.success(enabled ? '代理已启用' : '代理已禁用')
        } else {
            ElMessage.error('代理设置失败')
            // 回滚
            proxyEnabled.value = !enabled
        }
        return success
    }

    /**
     * 设置代理端口
     */
    const setProxyPort = async (port: number) => {
        if (proxyEnabled.value) {
            const success = await proxyStore.setProxySettings(proxyEnabled.value, port)
            if (success) {
                proxyPort.value = port
                ElMessage.success(`代理端口已更新: ${port}`)
            } else {
                ElMessage.error('代理端口设置失败')
            }
            return success
        }
        // 如果代理未启用，只更新本地值
        proxyPort.value = port
        return true
    }

    return {
        // 状态
        proxyEnabled,
        proxyPort,

        // 方法
        initialize,
        setProxyEnabled,
        setProxyPort
    }
}
