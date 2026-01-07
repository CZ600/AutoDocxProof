// composables/useApiSettings.ts
import { ref, computed, watch } from 'vue'
import { useApiStore } from '../stores/apiStore'
import { ElMessage } from 'element-plus'

interface ApiSettingItem {
    id: number
    apiURL: string
    apiKey: string
    modelName: string
}

// 后端返回的 API 设置项结构
interface BackendApiItem {
    id: number
    URL: string
    Key: string
    modelName: string
    created_at: string
}

interface SelectedApi {
    id: number | null
    URL: string
    key: string
    name: string
    time: string
    parallel: number
    TimeLimit: number | null
}

/**
 * API 设置管理
 * 封装 API 选择、测试、添加、删除等操作
 */
export function useApiSettings() {
    const electronAPI = window.electronAPI
    const apiStore = useApiStore()  // 导入pinia存储对象

    // 当前选中的 API 设置 - 本地状态，用于表单绑定
    const selectedApi = ref<SelectedApi>({
        id: null,
        URL: '',
        key: '',
        name: '',
        time: '',
        parallel: 30,
        TimeLimit: null
    })

    // API 设置列表 - 直接返回 store 中的响应式数组，确保所有组件共享同一数据源
    const apiSettings = apiStore.apiSettings

    // 并发数设置 - 直接使用 store 中的值
    // 计算属性，获取store的值，并保持更新
    const parallelValue = computed({  
        get: () => apiStore.selectedApi.parallel || 30,
        set: (value: number) => {
            apiStore.setParallel(value)
        }
    })

    // 频率限制设置 - 直接使用 store 中的值
    const openTimeLimit = computed({
        get: () => apiStore.selectedApi.TimeLimit !== null,
        set: (value: boolean) => {
            // 不直接设置，通过 toggleTimeLimit 方法
        }
    })

    const timeLimit = computed({
        get: () => apiStore.selectedApi.TimeLimit,
        set: (value: number | null) => {
            if (value !== null) {
                apiStore.setTimeLimit(value)
            }
        }
    })

    // Alert 状态
    const showAlertSuccess = ref(false)
    const showAlertError = ref(false)
    const alertTitle = ref('')

    /**
     * 获取所有 API 设置
     */
    const fetchAllApiSettings = async () => {
        try {
            const res: BackendApiItem[] = await electronAPI.getALLAPISettings()
            // 将后端数据转换为 store 需要的格式
            const transformed: ApiSettingItem[] = res.map(item => ({
                id: item.id,
                apiURL: item.URL,
                apiKey: item.Key,
                modelName: item.modelName
            }))
            apiStore.setApiSettings(transformed)
        } catch (error) {
            console.error('获取 API 设置失败:', error)
        }
    }

    /**
     * 选择 API
     */
    const selectApi = async (id: number | null) => {
        if (id === null) {
            // 清空选择
            selectedApi.value.URL = ''
            selectedApi.value.key = ''
            selectedApi.value.name = ''
            selectedApi.value.id = null
            apiStore.clearSelectedApi()
            return
        }

        // 查找对应的 API 设置
        const selectedItem = apiStore.apiSettings.find((item: ApiSettingItem) => item.id === id)
        if (selectedItem) {
            selectedApi.value.URL = selectedItem.apiURL || ''
            selectedApi.value.key = selectedItem.apiKey || ''
            selectedApi.value.name = selectedItem.modelName || ''
            selectedApi.value.id = id

            // 保持当前的并发和频率限制设置，不重置
            // selectedApi.value.parallel 和 selectedApi.value.TimeLimit 保持不变

            // 同步到 store
            apiStore.setSelectedApi({ ...selectedApi.value })

            // 同步到后端
            await syncApiSettingsToBackend()
        }
    }

    /**
     * 添加新的 API 设置
     */
    const addApi = async (data: { URL: string; key: string; name: string }) => {
        try {
            const res = await electronAPI.APISettings(data.URL, data.key, data.name)
            if (res === 'success') {
                await fetchAllApiSettings()
                ElMessage.success('API设置成功')
                return true
            } else {
                ElMessage.error('API设置失败')
                return false
            }
        } catch (error) {
            console.error('添加 API 失败:', error)
            ElMessage.error('API设置失败')
            return false
        }
    }

    /**
     * 删除 API 设置
     */
    const deleteApi = async (id: number) => {
        try {
            const res = await electronAPI.deleteOneAPI(id)
            if (res) {
                showAlertSuccess.value = true
                alertTitle.value = '删除成功'
                await fetchAllApiSettings()
                return true
            } else {
                showAlertError.value = true
                alertTitle.value = '删除失败'
                return false
            }
        } catch (error) {
            console.error('删除 API 失败:', error)
            ElMessage.error('删除失败')
            return false
        }
    }

    /**
     * 查找 API 设置
     */
    const findApiSetting = (id: number) => {
        return apiStore.apiSettings.find(item => item.id === id)
    }

    /**
     * 测试 API 连接
     */
    const testApi = async () => {
        const url = selectedApi.value.URL
        const key = selectedApi.value.key
        const modelName = selectedApi.value.name

        if (!url || !key || !modelName) {
            ElMessage.warning('请先选择或添加一个 API 设置')
            return false
        }

        try {
            const res = await electronAPI.testAPI(url, key, modelName)
            if (res) {
                ElMessage.success('测试成功')
                return true
            } else {
                ElMessage.error('测试失败')
                return false
            }
        } catch (error) {
            console.error('测试 API 失败:', error)
            ElMessage.error('测试失败')
            return false
        }
    }

    /**
     * 更新并发数设置
     */
    const updateParallel = async (value: number) => {
        parallelValue.value = value
        selectedApi.value.parallel = value
        await syncApiSettingsToBackend()
    }

    /**
     * 切换频率限制
     */
    const toggleTimeLimit = async () => {
        const currentValue = apiStore.selectedApi.TimeLimit

        if (currentValue === null) {
            // 开启限制：设置默认值
            const defaultValue = 10
            timeLimit.value = defaultValue
            selectedApi.value.TimeLimit = defaultValue
        } else {
            // 关闭限制：设置为null
            timeLimit.value = null
            selectedApi.value.TimeLimit = null
        }

        await syncApiSettingsToBackend()
    }

    /**
     * 更新频率限制值
     */
    const updateTimeLimit = async (value: number | null) => {
        timeLimit.value = value
        selectedApi.value.TimeLimit = value
        await syncApiSettingsToBackend()
    }

    /**
     * 同步 API 设置到后端
     */
    const syncApiSettingsToBackend = async () => {
        if (selectedApi.value.id !== null) {
            try {
                await electronAPI.selectAPISetting(
                    selectedApi.value.URL,
                    selectedApi.value.key,
                    selectedApi.value.name,
                    selectedApi.value.parallel,
                    selectedApi.value.TimeLimit
                )
                console.log('API设置已同步到后端')
            } catch (error) {
                console.error('同步 API 设置失败:', error)
            }
        }
    }

    /**
     * 初始化 - 从 store 恢复数据
     */
    const initialize = async () => {
        await fetchAllApiSettings()

        // 尝试从 store 恢复数据
        if (apiStore.selectedApi.id !== null) {
            selectedApi.value = { ...apiStore.selectedApi }
        }
    }

    // 监听选中 API ID 变化
    watch(() => selectedApi.value.id, (newId) => {
        if (newId !== null) {
            selectApi(newId)
        }
    })

    return {
        // 状态
        selectedApi,
        apiSettings,
        parallelValue,
        openTimeLimit,
        timeLimit,
        showAlertSuccess,
        showAlertError,
        alertTitle,

        // 方法
        fetchAllApiSettings,
        selectApi,
        addApi,
        deleteApi,
        testApi,
        updateParallel,
        toggleTimeLimit,
        updateTimeLimit,
        initialize
    }
}
