<template>
    <el-card class="setting-card" shadow="hover">
        <template #header>
            <div class="card-header">
                <el-icon>
                    <Connection />
                </el-icon>
                <span>代理设置</span>
            </div>
        </template>
        <div class="setting-section">
            <p class="section-description">
                <el-icon>
                    <InfoFilled />
                </el-icon>
                配置HTTP代理用于网络请求。默认禁用，端口默认为33210
            </p>
            <el-form :model="proxyForm" label-width="auto">
                <el-form-item label="启用代理" class="form-item-enhanced">
                    <el-switch
                        :model-value="proxyEnabled"
                        @update:model-value="handleProxyToggle"
                        active-text="已启用"
                        inactive-text="已禁用"
                    />
                </el-form-item>
                <el-form-item v-if="proxyEnabled" label="代理端口" class="form-item-enhanced">
                    <el-input-number
                        :model-value="proxyPort"
                        @update:model-value="handleProxyPortChange"
                        :min="1"
                        :max="65535"
                        :step="1"
                    />
                </el-form-item>
            </el-form>
        </div>
    </el-card>
</template>

<script setup lang='ts'>
import { Connection, InfoFilled } from '@element-plus/icons-vue'
import { reactive } from 'vue'

const proxyForm = reactive({
    enabled: false,
    port: 33210
})

defineProps<{
    proxyEnabled: boolean
    proxyPort: number
}>()

const emit = defineEmits<{
    'update:proxyEnabled': [value: boolean]
    'update:proxyPort': [value: number]
}>()

const handleProxyToggle = (value: boolean) => {
    emit('update:proxyEnabled', value)
}

const handleProxyPortChange = (value: number) => {
    emit('update:proxyPort', value)
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

.form-item-enhanced {
    margin-bottom: 20px;
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
