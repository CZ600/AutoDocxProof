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



                    <!-- API选择区域 -->
                    <el-card class="setting-card" shadow="hover">
                        <template #header>
                            <div class=" card-header">
                                <el-icon>
                                    <Connection />
                                </el-icon>
                                <span>API选择</span>

                            </div>
                        </template>
                        <p class="section-description">
                            <el-icon>
                                <InfoFilled />
                            </el-icon>
                            兼容支持openai规范的接口,对话模型和embedding模型都在这里添加
                        </p>
                        <el-form :model="selectform" label-width="auto">
                            <el-form-item label="当前API:" class="form-item-enhanced">
                                <el-select v-model="selectform.id" placeholder="请选择您的API" class="api-select">
                                    <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName"
                                        :value="item.id" id="api-item">
                                        <div class="api-option">
                                            <div class="api-option-info">
                                                <el-icon>
                                                    <Cpu />
                                                </el-icon>
                                                <span>{{ item.modelName }}</span>
                                            </div>
                                            <el-button type="danger" :icon="Delete" size="small" circle
                                                @click.stop="deleteItem(item.id)" />
                                        </div>
                                    </el-option>
                                </el-select>
                            </el-form-item>
                            <div class="button-group">
                                <el-button type="primary" :icon="Plus" @click="dialogVisible = true" class="btn-add">

                                    添加新API
                                </el-button>
                                <el-button :icon="Connection" @click="testAPI()" class="btn-test">
                                    测试连通性
                                </el-button>
                            </div>

                            <el-dialog v-model="dialogVisible" title="添加新API" width="500px" class="api-dialog">
                                <template #header>
                                    <div class="dialog-header">
                                        <el-icon>
                                            <Plus />
                                        </el-icon>
                                        <span>添加新API</span>
                                    </div>
                                </template>
                                <el-form :model="newForm" label-position="top" class="dialog-form">
                                    <el-form-item label="API URL:" class="form-item">
                                        <el-input v-model="newForm.URL" placeholder="请输入API地址" :prefix-icon="Link" />
                                    </el-form-item>
                                    <el-form-item label="API KEY:" class="form-item">
                                        <el-input v-model="newForm.key" show-password placeholder="请输入API密钥"
                                            :prefix-icon="Lock" />
                                    </el-form-item>
                                    <el-form-item label="模型名称:" class="form-item">
                                        <el-input v-model="newForm.name" placeholder="请输入模型名称" :prefix-icon="Cpu" />
                                    </el-form-item>
                                </el-form>
                                <template #footer>
                                    <span class="dialog-footer">
                                        <el-button @click="resetForm()">重置</el-button>
                                        <el-button @click="dialogVisible = false">取消</el-button>
                                        <el-button type="primary" @click="onSubmit">保存</el-button>
                                    </span>
                                </template>
                            </el-dialog>
                        </el-form>
                    </el-card>

                    <!-- Token统计区域 -->
                    <el-card class="setting-card token-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <el-icon>
                                    <DataLine />
                                </el-icon>
                                <span>使用统计</span>
                            </div>
                        </template>
                        <div class="token-stats">
                            <el-statistic :value="total_tokens" class="statistic">
                                <template #title>
                                    <div class="statistic-title">
                                        <span>累计Token使用量</span>
                                        <el-tooltip effect="dark" content="数据存放于缓存中，清空缓存则清零重置" placement="top">
                                            <el-icon class="tooltip-icon">
                                                <QuestionFilled />
                                            </el-icon>
                                        </el-tooltip>
                                    </div>
                                </template>
                            </el-statistic>
                            <el-button type="danger" :icon="Delete" @click="ResetZero" class="btn-reset">
                                清空统计
                            </el-button>
                        </div>
                    </el-card>

                    <!-- 并发设置区域 -->
                    <el-card class="setting-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <el-icon>
                                    <Odometer />
                                </el-icon>
                                <span>并发设置</span>

                            </div>
                        </template>
                        <div class="setting-section">
                            <p class="section-description">
                                <el-icon>
                                    <InfoFilled />
                                </el-icon>
                                设置最大并发限制，具体数值取决于接口提供者的限制，更高的并发可以提高处理速度
                            </p>
                            <el-slider v-model="ParallelSet" show-input :min="1" :max="100" class="custom-slider" />
                        </div>
                    </el-card>

                    <!-- 频率限制区域 -->
                    <el-card class="setting-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <el-icon>
                                    <Timer />
                                </el-icon>
                                <span>请求频率限制</span>
                            </div>
                        </template>
                        <div class="setting-section">
                            <p class="section-description">
                                <el-icon>
                                    <InfoFilled />
                                </el-icon>
                                限制每分钟的请求频率，默认不限制。如果使用的接口有相关的限制，请根据接口提供商的要求自行开启
                            </p>
                            <el-button :type="openTimeLimit ? 'success' : 'primary'" @click="setOpenTimeLimit"
                                class="toggle-btn">
                                {{ openTimeLimit ? "已开启限制" : "开启限制" }}
                            </el-button>
                            <el-slider v-if="openTimeLimit" v-model="TimeLimit" show-input :min="1"
                                class="custom-slider" />
                        </div>
                    </el-card>
                </div>
            </el-tab-pane>

            <el-tab-pane label="提示词设置" name="prompt">
                <div class="tab-content">
                    <!-- 头部标题区域 -->

                    <!-- 当前提示词展示 -->
                    <el-card class="setting-card prompt-display-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <el-icon>
                                    <DataLine />
                                </el-icon>
                                <span>当前提示词</span>
                                <el-tag v-if="isUsingCustomPrompt" type="success" size="small" class="custom-tag">
                                    <el-icon>
                                        <CircleCheck />
                                    </el-icon>
                                    自定义提示词
                                </el-tag>
                                <el-tag v-else type="info" size="small" class="custom-tag">
                                    <el-icon>
                                        <InfoFilled />
                                    </el-icon>
                                    默认提示词
                                </el-tag>
                            </div>
                        </template>
                        <div class="prompt-content-wrapper">
                            <div class="prompt-label">当前使用的提示词：</div>
                            <el-text class="prompt-content">
                                {{ defaultPrompt }}
                            </el-text>
                        </div>
                    </el-card>

                    <!-- 编辑提示词 -->
                    <el-card class="setting-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <el-icon>
                                    <DataLine />
                                </el-icon>
                                <span>编辑提示词</span>
                            </div>
                        </template>
                        <el-form :model="promptForm" label-position="top" class="prompt-form">
                            <el-form-item label="新提示词" class="form-item">
                                <el-input v-model="newPrompt" type="textarea" :rows="6" placeholder="请输入新的提示词"
                                    class="prompt-textarea" />
                            </el-form-item>
                            <div class="button-group">
                                <el-button @click="updatePrompt()" type="primary" :icon="DataLine" class="btn-save">
                                    修改提示词
                                </el-button>
                                <el-button @click="backTodefault()" type="default" :icon="Warning" class="btn-reset">
                                    恢复默认设置
                                </el-button>
                            </div>
                        </el-form>
                    </el-card>
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang='ts'>
import {
    Delete, Warning, Setting, Connection, Plus, Cpu, Lock, Link,
    DataLine, QuestionFilled, Odometer, InfoFilled, Timer, CircleCheck
} from '@element-plus/icons-vue'
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
const promptForm = reactive({
    prompt: ''
})
// 标记是否使用了自定义提示词
const isUsingCustomPrompt = ref(false)
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
const newForm = reactive({
    URL: '',
    key: '',
    name: ''
})

