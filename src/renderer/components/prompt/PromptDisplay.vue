<template>
    <el-card class="setting-card prompt-display-card" shadow="hover">
        <template #header>
            <div class="card-header">
                <el-icon>
                    <DataLine />
                </el-icon>
                <span>当前生效提示词</span>
            </div>
        </template>
        <div class="prompt-content-wrapper">
            <div class="prompt-meta">
                <span class="prompt-label">当前模式：</span>
                <el-tag size="small" type="primary">{{ modeLabel }}</el-tag>
            </div>
            <div class="prompt-label">当前使用的提示词：</div>
            <el-text class="prompt-content">
                {{ effectivePrompt }}
            </el-text>
        </div>
    </el-card>
</template>

<script setup lang='ts'>
import { DataLine } from '@element-plus/icons-vue'
import { usePrompt } from '../../composables/usePrompt'

const { effectivePrompt, modeLabel } = usePrompt()
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

.prompt-content-wrapper {
    padding: 10px 0;
}

.prompt-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
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
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color);
}

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
