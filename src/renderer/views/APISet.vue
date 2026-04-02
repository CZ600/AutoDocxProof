<template>
  <div class="api-settings-container">
    <el-tabs v-model="activeTab" type="border-card" class="custom-tabs">
      <el-tab-pane :label="t('apiSettings.tabAPI')" name="api">
        <div class="tab-content">
          <el-alert v-if="showAlertSuccess" type="success" auto-close="4000" show-icon class="fade-slide">
            {{ alertTitle }}
          </el-alert>
          <el-alert v-if="showAlertError" type="error" auto-close="4000" show-icon class="fade-slide">
            {{ alertTitle }}
          </el-alert>

          <ApiSelector @add-api="openCreateDialog" @edit-api="openEditDialog" />

          <AddApiDialog
            v-model:visible="dialogVisible"
            :mode="dialogMode"
            :initial-data="editingApi"
            @submit="handleSubmitApi"
          />

          <TokenStatistics />
          <ConcurrencySettings />
          <RateLimitSettings />
          <ProxySettings />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('apiSettings.tabPrompt')" name="prompt">
        <div class="tab-content">
          <PromptSettingsPanel />
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon>
                  <CircleCheck />
                </el-icon>
                <span>{{ t('apiSettings.reviewModelConfig') }}</span>
              </div>
            </template>
            <div class="review-model-desc">
              {{ t('apiSettings.reviewModelDesc') }}
            </div>
            <el-form label-position="top" class="review-model-form">
              <el-form-item :label="t('apiSettings.selectReviewModel')" class="form-item">
                <el-select
                  v-model="apiStore.reviewModelId"
                  :placeholder="t('apiSettings.reviewModelPlaceholder')"
                  class="api-select"
                  clearable
                >
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
                            <strong>{{ t('apiSettings.model') }}</strong> {{ item.modelName }}
                          </div>
                          <div class="api-url-line">
                            <strong>{{ t('apiSettings.address') }}</strong> {{ item.apiURL }}
                          </div>
                          <div>
                            <strong>{{ t('apiSettings.apiKey') }}</strong> {{ maskApiKey(item.apiKey) }}
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>
              <div class="button-group">
                <el-button @click="handleClearReviewModel" type="default" :icon="Delete">{{
                  t('apiSettings.restoreDefault')
                }}</el-button>
              </div>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-card class="setting-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Connection /></el-icon>
          <span>{{ t('apiSettings.languageLabel') }}</span>
        </div>
      </template>
      <el-select v-model="currentLocale" @change="handleLocaleChange">
        <el-option label="简体中文" value="zh-CN" />
        <el-option label="English" value="en" />
      </el-select>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { CircleCheck, Cpu, Select, Delete, Connection } from '@element-plus/icons-vue'
import ApiSelector from '../components/api/ApiSelector.vue'
import AddApiDialog from '../components/api/AddApiDialog.vue'
import TokenStatistics from '../components/api/TokenStatistics.vue'
import ConcurrencySettings from '../components/api/ConcurrencySettings.vue'
import RateLimitSettings from '../components/api/RateLimitSettings.vue'
import ProxySettings from '../components/api/ProxySettings.vue'
import PromptSettingsPanel from '../components/prompt/PromptSettingsPanel.vue'
import { useApiSettings, type ApiFormData } from '../composables/useApiSettings'
import { useApiStore } from '../stores/apiStore'
import { useLocaleStore } from '../stores/localeStore'

const { t } = useI18n()
const localeStore = useLocaleStore()

const currentLocale = computed(() => localeStore.currentLocale)
const handleLocaleChange = (val: 'zh-CN' | 'en') => {
  localeStore.setLocale(val)
}

const activeTab = ref('api')
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingApi = ref<ApiFormData | null>(null)

const {
  showAlertSuccess,
  showAlertError,
  alertTitle,
  addApi,
  updateApi,
  initialize: initApiSettings,
  apiSettings,
  maskApiKey
} = useApiSettings()

const apiStore = useApiStore()

const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingApi.value = null
  dialogVisible.value = true
}

const openEditDialog = (api: ApiFormData) => {
  dialogMode.value = 'edit'
  editingApi.value = { ...api }
  dialogVisible.value = true
}

const handleSubmitApi = async (data: ApiFormData) => {
  const success = dialogMode.value === 'edit' ? await updateApi(data) : await addApi(data)
  if (success) {
    dialogVisible.value = false
    editingApi.value = null
  }
}

const handleSaveReviewModel = () => {
  if (apiStore.reviewModelId === null) {
    ElMessage.warning(t('apiSettings.pleaseSelectReviewModel'))
    return
  }
  ElMessage.success(t('apiSettings.reviewModelSaved'))
}

const handleClearReviewModel = () => {
  apiStore.clearReviewModel()
  ElMessage.success(t('apiSettings.restoredToDefault'))
}

onMounted(async () => {
  await initApiSettings()
})
</script>

<style scoped>
.api-settings-container {
  padding: 20px;
  min-height: 100vh;
}

.custom-tabs {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
}

.tab-content {
  padding: 30px;
  background-color: var(--el-bg-color);
}

.fade-slide {
  animation: fadeSlide 0.5s ease;
}

@keyframes fadeSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.review-model-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.review-model-form {
  padding: 10px 0;
}

.form-item {
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

.btn-save {
  min-width: 160px;
}

.setting-card {
  margin-top: 24px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid var(--el-border-color);
}

.setting-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

@media (max-width: 768px) {
  .api-settings-container {
    padding: 10px;
  }

  .tab-content {
    padding: 15px;
  }
}
</style>
