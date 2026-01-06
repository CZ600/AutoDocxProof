<template>
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
                <el-input
                    :model-value="newPrompt"
                    @update:model-value="handlePromptChange"
                    type="textarea"
                    :rows="6"
                    placeholder="请输入新的提示词"
                    class="prompt-textarea"
                />
            </el-form-item>
            <div class="button-group">
                <el-button @click="handleUpdate" type="primary" :icon="DataLine" class="btn-save">
                    修改提示词
                </el-button>
                <el-button @click="handleReset" type="default" :icon="Warning" class="btn-reset">
                    恢复默认设置
                </el-button>
            </div>
        </el-form>
    </el-card>
</template>

<script setup lang='ts'>
import { DataLine, Warning } from '@element-plus/icons-vue'
import { reactive } from 'vue'

const promptForm = reactive({
    prompt: ''
})

defineProps<{
    newPrompt: string
}>()

const emit = defineEmits<{
    'update:newPrompt': [value: string]
    'update-prompt': []
    'reset-prompt': []
}>()

const handlePromptChange = (value: string) => {
    emit('update:newPrompt', value)
}

const handleUpdate = () => {
    emit('update-prompt')
}

const handleReset = () => {
    emit('reset-prompt')
}
</script>

<style scoped>
.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 15px;
    color: var(--el-text-color-primary);
}

.prompt-form {
    padding: 10px 0;
}

.form-item {
    margin-bottom: 20px;
}

.prompt-textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.button-group {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
}

.btn-save {
    flex: 1;
    min-width: 140px;
}

.btn-reset {
    min-width: 140px;
}

.setting-card {
    margin-bottom: 24px;
    border-radius: 8px;
    transition: all 0.2s ease;
    border: 1px solid var(--el-border-color);
}

.setting-card:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
</style>
