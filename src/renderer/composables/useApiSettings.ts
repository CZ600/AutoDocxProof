import axios from 'axios'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useApiStore } from '../stores/apiStore'

interface ApiSettingItem {
  id: number
  apiURL: string
  apiKey: string
  modelName: string
}

interface BackendApiItem {
  id: number
  apiURL: string
  apiKey: string
  modelName: string
  created_at: string
}

export interface ApiFormData {
  id?: number
  URL: string
  key: string
  name: string
}

interface ApiConnectionPayload {
  url: string
  key: string
  modelName: string
}

const buildChatCompletionUrl = (url: string) => {
  const normalized = url.trim().replace(/\/+$/, '')
  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }
  return `${normalized}/chat/completions`
}

const normalizeApiPayload = (data: ApiFormData) => ({
  id: data.id,
  URL: data.URL.trim(),
  key: data.key.trim(),
  name: data.name.trim()
})

const maskApiKey = (key: string) => {
  const trimmed = key.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`
  }
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`
}

export function useApiSettings() {
  const electronAPI = window.electronAPI
  const apiStore = useApiStore()

  const selectedApi = computed({
    get: () => apiStore.selectedApi,
    set: value => {
      apiStore.setSelectedApi(value)
    }
  })

  const apiSettings = apiStore.apiSettings

  const parallelValue = computed({
    get: () => apiStore.selectedApi.parallel || 30,
    set: (value: number) => {
      apiStore.setParallel(value)
    }
  })

  const openTimeLimit = computed({
    get: () => apiStore.selectedApi.TimeLimit != null,
    set: () => undefined
  })

  const timeLimit = computed({
    get: () => apiStore.selectedApi.TimeLimit,
    set: (value: number | null) => {
      apiStore.setTimeLimit(value)
    }
  })

  const showAlertSuccess = ref(false)
  const showAlertError = ref(false)
  const alertTitle = ref('')

  const fetchAllApiSettings = async () => {
    try {
      const res: BackendApiItem[] = await electronAPI.getALLAPISettings()
      const transformed: ApiSettingItem[] = res.map(item => ({
        id: item.id,
        apiURL: item.apiURL,
        apiKey: item.apiKey,
        modelName: item.modelName
      }))
      apiStore.setApiSettings(transformed)
    } catch (error) {
      console.error('获取 API 设置失败:', error)
    }
  }

  const selectApi = async (id: number | null) => {
    if (id === null) {
      apiStore.clearSelectedApi()
      return
    }

    const selectedItem = apiStore.apiSettings.find((item: ApiSettingItem) => item.id === id)
    if (!selectedItem) {
      console.warn(`找不到 ID 为 ${id} 的 API 设置，已清空选择`)
      apiStore.clearSelectedApi()
      return
    }

    const currentSettings = apiStore.selectedApi
    apiStore.setSelectedApi({
      id,
      URL: selectedItem.apiURL || '',
      key: selectedItem.apiKey || '',
      name: selectedItem.modelName || '',
      time: currentSettings.time,
      parallel: currentSettings.parallel || 30,
      TimeLimit: currentSettings.TimeLimit
    })

    await syncApiSettingsToBackend()
  }

  const saveApi = async (data: ApiFormData) => {
    const payload = normalizeApiPayload(data)
    const isEdit = typeof payload.id === 'number'

    try {
      const result = isEdit
        ? await electronAPI.updateAPISetting(payload.id as number, payload.URL, payload.key, payload.name)
        : await electronAPI.APISettings(payload.URL, payload.key, payload.name)

      const success = isEdit ? result === true : result === 'success'

      if (!success) {
        ElMessage.error(isEdit ? 'API 配置更新失败' : 'API 配置保存失败')
        return false
      }

      await fetchAllApiSettings()

      if (isEdit && apiStore.selectedApi.id === payload.id) {
        apiStore.setSelectedApi({
          URL: payload.URL,
          key: payload.key,
          name: payload.name
        })
        await syncApiSettingsToBackend()
      }

      ElMessage.success(isEdit ? 'API 配置已更新' : 'API 配置已保存')
      return true
    } catch (error) {
      console.error(isEdit ? '更新 API 失败:' : '保存 API 失败:', error)
      ElMessage.error(isEdit ? 'API 配置更新失败' : 'API 配置保存失败')
      return false
    }
  }

  const addApi = async (data: ApiFormData) => saveApi(data)

  const updateApi = async (data: ApiFormData) => {
    if (typeof data.id !== 'number') {
      ElMessage.error('缺少 API 记录 ID，无法更新')
      return false
    }
    return saveApi(data)
  }

  const deleteApi = async (id: number) => {
    try {
      const res = await electronAPI.deleteOneAPI(id)
      if (!res.isSuccess) {
        showAlertError.value = true
        alertTitle.value = '删除失败'
        ElMessage.error('删除失败')
        return false
      }

      showAlertSuccess.value = true
      alertTitle.value = '删除成功'
      await fetchAllApiSettings()

      if (apiStore.selectedApi.id === id) {
        const currentParallel = apiStore.selectedApi.parallel
        apiStore.clearSelectedApi()
        await electronAPI.selectAPISetting('', '', '', currentParallel, null)
      }

      return true
    } catch (error) {
      console.error('删除 API 失败:', error)
      ElMessage.error('删除失败')
      return false
    }
  }

  const findApiSetting = (id: number) => {
    return apiStore.apiSettings.find(item => item.id === id)
  }

  const testApiConnection = async ({ url, key, modelName }: ApiConnectionPayload) => {
    const trimmedUrl = url.trim()
    const trimmedKey = key.trim()
    const trimmedModelName = modelName.trim()

    if (!trimmedUrl || !trimmedKey || !trimmedModelName) {
      ElMessage.warning('请先填写完整的 API 地址、密钥和模型名称')
      return false
    }

    try {
      const response = await axios.post(
        buildChatCompletionUrl(trimmedUrl),
        {
          model: trimmedModelName,
          messages: [{ role: 'user', content: '你好' }]
        },
        {
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )

      const message = response.data?.choices?.[0]?.message
      if (response.status >= 200 && response.status < 300 && message) {
        ElMessage.success('测试成功')
        return true
      }

      ElMessage.error('测试失败：接口返回格式无效')
      return false
    } catch (error) {
      const axiosError = error as {
        response?: { data?: any }
        message?: string
      }
      const detail =
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        '未知错误'
      console.error('测试 API 失败:', error)
      ElMessage.error(`测试失败：${detail}`)
      return false
    }
  }

  const testApi = async () => {
    const currentSettings = apiStore.selectedApi
    return testApiConnection({
      url: currentSettings.URL,
      key: currentSettings.key,
      modelName: currentSettings.name
    })
  }

  const updateParallel = async (value: number) => {
    parallelValue.value = value
    await syncApiSettingsToBackend()
  }

  const toggleTimeLimit = async () => {
    const currentValue = apiStore.selectedApi.TimeLimit

    if (currentValue == null) {
      timeLimit.value = 10
    } else {
      timeLimit.value = null
    }

    await syncApiSettingsToBackend()
  }

  const updateTimeLimit = async (value: number | null) => {
    timeLimit.value = value
    await syncApiSettingsToBackend()
  }

  const syncApiSettingsToBackend = async () => {
    const currentSettings = apiStore.selectedApi
    if (currentSettings.id === null) {
      return
    }

    try {
      await electronAPI.selectAPISetting(
        currentSettings.URL,
        currentSettings.key,
        currentSettings.name,
        currentSettings.parallel,
        currentSettings.TimeLimit
      )
    } catch (error) {
      console.error('同步 API 设置失败:', error)
    }
  }

  const initialize = async () => {
    await fetchAllApiSettings()

    if (apiStore.selectedApi.id && (!apiStore.selectedApi.URL || !apiStore.selectedApi.key)) {
      await selectApi(apiStore.selectedApi.id)
    }
  }

  watch(
    () => apiStore.selectedApi.id,
    newId => {
      if (newId === null) {
        return
      }

      if (apiStore.apiSettings.length > 0) {
        selectApi(newId)
      } else {
        console.warn('apiSettings 列表为空，忽略本次 API 选择')
      }
    }
  )

  return {
    selectedApi,
    apiSettings,
    parallelValue,
    openTimeLimit,
    timeLimit,
    showAlertSuccess,
    showAlertError,
    alertTitle,
    maskApiKey,
    fetchAllApiSettings,
    selectApi,
    addApi,
    updateApi,
    deleteApi,
    testApi,
    testApiConnection,
    updateParallel,
    toggleTimeLimit,
    updateTimeLimit,
    findApiSetting,
    initialize
  }
}
