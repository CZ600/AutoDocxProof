// composables/useToken.ts
import { computed } from 'vue'
import { useApiStore } from '../stores/apiStore'
import { ElMessageBox, ElMessage } from 'element-plus'

/**
 * Token 使用统计管理
 * 封装 token 相关的状态和操作
 */
export function useToken() {
    const apiStore = useApiStore()

    // 计算属性 - 当前 token 使用量
    const totalTokens = computed(() => apiStore.tokenUsage.totalTokens)

    // 计算属性 - 请求次数
    const requestCount = computed(() => apiStore.tokenUsage.requestCount)

    // 计算属性 - 上次重置时间
    const lastResetTime = computed(() => apiStore.tokenUsage.lastResetTime)

    /**
     * 添加 token 使用量
     */
    const addTokens = (tokens: number) => {
        apiStore.addTotalTokens(tokens)
    }

    /**
     * 重置 token 统计
     */
    const resetTokens = async () => {
        try {
            await ElMessageBox.confirm(
                '是否要清空token记录?',
                'Warning',
                {
                    confirmButtonText: '确认',
                    cancelButtonText: '取消',
                    type: 'warning',
                }
            )

            apiStore.resetTokenUsage()
            const tokenUsageNow = apiStore.getTokenUsage()

            if (tokenUsageNow.totalTokens === 0) {
                ElMessage({
                    type: 'success',
                    message: '重置成功',
                })
                return true
            } else {
                ElMessage({
                    type: 'error',
                    message: '重置失败'
                })
                return false
            }
        } catch {
            ElMessage({
                type: 'info',
                message: '已取消操作'
            })
            return false
        }
    }

    /**
     * 获取完整的 token 使用统计
     */
    const getTokenUsage = () => {
        return apiStore.getTokenUsage()
    }

    return {
        totalTokens,
        requestCount,
        lastResetTime,
        addTokens,
        resetTokens,
        getTokenUsage
    }
}
