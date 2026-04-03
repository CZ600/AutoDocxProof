<template>
  <div class="setting-section">
    <div class="section-header">
      <el-icon><Odometer /></el-icon>
      <span>{{ t('concurrency.title') }}</span>
    </div>
    <div class="setting-body">
      <p class="section-description">
        <el-icon><InfoFilled /></el-icon>
        {{ t('concurrency.description') }}
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
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Odometer, InfoFilled } from '@element-plus/icons-vue'
import { useApiSettings } from '../../composables/useApiSettings'

const { t } = useI18n()
const { parallelValue, updateParallel } = useApiSettings()

const handleParallelChange = (value: number) => {
  updateParallel(value)
}
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #4a6580;
  margin-bottom: 14px;
}

.section-header .el-icon {
  color: #7b9eb8;
  font-size: 16px;
}

.setting-body {
  padding: 4px 0;
}

.section-description {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 15px;
  margin-top: 0;
  padding: 10px 14px;
  background-color: #f4f6f9;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #7a8694;
  border: none;
}

.section-description .el-icon {
  color: #8eafc4;
  margin-top: 2px;
  flex-shrink: 0;
}

.custom-slider {
  margin: 16px 0;
  padding: 10px;
}

.custom-slider :deep(.el-slider__runway) {
  height: 4px;
  border-radius: 2px;
  background-color: #e4e9ef;
}

.custom-slider :deep(.el-slider__bar) {
  height: 4px;
  border-radius: 2px;
  background-color: #8eafc4;
}

.custom-slider :deep(.el-slider__button) {
  width: 14px;
  height: 14px;
  background-color: #7b9eb8;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(91, 124, 153, 0.25);
}

.setting-section {
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: 8px;
  background: #ffffff;
}
</style>

<style>
html.dark .setting-section {
  background-color: #000000;
}

html.dark .section-header {
  color: #c0c4cc;
}

html.dark .section-header .el-icon {
  color: #8ec5ff;
}

html.dark .section-description {
  background-color: #1a1a1a;
  color: #a0a0a0;
}

html.dark .section-description .el-icon {
  color: #8ec5ff;
}

html.dark .custom-slider :deep(.el-slider__runway) {
  background-color: #2c2e30;
}

html.dark .custom-slider :deep(.el-slider__button) {
  border-color: #1a1a1a;
}
</style>
