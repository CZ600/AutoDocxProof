<template>
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
            <el-slider
                :model-value="parallelValue"
                @update:model-value="handleParallelChange"
                show-input
                :min="1"
                :max="100"
                class="custom-slider"
            />
        </div>
    </el-card>
</template>

<script setup lang='ts'>
import { Odometer, InfoFilled } from '@element-plus/icons-vue'

defineProps<{
    parallelValue: number
}>()

const emit = defineEmits<{
    'update:parallelValue': [value: number]
}>()

const handleParallelChange = (value: number) => {
    emit('update:parallelValue', value)
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

.custom-slider {
    margin: 20px 0;
    padding: 10px;
}

.custom-slider :deep(.el-slider__runway) {
    height: 6px;
    border-radius: 3px;
}

.custom-slider :deep(.el-slider__bar) {
    height: 6px;
    border-radius: 3px;
    background-color: var(--el-color-primary);
}

.custom-slider :deep(.el-slider__button) {
    width: 16px;
    height: 16px;
    background-color: var(--el-color-primary);
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
