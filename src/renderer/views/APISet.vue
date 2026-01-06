<template>
    <div class="api-settings-container">
        <el-tabs v-model="activeTab" type="border-card" class="custom-tabs">
            <el-tab-pane label="API设置" name="api">
                <div class="tab-content">
                    <el-alert v-if="showAlertSuccess" type="success" auto-close="4000" show-icon class="fade-slide">
                        {{ AlertTitle }}
                    </el-alert>
                    <el-alert v-if="showAlertError" type="error" auto-close="4000" show-icon class="fade-slide">
                        {{ AlertTitle }}
                    </el-alert>

                    <!-- API选择组件 -->
                    <ApiSelector
                        :selectform="selectform"
                        :apiSettings="apiSettings"
                        @add-api="dialogVisible = true"
                        @delete-api="deleteItem"
                        @test-api="testAPI"
                    />

                    <!-- 添加API对话框组件 -->
                    <AddApiDialog
                        v-model:visible="dialogVisible"
                        @submit="onSubmit"
                        @reset="resetForm"
                    />

                    <!-- Token统计组件 -->
                    <TokenStatistics
                        :total-tokens="total_tokens"
                        @reset-tokens="ResetZero"
                    />

                    <!-- 并发设置组件 -->
                    <ConcurrencySettings
                        v-model:parallel-value="ParallelSet"
                    />

                    <!-- 频率限制设置组件 -->
                    <RateLimitSettings
                        :open-time-limit="openTimeLimit"
                        :time-limit="TimeLimit"
                        @toggle-limit="setOpenTimeLimit"
                        @update:time-limit="TimeLimit = $event"
                    />

                    <!-- 代理设置组件 -->
                    <ProxySettings
                        v-model:proxy-enabled="proxyEnabled"
                        v-model:proxy-port="proxyPort"
                    />
                </div>
            </el-tab-pane>

            <el-tab-pane label="提示词设置" name="prompt">
                <div class="tab-content">
                    <!-- 当前提示词展示组件 -->
                    <PromptDisplay
                        :prompt-content="defaultPrompt"
                    />

                    <!-- 编辑提示词组件 -->
                    <PromptEditor
                        v-model:new-prompt="newPrompt"
                        @update-prompt="updatePrompt"
                        @reset-prompt="backTodefault"
                    />
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang='ts'>
import ApiSelector from '../components/api/ApiSelector.vue'
import AddApiDialog from '../components/api/AddApiDialog.vue'
import TokenStatistics from '../components/api/TokenStatistics.vue'
import ConcurrencySettings from '../components/api/ConcurrencySettings.vue'
import RateLimitSettings from '../components/api/RateLimitSettings.vue'
import ProxySettings from '../components/api/ProxySettings.vue'
import PromptDisplay from '../components/prompt/PromptDisplay.vue'
import PromptEditor from '../components/prompt/PromptEditor.vue'
import { useProxyStore } from '../stores/proxyStore'
import { reactive, ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useApiStore } from '../stores/apiStore'
const activeTab = ref('api')
const dialogVisible = ref(false)
const electronAPI = window.electronAPI
const showAlertSuccess = ref(false)
const showAlertError = ref(false)
const AlertTitle = ref('Success alert')
const openTimeLimit = ref(false)
// Prompt相关变量
const theDefaultPrompt = ref('')
const defaultPrompt = ref('')
const newPrompt = ref('')
const total_tokens = ref(0)
const ParallelSet = ref(30) // 设置默认值为30而不是undefined
const TimeLimit = ref(null as number | null)

// API相关变量
// do not use same name with ref
const selectform = ref(
    {
        id: null as number | null,
        URL: '',
        key: '',
        name: '',
        time: '',
        parallel: 30,
        TimeLimit: null as number | null
    }
)

const apiSettingsStore = useApiStore()

// Proxy settings
const proxyStore = useProxyStore()
const proxyEnabled = ref(false)
const proxyPort = ref(33210)

