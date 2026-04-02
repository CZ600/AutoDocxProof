<template>
  <el-card class="setting-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <el-icon>
          <Connection />
        </el-icon>
        <span>{{ t('apiSelector.title') }}</span>
      </div>
    </template>
    <p class="section-description">
      <el-icon>
        <InfoFilled />
      </el-icon>
      {{ t('apiSelector.description') }}
    </p>
    <el-form :model="selectedApi" label-width="auto">
      <el-form-item :label="t('apiSelector.currentAPI')" class="form-item-enhanced">
        <el-select v-model="selectedApi.id" :placeholder="t('apiSelector.selectPlaceholder')" class="api-select">
          <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName" :value="item.id">
            <div class="api-option">
              <el-popover placement="bottom-start" trigger="hover" :width="320">
                <template #reference>
                  <div class="api-option-info">
                    <el-icon>
                      <Cpu />
                    </el-icon>
                    <span>{{ item.modelName }}</span>
                  </div>
                </template>
                <div class="api-detail-list">
                  <div>
                    <strong>{{ t('apiSelector.model') }}</strong> {{ item.modelName }}
                  </div>
                  <div class="api-url-line">
                    <strong>{{ t('apiSelector.address') }}</strong> {{ item.apiURL }}
                  </div>
                  <div>
                    <strong>{{ t('apiSelector.apiKey') }}</strong> {{ maskApiKey(item.apiKey) }}
                  </div>
                </div>
              </el-popover>
              <div class="api-option-actions">
                <el-button :icon="Edit" size="small" circle @click.stop="handleEdit(item)" />
                <el-button type="danger" :icon="Delete" size="small" circle @click.stop="handleDelete(item.id)" />
              </div>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <div class="button-group">
        <el-button type="primary" :icon="Plus" @click="handleAdd" class="btn-add">
          {{ t('apiSelector.addNewAPI') }}
        </el-button>
        <el-button :icon="Connection" @click="handleTest" class="btn-test">
          {{ t('apiSelector.testConnection') }}
        </el-button>
      </div>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { Delete, Edit, Connection, Plus, Cpu, InfoFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useApiSettings } from '../../composables/useApiSettings'

const { t } = useI18n()

interface ApiSettingItem {
  id: number
  apiURL: string
  apiKey: string
  modelName: string
}

const { selectedApi, apiSettings, deleteApi, testApi, maskApiKey } = useApiSettings()

const emit = defineEmits<{
  'add-api': []
  'edit-api': [item: { id: number; URL: string; key: string; name: string }]
}>()

const handleAdd = () => {
  emit('add-api')
}

const handleEdit = (item: ApiSettingItem) => {
  emit('edit-api', {
    id: item.id,
    URL: item.apiURL,
    key: item.apiKey,
    name: item.modelName
  })
}

const handleDelete = (id: number) => {
  deleteApi(id)
}

const handleTest = () => {
  testApi()
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

.section-description {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 15px;
  margin-top: 0;
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
  gap: 12px;
}

.api-option-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  min-width: 0;
  flex: 1;
}

.api-option-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.api-detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  line-height: 1.5;
  word-break: break-all;
}

.api-url-line {
  white-space: normal;
}

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
