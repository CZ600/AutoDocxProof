<template>
    <el-card class="setting-card" shadow="hover">
        <template #header>
            <div class="card-header">
                <el-icon>
                    <Connection />
                </el-icon>
                <span>API选择</span>
            </div>
        </template>
        <p class="section-description">
            <el-icon>
                <InfoFilled />
            </el-icon>
            兼容支持openai规范的接口,对话模型和embedding模型都在这里添加
        </p>
        <el-form :model="selectedApi" label-width="auto">
            <el-form-item label="当前API:" class="form-item-enhanced">
                <el-select v-model="selectedApi.id" placeholder="请选择您的API" class="api-select">
                    <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName"
                        :value="item.id" id="api-item">
                        <div class="api-option">
                            <div class="api-option-info">
                                <el-icon>
                                    <Cpu />
                                </el-icon>
                                <span>{{ item.modelName }}</span>
                            </div>
                            <el-button type="danger" :icon="Delete" size="small" circle
                                @click.stop="handleDelete(item.id)" />
                        </div>
                    </el-option>
                </el-select>
            </el-form-item>
            <div class="button-group">
                <el-button type="primary" :icon="Plus" @click="handleAdd" class="btn-add">
                    添加新API
                </el-button>
                <el-button :icon="Connection" @click="handleTest" class="btn-test">
                    测试连通性
                </el-button>
            </div>
        </el-form>
    </el-card>
</template>

<script setup lang='ts'>
import { Delete, Connection, Plus, Cpu, InfoFilled } from '@element-plus/icons-vue'
import { useApiSettings } from '../../composables/useApiSettings'

// 直接使用 composable
const { selectedApi, apiSettings, deleteApi, testApi } = useApiSettings()

// 用于控制添加对话框的显示
const emit = defineEmits<{
    'add-api': []
}>()

const handleAdd = () => {
    emit('add-api')
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

.api-select {
    width: 100%;
}

.api-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0px 0;
    margin: 2px;
}

.api-option-info {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
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