// 重置缓存中token使用量的数据
const ResetZero = () => {
    ElMessageBox.confirm(
        '是否要清空token记录?',
        'Warning',
        {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            type: 'warning',
        }
    )
        .then(() => {
            apiSettingsStore.setTotalTokens(0)
            if (apiSettingsStore.selectedApi.total_tokens === 0) {
                total_tokens.value = 0
                ElMessage({
                    type: 'success',
                    message: '重置成功',
                })
            } else {
                ElMessage({
                    type: 'error',
                    message: "重置失败"
                })
                throw (Error)
            }
        })
        .catch(() => {
            ElMessage({
                type: 'info',
                message: 'Delete canceled',
            })
        })
}
// 监听变化，更新selectform的值
watch(
    () => selectform.value.id,
    (newId) => {
        console.log('选中的 API ID:', newId)
        if (newId === null) {
            // 清空表单
            selectform.value.URL = ''
            selectform.value.key = ''
            selectform.value.name = ''

            // 同步到 Pinia store
            apiSettingsStore.clearSelectedApi()
            return
        }

        // 根据 id 查找对应的 API 设置
        const selectedItem = apiSettings.find(item => item.id === newId)
        if (selectedItem) {
            selectform.value.URL = selectedItem.apiURL || ''
            selectform.value.key = selectedItem.apiKey || ''
            selectform.value.name = selectedItem.modelName || '' // 注意：你存储的是 modelName，不是 name
            selectform.value.id = newId
            // 初始化并行数和频率限制为默认值
            selectform.value.parallel = 30
            selectform.value.TimeLimit = null
            ParallelSet.value = 30
            TimeLimit.value = null
            openTimeLimit.value = false // 关闭频率限制
        }

        // 同步到 Pinia store
        apiSettingsStore.setSelectedApi({ ...selectform.value })

        const res = electronAPI.selectAPISetting(
            selectform.value.URL,
            selectform.value.key,
            selectform.value.name,
            selectform.value.parallel,
            selectform.value.TimeLimit
        )
        if (res) {
            console.log('已经更新api设置的选择:', res, selectform.value.name, selectform.value.URL, selectform.value.key);
        } else {
            console.log('更新api设置的选择失败');
        }
    }
)

watch(
    TimeLimit,
    async (newVal, oldVal) => {
        selectform.value.TimeLimit = newVal
        apiSettingsStore.setTimeLimit(newVal)
        console.log("the new model limit of time is:", newVal)

        // 同步到后端
        if (selectform.value.id !== null) {
            try {
                await electronAPI.selectAPISetting(
                    selectform.value.URL,
                    selectform.value.key,
                    selectform.value.name,
                    selectform.value.parallel,
                    selectform.value.TimeLimit
                )
                console.log("TimeLimit已同步到后端:", newVal)
            } catch (error) {
                console.error("同步TimeLimit失败:", error)
            }
        }
    }
)

// 更新并发参数设置
watch(ParallelSet, async (newVal, oldVal) => {
    selectform.value.parallel = newVal
    apiSettingsStore.setParallel(newVal)

    // 同时更新到选中的API设置中
    if (selectform.value.id !== null) {
        const res = await electronAPI.selectAPISetting(
            selectform.value.URL,
            selectform.value.key,
            selectform.value.name,
            selectform.value.parallel,
            selectform.value.TimeLimit
        )
        console.log("API设置已更新:", res)
    }
    const newParallel = apiSettingsStore.selectedApi.parallel
    console.log("newParallel in store", newParallel)
})

const setOpenTimeLimit = async () => {
    // 切换状态
    openTimeLimit.value = !openTimeLimit.value

    if (openTimeLimit.value) {
        // 开启限制：设置默认值
        const defaultValue = 10
        TimeLimit.value = defaultValue
        selectform.value.TimeLimit = defaultValue
        apiSettingsStore.selectedApi.TimeLimit = defaultValue
        console.log("开启频率限制，默认值:", defaultValue)
    } else {
        // 关闭限制：设置为null
        TimeLimit.value = null
        selectform.value.TimeLimit = null
        apiSettingsStore.selectedApi.TimeLimit = null
        console.log("关闭频率限制")
    }

    // 同步到后端
    if (selectform.value.id !== null) {
        try {
            await electronAPI.selectAPISetting(
                selectform.value.URL,
                selectform.value.key,
                selectform.value.name,
                selectform.value.parallel,
                selectform.value.TimeLimit
            )
            console.log("频率限制设置已同步到后端")
        } catch (error) {
            console.error("同步频率限制设置失败:", error)
        }
    }
}

// 定义一个由form对象组成的响应式数组
const apiSettings = reactive([])

// Prompt相关方法
const updatePrompt = async () => {
    const result = await electronAPI.setNewPrompt(newPrompt.value)
    if (result) {
        defaultPrompt.value = newPrompt.value
    }
    ElMessage.success('修改成功')
    newPrompt.value = ''
}

const backTodefault = async () => {
    const result = await electronAPI.setNewPrompt(theDefaultPrompt.value)
    if (result) {
        defaultPrompt.value = theDefaultPrompt.value
        newPrompt.value = ''
        ElMessage.success('恢复为默认设置')
    }
}

const initPrompt = async () => {
    theDefaultPrompt.value = await electronAPI.getDefaultPrompt()
    defaultPrompt.value = await electronAPI.getDefaultPrompt()
}

