<template>
    <el-card class="setting-card" shadow="hover">
        <template #header>
            <div class="card-header">
                <el-icon>
                    <Setting />
                </el-icon>
                <span>提示词配置</span>
            </div>
        </template>

        <el-form label-position="top" class="prompt-form">
            <el-form-item label="错误类型" class="form-item">
                <el-checkbox-group v-model="draftSettings.errorTypes" class="checkbox-group">
                    <el-checkbox
                        v-for="item in errorTypeOptions"
                        :key="item.value"
                        :label="item.value"
                    >
                        {{ item.label }}
                    </el-checkbox>
                </el-checkbox-group>
            </el-form-item>

            <el-form-item label="校正强度" class="form-item">
                <el-radio-group v-model="draftSettings.intensity" class="radio-group">
                    <el-radio-button
                        v-for="item in intensityOptions"
                        :key="item.value"
                        :label="item.value"
                    >
                        {{ item.label }}
                    </el-radio-button>
                </el-radio-group>
            </el-form-item>

            <el-form-item label="文本背景" class="form-item">
                <el-radio-group v-model="draftSettings.background" class="radio-group">
                    <el-radio-button
                        v-for="item in backgroundOptions"
                        :key="item.value"
                        :label="item.value"
                    >
                        {{ item.label }}
                    </el-radio-button>
                </el-radio-group>
            </el-form-item>

            <el-form-item v-if="draftSettings.background === 'custom'" label="自定义背景说明" class="form-item">
                <el-input
                    v-model="draftSettings.customBackground"
                    type="textarea"
                    :rows="3"
                    placeholder="例如：医学论文摘要、企业周报、产品公告等"
                />
            </el-form-item>

            <el-divider>自定义提示词</el-divider>

            <div class="custom-mode-row">
                <div>
                    <div class="custom-mode-title">开启自定义提示词覆盖</div>
                    <div class="custom-mode-desc">开启后将完全使用你输入的提示词，不再使用上方选项生成结果。</div>
                </div>
                <el-switch v-model="draftSettings.customPromptEnabled" />
            </div>

            <el-form-item v-if="draftSettings.customPromptEnabled" label="自定义提示词" class="form-item">
                <el-input
                    v-model="draftSettings.customPrompt"
                    type="textarea"
                    :rows="7"
                    placeholder="请输入自定义提示词"
                    class="prompt-textarea"
                />
            </el-form-item>

            <div class="button-group">
                <el-button @click="handleSave" type="primary" :icon="Select" class="btn-save">
                    应用配置
                </el-button>
                <el-button @click="resetDraft" type="default" :icon="RefreshLeft">
                    撤销未保存修改
                </el-button>
                <el-button @click="handleReset" type="default" :icon="Warning" class="btn-reset">
                    恢复默认配置
                </el-button>
            </div>
        </el-form>
    </el-card>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue'
import { RefreshLeft, Select, Setting, Warning } from '@element-plus/icons-vue'
import { usePrompt } from '../../composables/usePrompt'
import { clonePromptSettings } from '../../../shared/promptSettings'

const {
    settings,
    errorTypeOptions,
    intensityOptions,
    backgroundOptions,
    savePromptSettings,
    resetToDefault
} = usePrompt()

const draftSettings = ref(clonePromptSettings(settings.value))

watch(
    settings,
    (value) => {
        draftSettings.value = clonePromptSettings(value)
    },
    { deep: true, immediate: true }
)

const resetDraft = () => {
    draftSettings.value = clonePromptSettings(settings.value)
}

const handleSave = async () => {
    const success = await savePromptSettings(draftSettings.value)
    if (success) {
        resetDraft()
    }
}

const handleReset = async () => {
    const success = await resetToDefault()
    if (success) {
        resetDraft()
    }
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
    margin-bottom: 24px;
}

.checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
}

.radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.custom-mode-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-fill-color-light);
}

.custom-mode-title {
    font-weight: 600;
    margin-bottom: 6px;
}

.custom-mode-desc {
    color: var(--el-text-color-secondary);
    line-height: 1.6;
    font-size: 13px;
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

@media (max-width: 768px) {
    .custom-mode-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
