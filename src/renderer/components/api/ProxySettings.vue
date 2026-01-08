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
            <el-form label-width="auto">
                <el-form-item label="启用代理" class="form-item-enhanced">
                    <el-switch :model-value="proxyEnabled_" @update:model-value="handleProxyToggle" active-text="已启用"
                        inactive-text="已禁用" />
                </el-form-item>
                <el-form-item v-if="proxyEnabled_" label="代理端口" class="form-item-enhanced">
                    <el-input-number :model-value="proxyPort_" @update:model-value="handleProxyPortChange" :min="1"
                        :max="65535" :step="1" />
                </el-form-item>
            </el-form>
        </div>
    </el-card>
</template>

<script setup lang='ts'>
import { Connection, InfoFilled } from '@element-plus/icons-vue'
import { useProxy } from '../../composables/useProxy'
import { error } from 'node:console'
import { ElMessage } from 'element-plus'

// 直接使用 composable
const { proxyPort_, proxyEnabled_ } = useProxy()

const handleProxyToggle = (value: boolean) => {
    const rawValue = proxyEnabled_.value
    try {
        proxyEnabled_.value = value
        if (rawValue != proxyEnabled_.value) {
            console.log("代理状态修改成功！")
            ElMessage.success("代理状态改变")
        } else {
            const error = "代理状态没有改变"
            throw (error)
        }

    }
    catch (error) {
        console.log("代理状态修改失败", error)
    }
}

const handleProxyPortChange = (value: number) => {
    const rawValue = proxyPort_.value
    if (rawValue === proxyPort_.value) {
        console.log("提供的端口没有发生改变，不做变化")
        return 0
    }
    try {
        proxyPort_.value = value
        if (rawValue != proxyPort_.value) {
            console.log("端口修改成功，旧端口是${rawValue},新端口是${value}")
            ElMessage.success("端口修改成功，旧端口是${rawValue},新端口是${value}")
        } else {
            const error = '端口修改失败'
            throw (error)
        }
    } catch (error) {
        console.log(error)
        ElMessage.error(error)
    }
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
