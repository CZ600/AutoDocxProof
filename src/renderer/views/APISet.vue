<template>
    <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="API设置" name="api">
            <el-alert v-if="showAlertSuccess" type="success" auto-close="4000" show-icon>
                {{ AlertTitle }}
            </el-alert>
            <el-alert v-if="showAlertError" type="error" auto-close="4000" show-icon>
                {{ AlertTitle }}
            </el-alert>
            <div class="section-title">
                <el-text class="mx-1" type="primary" size="large">选择或添加API配置信息</el-text>
            </div>
            <div class="section-description">
                <el-text class="mx-1" type="default" size="small">本软件适配所有兼容OpenAI规范的大模型API，推荐使用非推理模型</el-text>
            </div>
            <el-form :model="selectform" label-width="auto" style="max-width: 600px">
                <el-form-item label="选择您的API">
                    <el-select v-model="selectform.id" placeholder="请选择您的API">
                        <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName" :value="item.id"
                            id="api-item">
                            <div
                                style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <!-- justify-content: space-between 实现两端对齐-->
                                <span>{{ item.modelName }}</span>
                                <el-button type="danger" :icon="Delete" size="small" circle
                                    @click.stop="deleteItem(item.id)" />
                            </div>
                        </el-option>
                    </el-select>
                </el-form-item>
                <div class="button-group">
                    <el-button type="primary" @click="dialogVisible = true">
                        添加新的API信息
                    </el-button>
                    <el-button @click="testAPI()">测试连通性</el-button>
                </div>

                <el-dialog v-model="dialogVisible" title="添加新API" width="400px">
                    <el-form-item label="API URL:">
                        <el-input v-model="newForm.URL" />
                    </el-form-item>
                    <el-form-item label="API KEY:">
                        <el-input v-model="newForm.key" show-password />
                    </el-form-item>
                    <el-form-item label="模型名称:">
                        <el-input v-model="newForm.name" />
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" @click="onSubmit">保存</el-button>
                        <el-button @click="resetForm()">重置</el-button>
                        <el-button @click="dialogVisible = false">取消</el-button>
                    </el-form-item>
                </el-dialog>
            </el-form>
        </el-tab-pane>

        <el-tab-pane label="提示词设置" name="prompt">
            <div class="section-title">
                <el-text class="mx-1" type="primary" size="large">设置提示词</el-text>
            </div>
            <div class="section-description">
                <el-text class="mx-1" type="default" size="small">在此设置用于文档校对的提示词</el-text>
            </div>

            <el-card class="prompt-card">
                <div class="card-header">
                    <span>当前提示词</span>
                </div>
                <el-text class="prompt-content">
                    {{ defaultPrompt }}
                </el-text>
            </el-card>

            <el-form :model="promptForm" label-width="auto" style="max-width: 600px">
                <el-form-item label="新提示词">
                    <el-input v-model="newPrompt" type="textarea" :rows="4" placeholder="请输入新的提示词" />
                </el-form-item>

                <div class="button-group">
                    <el-button @click="updatePrompt()" type="primary">修改提示词</el-button>
                    <el-button @click="backTodefault()" type="default">恢复默认设置</el-button>
                </div>
            </el-form>
        </el-tab-pane>
    </el-tabs>
</template>

<script setup lang='ts'>
import {
    Check,
    Delete,
    Edit,
    Message,
    Search,
    Star,
} from '@element-plus/icons-vue'
import { on } from 'events'
import { get } from 'http'
import { reactive, ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiStore } from '../stores/apiStore'
const activeTab = ref('api')
const dialogVisible = ref(false)
const electronAPI = window.electronAPI
const showAlertSuccess = ref(false)
const showAlertError = ref(false)
const AlertTitle = ref('Success alert')

// Prompt相关变量
const theDefaultPrompt = ref('')
const defaultPrompt = ref('')
const newPrompt = ref('')
const promptForm = reactive({
    prompt: ''
})

// API相关变量
// do not use same name with ref
const selectform = ref(
    {
        id: null as number | null,
        URL: '',
        key: '',
        name: '',
        time: ''
    }
)

const apiSettingsStore = apiStore()

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
const onSubmit = async () => {
    console.log('newform:', newForm)
    const res = await electronAPI.APISettings(newForm.URL, newForm.key, newForm.name)  // add a new api setting
    console.log('res', res)
    if (res === 'success') {
        getALLAPISettings()
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
        getALLAPISettings()
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

function initForm() {
    getALLAPISettings()
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
            selectform.value.time = selectedItem.time || ''
        }

        // 同步到 Pinia store
        apiSettingsStore.setSelectedApi({ ...selectform.value })

        const res = electronAPI.selectAPISetting(selectform.value.URL, selectform.value.key, selectform.value.name)
        if (res) {
            console.log('已经更新api设置的选择:', res, selectform.value.name, selectform.value.URL, selectform.value.key);
        } else {
            console.log('更新api设置的选择失败');
        }
    }
)

const initSelect = async () => {
    // 先尝试从 Pinia store 获取数据
    if (apiSettingsStore.selectedApi.id !== null) {
        selectform.value = { ...apiSettingsStore.selectedApi }
        return
    }

    const res = await electronAPI.getAPISettings()
    if (res) {
        selectform.value.URL = res.URL
        selectform.value.key = res.Key
        selectform.value.name = res.modelName
        console.log('已经初始化了api设置的选择');
        console.log(res);
    }
    else {
        console.log('初始化api设置的选择失败');
    }
}

// 挂载时执行
onMounted(() => {
    initForm()
    initSelect()
    initPrompt()
})
</script>

<style scoped>
el-tabs {
    border-radius: 4px
}

.section-title {
    margin: 15px 0 10px 0;
}

.section-description {
    margin-bottom: 20px;
}

.button-group {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.prompt-card {
    margin-bottom: 20px;
    max-width: 600px;
}

.card-header {
    font-weight: bold;
    margin-bottom: 10px;
}

.prompt-content {
    white-space: pre-wrap;
    word-break: break-all;
}

.el-tab-pane {
    padding: 20px 0;
}
</style>