// 定义一个由form对象组成的响应式数组
const apiSettings = reactive([])

// Prompt相关方法
const updatePrompt = async () => {
    const result = await electronAPI.setNewPrompt(newPrompt.value)
    if (result) {
        // 保存到 Pinia store
        apiSettingsStore.setCustomPrompt(newPrompt.value)
        defaultPrompt.value = newPrompt.value
        isUsingCustomPrompt.value = true
        ElMessage.success('修改成功，已自动同步到后端')
        newPrompt.value = ''
    } else {
        ElMessage.error('修改失败')
    }
}

const backTodefault = async () => {
    // 重新从后端获取系统默认提示词，确保恢复到真正的系统默认
    theDefaultPrompt.value = await electronAPI.getDefaultPrompt()

    const result = await electronAPI.setNewPrompt(theDefaultPrompt.value)
    if (result) {
        // 清除 Pinia store 中的自定义提示词，使用 null 而不是空字符串
        apiSettingsStore.setCustomPrompt(null)
        newPrompt.value = ''
        isUsingCustomPrompt.value = false

        // 重新初始化提示词状态以确保UI正确更新
        await initPrompt()

        ElMessage.success('已恢复为默认设置')
    } else {
        ElMessage.error('恢复失败')
    }
}

const initPrompt = async () => {
    // 获取默认提示词
    theDefaultPrompt.value = await electronAPI.getDefaultPrompt()

    // 检查是否有保存的自定义提示词
    if (apiSettingsStore.selectedApi.customPrompt) {
        // 使用自定义提示词并同步到后端
        const customPrompt = apiSettingsStore.selectedApi.customPrompt
        const result = await electronAPI.setNewPrompt(customPrompt)
        if (result) {
            defaultPrompt.value = customPrompt
            isUsingCustomPrompt.value = true
            console.log('已从持久化存储中恢复自定义提示词:', customPrompt)
        } else {
            // 同步失败，使用默认提示词
            defaultPrompt.value = theDefaultPrompt.value
            isUsingCustomPrompt.value = false
            apiSettingsStore.setCustomPrompt(null)
        }
    } else {
        // 没有自定义提示词，使用默认提示词
        const result = await electronAPI.setNewPrompt(theDefaultPrompt.value)
        if (result) {
            defaultPrompt.value = theDefaultPrompt.value
            isUsingCustomPrompt.value = false
        }
    }
}

