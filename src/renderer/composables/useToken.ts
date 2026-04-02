import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApiStore } from '../stores/apiStore'
import { ElMessageBox, ElMessage } from 'element-plus'

export function useToken() {
  const { t } = useI18n()
  const apiStore = useApiStore()

  const totalTokens = computed(() => apiStore.tokenUsage.totalTokens)

  const requestCount = computed(() => apiStore.tokenUsage.requestCount)

  const lastResetTime = computed(() => apiStore.tokenUsage.lastResetTime)

  const addTokens = (tokens: number) => {
    apiStore.addTotalTokens(tokens)
  }

  const resetTokens = async () => {
    try {
      await ElMessageBox.confirm(t('useToken.confirmClear'), t('common.warning'), {
        confirmButtonText: t('useToken.confirm'),
        cancelButtonText: t('useToken.cancel'),
        type: 'warning'
      })

      apiStore.resetTokenUsage()
      const tokenUsageNow = apiStore.getTokenUsage()

      if (tokenUsageNow.totalTokens === 0) {
        ElMessage({
          type: 'success',
          message: t('useToken.resetSuccess')
        })
        return true
      } else {
        ElMessage({
          type: 'error',
          message: t('useToken.resetFailed')
        })
        return false
      }
    } catch {
      ElMessage({
        type: 'info',
        message: t('useToken.cancelled')
      })
      return false
    }
  }

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
