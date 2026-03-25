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

                    <!-- API选择组件 -->
                    <ApiSelector @add-api="dialogVisible = true" />

                    <!-- 添加API对话框组件 -->
                    <AddApiDialog
                        v-model:visible="dialogVisible"
                        @submit="handleAddApi"
                    />

                    <!-- Token统计组件  -->
                    <TokenStatistics />

                    <!-- 并发设置组件  -->
                    <ConcurrencySettings />

                    <!-- 频率限制设置组件 -->
                    <RateLimitSettings />

                    <!-- 代理设置组件  -->
                    <ProxySettings />
                </div>
            </el-tab-pane>

            <el-tab-pane label="提示词设置" name="prompt">
                <div class="tab-content">
                    <!-- 当前提示词展示组件  -->
                    <PromptDisplay />

                    <!-- 编辑提示词组件  -->
                    <PromptEditor />
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue'
import ApiSelector from '../components/api/ApiSelector.vue'
import AddApiDialog from '../components/api/AddApiDialog.vue'
import TokenStatistics from '../components/api/TokenStatistics.vue'
import ConcurrencySettings from '../components/api/ConcurrencySettings.vue'
import RateLimitSettings from '../components/api/RateLimitSettings.vue'
import ProxySettings from '../components/api/ProxySettings.vue'
import PromptDisplay from '../components/prompt/PromptDisplay.vue'
import PromptEditor from '../components/prompt/PromptEditor.vue'
import { useApiSettings } from '../composables/useApiSettings'
import { usePrompt } from '../composables/usePrompt'
import { useProxy } from '../composables/useProxy'

// 当前激活的标签页
const activeTab = ref('api')

// 添加 API 对话框显示状态
const dialogVisible = ref(false)

// 使用 composables
const { showAlertSuccess, showAlertError, alertTitle, addApi, initialize: initApiSettings } = useApiSettings()
const { initialize: initPrompt } = usePrompt()

/**
 * 添加新 API
 */
const handleAddApi = async (data: { URL: string; key: string; name: string }) => {
    const success = await addApi(data)
    if (success) {
        dialogVisible.value = false
    }
}

/**
 * 初始化
 */
onMounted(async () => {
    await initApiSettings()
    await initPrompt()
})
</script>

<style scoped>
/* 主容器 */
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

/* 动画效果 */
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

/* 响应式设计 */
@media (max-width: 768px) {
    .api-settings-container {
        padding: 10px;
    }

    .tab-content {
        padding: 15px;
    }
}
</style>
