<template>
    <div class="api-settings-container">
        <el-tabs v-model="activeTab" type="border-card" class="custom-tabs">
            <el-tab-pane label="API设置" name="api">
                <div class="tab-content">
                    <el-alert v-if="showAlertSuccess" type="success" auto-close="4000" show-icon class="fade-slide">
                        {{ alertTitle }}
                    </el-alert>
                    <el-alert v-if="showAlertError" type="error" auto-close="4000" show-icon class="fade-slide">
                        {{ alertTitle }}
                    </el-alert>

                    <ApiSelector
                        @add-api="openCreateDialog"
                        @edit-api="openEditDialog"
                    />

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

            <el-tab-pane label="提示词设置" name="prompt">
                <div class="tab-content">
                    <PromptSettingsPanel />
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import ApiSelector from '../components/api/ApiSelector.vue'
import AddApiDialog from '../components/api/AddApiDialog.vue'
import TokenStatistics from '../components/api/TokenStatistics.vue'
import ConcurrencySettings from '../components/api/ConcurrencySettings.vue'
import RateLimitSettings from '../components/api/RateLimitSettings.vue'
import ProxySettings from '../components/api/ProxySettings.vue'
import PromptSettingsPanel from '../components/prompt/PromptSettingsPanel.vue'
import { useApiSettings, type ApiFormData } from '../composables/useApiSettings'

const activeTab = ref('api')
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingApi = ref<ApiFormData | null>(null)

const { showAlertSuccess, showAlertError, alertTitle, addApi, updateApi, initialize: initApiSettings } = useApiSettings()

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

@media (max-width: 768px) {
    .api-settings-container {
        padding: 10px;
    }

    .tab-content {
        padding: 15px;
    }
}
</style>
