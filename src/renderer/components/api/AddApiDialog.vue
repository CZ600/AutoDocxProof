<template>
    <el-dialog
        :model-value="visible"
        @update:model-value="handleClose"
        title="添加新API"
        width="500px"
        class="api-dialog"
    >
        <template #header>
            <div class="dialog-header">
                <el-icon>
                    <Plus />
                </el-icon>
                <span>添加新API</span>
            </div>
        </template>
        <el-form :model="formData" label-position="top" class="dialog-form">
            <el-form-item label="API URL:" class="form-item">
                <el-input
                    v-model="formData.URL"
                    placeholder="请输入API地址"
                    :prefix-icon="Link"
                />
            </el-form-item>
            <el-form-item label="API KEY:" class="form-item">
                <el-input
                    v-model="formData.key"
                    type="password"
                    show-password
                    placeholder="请输入API密钥"
                    :prefix-icon="Lock"
                />
            </el-form-item>
            <el-form-item label="模型名称:" class="form-item">
                <el-input
                    v-model="formData.name"
                    placeholder="请输入模型名称"
                    :prefix-icon="Cpu"
                />
            </el-form-item>
        </el-form>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleReset">重置</el-button>
                <el-button @click="handleClose">取消</el-button>
                <el-button type="primary" @click="handleSubmit">保存</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup lang='ts'>
import { Plus, Link, Lock, Cpu } from '@element-plus/icons-vue'
import { reactive } from 'vue'

interface FormData {
    URL: string
    key: string
    name: string
}

defineProps<{
    visible: boolean
}>()

const emit = defineEmits<{
    'update:visible': [value: boolean]
    'submit': [data: FormData]
    'reset': []
}>()

const formData = reactive({
    URL: '',
    key: '',
    name: ''
})

const handleClose = (value: boolean) => {
    if (!value) {
        // 关闭时重置表单
        formData.URL = ''
        formData.key = ''
        formData.name = ''
    }
    emit('update:visible', value)
}

const handleSubmit = () => {
    emit('submit', { ...formData })
    // 重置表单
    formData.URL = ''
    formData.key = ''
    formData.name = ''
}

const handleReset = () => {
    formData.URL = ''
    formData.key = ''
    formData.name = ''
}
</script>

<style scoped>
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
</style>
