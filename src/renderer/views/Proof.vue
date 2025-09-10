<template>
    <el-container direction="vertical" class="app-container" style="height: 100vh;">
        <!-- 操作区域 -->
        <el-header class="action-bar" height="auto">
            <el-row justify="center" type="flex" align="middle">
                <el-col :span="4">
                    <el-button type="primary" :loading="isLoading" @click="selectFileWithMainProcessRead" size="large"
                        style="width: 100%; margin-bottom: 10px;">
                        {{ isLoading ? '正在加载...' : '选择 DOCX 文件' }}
                    </el-button>

                    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon
                        style="margin-bottom: 15px;" />

                    <p v-if="fileName" class="file-info" style="margin: 10px 0; color: #606266; font-size: 14px;">
                        当前文件: {{ fileName }}
                    </p>
                </el-col>
                <el-col :span="6" style="margin-left: 10px;">
                    <el-form-item label="">
                        <el-select v-model="form.model" placeholder="选择纠错模式" size="medium">
                            <el-option label="错别字" value="wordError" />
                            <el-option label="综合" value="ComprehensiveError" />
                            <el-option label="全文润色" value="polish" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="4">
                    <el-button type="primary" size="large" style="margin-left: 10px;">
                        开始校正
                    </el-button>
                </el-col>
            </el-row>
        </el-header>

        <!-- 预览区域 -->
        <el-main class="preview-area">
            <div ref="previewContainer" class="preview-container" style="height: 100%;">
                <el-empty v-if="!fileName" description="选择一个 DOCX 文件进行预览" :image-size="80" />
            </div>
        </el-main>
    </el-container>
</template>


<script setup>
import { ref, onMounted, watch } from 'vue'
import {
    ElContainer,
    ElHeader,
    ElMain,
    ElButton,
    ElAlert,
    ElEmpty,
    ElRow,
    ElCol
} from 'element-plus'
import { renderAsync } from 'docx-preview'
import { reactive } from 'vue'
// 状态变量
const previewContainer = ref(null)
const fileName = ref('')
const isLoading = ref(false)
const error = ref('')
// 从 Electron 获取 API
const electronAPI = window.electronAPI
const form = reactive({
    model: '',
    filePath: '',

})// 渲染 DOCX 文档

watch(form, (newForm, oldForm) => {
    console.log("the form's value change to:", newForm)
})



const onSubmit = () => {
    console.log('submit!')
}
const renderDocx = async (file) => {
    try {
        // 清空之前的预览内容
        previewContainer.value.innerHTML = ''

        // 渲染 DOCX 文件
        await renderAsync(file, previewContainer.value)
    } catch (err) {
        error.value = `文档渲染失败: ${err.message}`
        console.error('DOCX 渲染错误:', err)
        throw err
    }
}

// 使用主进程读取文件内容的方法
const selectFileWithMainProcessRead = async () => {
    try {
        isLoading.value = true
        error.value = ''

        // 调用 Electron API 选择文件
        const filePath = await electronAPI.selectDocxFile()
        form.filePath.value = filePath

        if (!filePath) {
            isLoading.value = false
            return
        }

        // 提取文件名
        fileName.value = filePath.split('\\').pop().split('/').pop()

        // 让主进程读取文件内容
        const fileData = await electronAPI.readDocxFile(filePath)

        // 将 base64 转换为 Blob
        const byteCharacters = atob(fileData.content)
        const byteArrays = []

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512)

            const byteNumbers = new Array(slice.length)
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i)
            }

            const byteArray = new Uint8Array(byteNumbers)
            byteArrays.push(byteArray)
        }

        const blob = new Blob(byteArrays, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        const file = new File([blob], fileName.value, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

        // 渲染文档
        await renderDocx(file)

        isLoading.value = false
    } catch (err) {
        error.value = `文件处理失败: ${err.message}`
        console.error('文件处理错误:', err)
        isLoading.value = false
    }
}

// 组件挂载后检查 Electron API 是否可用
onMounted(() => {
    if (!window.electronAPI) {
        error.value = 'Electron 环境未正确加载，请在 Electron 应用中运行此页面'
        console.error('Electron API 未定义')
    }
})
</script>

<style scoped>
.app-container {
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    max-width: 1200px;
    margin: 0 auto;
}

.preview-container {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: auto;
    background-color: white;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);


}

.preview-area {
    overflow-y: hidden;
}
</style>