// API相关方法
const onSubmit = async (data: { URL: string; key: string; name: string }) => {
    console.log('newform:', data)
    const res = await electronAPI.APISettings(data.URL, data.key, data.name)
    console.log('res', res)
    if (res === 'success') {
        await getALLAPISettings()
        ElMessage.success('API设置成功')
        dialogVisible.value = false
    } else {
        ElMessage.error('API设置失败')
    }
}

const resetForm = () => {
    // 重置逻辑已移到 AddApiDialog 组件中
}

const deleteItem = async (id: number) => {
    console.log('will delete the key:', id)
    const res = await electronAPI.deleteOneAPI(id)
    if (res) {
        showAlertSuccess.value = true
        await getALLAPISettings()
        AlertTitle.value = '删除成功'
    } else {
        showAlertError.value = true
        AlertTitle.value = '删除失败'
    }
}

const getALLAPISettings = async () => {
    const res = await electronAPI.getALLAPISettings()
    console.log('res', res)
    apiSettings.splice(0, apiSettings.length)  // 清空数组
    res.forEach((item: any) => {
        apiSettings.push(item)
    })
}

const testAPI = async () => {
    const url = selectform.value.URL
    const key = selectform.value.key
    const modelName = selectform.value.name
    console.log("will test API:", url, key, modelName)

    try {
        const res = await electronAPI.testAPI(url, key, modelName)
        if (res) {
            ElMessage.success('测试成功')
        } else {
            ElMessage.error('测试失败')
        }
    } catch (err) {
        ElMessage.error('测试失败')
    }
}

// Proxy相关方法
// Watch proxy settings changes
watch(proxyEnabled, async (newValue) => {
  const success = await proxyStore.setProxySettings(newValue, proxyPort.value)
  if (success) {
    ElMessage.success(newValue ? '代理已启用' : '代理已禁用')
  } else {
    ElMessage.error('代理设置失败')
    proxyEnabled.value = !newValue // 回滚
  }
})

watch(proxyPort, async (newValue) => {
  if (proxyEnabled.value) {
    const success = await proxyStore.setProxySettings(proxyEnabled.value, newValue)
    if (success) {
      ElMessage.success(`代理端口已更新: ${newValue}`)
    } else {
      ElMessage.error('代理端口设置失败')
    }
  }
})

async function initForm() {
    await getALLAPISettings()
}

// 修改 initSelect 函数
const initSelect = async () => {
    // 先尝试从 Pinia store 获取数据
    if (apiSettingsStore.selectedApi.id !== null) {
        selectform.value = { ...apiSettingsStore.selectedApi }
        ParallelSet.value = apiSettingsStore.selectedApi.parallel
        selectform.value.parallel = apiSettingsStore.selectedApi.parallel
        total_tokens.value = apiSettingsStore.selectedApi.total_tokens
        console.log('从 Pinia store 恢复数据:', selectform.value)

        // 正确设置 TimeLimit 和 openTimeLimit
        if (apiSettingsStore.selectedApi.TimeLimit) {
            openTimeLimit.value = true
            TimeLimit.value = apiSettingsStore.selectedApi.TimeLimit
        } else {
            openTimeLimit.value = false
            TimeLimit.value = null
        }
        return
    }

    // 如果 store 中没有数据，从 electronAPI 获取
    const res = await electronAPI.getAPISettings()
    if (res) {
        selectform.value.URL = res.URL
        selectform.value.key = res.Key
        selectform.value.name = res.modelName
        selectform.value.parallel = 30
        ParallelSet.value = 30
        selectform.value.TimeLimit = null
        TimeLimit.value = null

        // 同步到 Pinia store
        apiSettingsStore.setSelectedApi({
            ...selectform.value
        })
        console.log('从 electronAPI 初始化数据:', res)
    } else {
        // 如果都没有数据，设置默认值
        ParallelSet.value = 30
        selectform.value.parallel = 30
    }
}

// 挂载时执行
onMounted(async () => {
    await initForm()
    await initSelect()
    await initPrompt()

    // 初始化代理设置
    if (proxyStore.proxySettings.enabled) {
      proxyStore.setProxySettings(
        proxyStore.proxySettings.enabled,
        proxyStore.proxySettings.port
      ).then(success => {
        if (success) {
          console.log('Proxy settings restored on startup')
        }
      })
    }
})
</script>

<style scoped>
/* 主容器 */
.api-settings-container {
    padding: 20px;
    min-height: 100vh;
}

.custom-tabs {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
}

.tab-content {
    padding: 30px;
    background-color: var(--el-bg-color);
}

/* 动画效果 */
.fade-slide {
    animation: fadeSlide 0.5s ease;
}

@keyframes fadeSlide {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 响应式设计 */
@media (max-width: 768px) {
    .api-settings-container {
        padding: 10px;
    }

    .tab-content {
        padding: 15px;
    }
}
</style>