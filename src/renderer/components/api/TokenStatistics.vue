<template>
  <el-card class="setting-card token-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <el-icon>
          <DataLine />
        </el-icon>
        <span>{{ t('tokenStats.title') }}</span>
      </div>
    </template>
    <div class="token-stats">
      <el-statistic :value="totalTokens" class="statistic">
        <template #title>
          <div class="statistic-title">
            <span>{{ t('tokenStats.totalTokens') }}</span>
            <el-tooltip effect="dark" :content="t('tokenStats.tooltip')" placement="top">
              <el-icon class="tooltip-icon">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
      </el-statistic>
      <el-button type="danger" :icon="Delete" @click="handleReset" class="btn-reset">
        {{ t('tokenStats.clearStats') }}
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Delete, DataLine, QuestionFilled } from '@element-plus/icons-vue'
import { useToken } from '../../composables/useToken'

const { t } = useI18n()
const { totalTokens, resetTokens } = useToken()

const handleReset = () => {
  resetTokens()
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