// API相关方法
const onSubmit = async () => {
    console.log('newform:', newForm)
    const res = await electronAPI.APISettings(newForm.URL, newForm.key, newForm.name)
    console.log('res', res)
    if (res === 'success') {
        await getALLAPISettings()
        ElMessage.success('API设置成功')
    } else {
        ElMessage.error('API设置失败')
    }
}

const resetForm = () => {
    newForm.URL = ''
    newForm.key = ''
    newForm.name = ''
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

        // 同步到 Pinia store（保留已有的 customPrompt）
        const existingCustomPrompt = apiSettingsStore.selectedApi.customPrompt
        apiSettingsStore.setSelectedApi({
            ...selectform.value,
            customPrompt: existingCustomPrompt
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

/* 头部标题区域 */
.header-section {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
    padding: 25px;
    background-color: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
}

.header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background-color: var(--el-color-primary-light-8);
    border-radius: 8px;
}

.header-text h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.header-text p {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
}

/* 卡片样式 */
.setting-card {
    margin-bottom: 24px;
    border-radius: 8px;
    transition: all 0.2s ease;
    border: 1px solid var(--el-border-color);
}

.setting-card:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 15px;
    color: var(--el-text-color-primary);
}

.card-header .custom-tag {
    margin-left: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
}

/* 表单增强 */
.form-item-enhanced {
    margin-bottom: 20px;
}

.api-select {
    width: 100%;
}

.api-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0px 0;
    margin: 2px;
}

.api-option-info {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
}

/* 按钮组 */
.button-group {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
}

.btn-add {
    flex: 1;
    min-width: 140px;
}

.btn-test {
    min-width: 120px;
}

/* 对话框样式 */
.api-dialog {
    border-radius: 12px;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 18px;
}

.dialog-form {
    padding: 20px 0;
}

.form-item {
    margin-bottom: 20px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* Token统计区域 */
.token-card {
    background-color: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color);
}

.token-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}

.statistic {
    flex: 1;
}

.statistic-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tooltip-icon {
    cursor: help;
    color: var(--el-text-color-secondary);
    transition: color 0.2s;
}

.tooltip-icon:hover {
    color: var(--el-color-primary);
}

.btn-reset {
    white-space: nowrap;
}

/* 设置区域 */
.setting-section {
    padding: 10px 0;
}

.section-description {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 15px;
    margin-top: 0px;
    padding: 8px;
    background-color: var(--el-fill-color-light);
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.6;
}

.section-description .el-icon {
    color: var(--el-color-primary);
    margin-top: 2px;
    flex-shrink: 0;
}

/* 滑块样式 */
.custom-slider {
    margin: 20px 0;
    padding: 10px;
}

.custom-slider .el-slider__runway {
    height: 6px;
    border-radius: 3px;
}

.custom-slider .el-slider__bar {
    height: 6px;
    border-radius: 3px;
    background-color: var(--el-color-primary);
}

.custom-slider .el-slider__button {
    width: 16px;
    height: 16px;
    background-color: var(--el-color-primary);
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 切换按钮 */
.toggle-btn {
    min-width: 140px;
    margin-bottom: 20px;
    font-weight: 500;
}

/* 提示词相关 */
.prompt-display-card .prompt-content-wrapper {
    padding: 10px 0;
}

.prompt-label {
    font-weight: 600;
    margin-bottom: 12px;
    font-size: 14px;
    color: var(--el-text-color-primary);
}

.prompt-content {
    display: block;
    padding: 15px;
    background-color: var(--el-fill-color-light);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 13px;
    line-height: 1.8;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color);
}

.prompt-form {
    padding: 10px 0;
}

.prompt-textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.btn-save {
    flex: 1;
    min-width: 140px;
}

.btn-reset {
    min-width: 140px;
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

    .header-section {
        padding: 15px;
        flex-direction: column;
        text-align: center;
    }

    .header-icon {
        width: 50px;
        height: 50px;
    }

    .header-text h2 {
        font-size: 20px;
    }

    .button-group {
        flex-direction: column;
    }

    .btn-add,
    .btn-test,
    .btn-save,
    .btn-reset {
        width: 100%;
    }

    .token-stats {
        flex-direction: column;
        align-items: flex-start;
    }
}

/* 滚动条样式 */
.prompt-content::-webkit-scrollbar {
    width: 6px;
}

.prompt-content::-webkit-scrollbar-track {
    background: var(--el-fill-color-light);
    border-radius: 3px;
}

.prompt-content::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 3px;
}

.prompt-content::-webkit-scrollbar-thumb:hover {
    background: var(--el-text-color-secondary);
}
</style>