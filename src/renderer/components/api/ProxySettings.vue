<template>
  <div class="setting-section">
    <div class="section-header">
      <el-icon><Connection /></el-icon>
      <span>{{ t('proxy.title') }}</span>
    </div>
    <div class="setting-body">
      <p class="section-description">
        <el-icon><InfoFilled /></el-icon>
        {{ t('proxy.description') }}
      </p>
      <el-form label-width="auto">
        <el-form-item :label="t('proxy.enableProxy')" class="form-item-enhanced">
          <el-switch
            :model-value="proxyEnabled_"
            @update:model-value="handleProxyToggle"
            :active-text="t('proxy.enabled')"
            :inactive-text="t('proxy.disabled')"
          />
        </el-form-item>
        <el-form-item v-if="proxyEnabled_" :label="t('proxy.proxyPort')" class="form-item-enhanced">
          <el-input-number
            :model-value="proxyPort_"
            @update:model-value="handleProxyPortChange"
            :min="1"
            :max="65535"
            :step="1"
          />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Connection, InfoFilled } from '@element-plus/icons-vue'
import { useProxy } from '../../composables/useProxy'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const { proxyPort_, proxyEnabled_ } = useProxy()

const handleProxyToggle = (value: boolean) => {
  const rawValue = proxyEnabled_.value
  try {
    proxyEnabled_.value = value
    if (rawValue != proxyEnabled_.value) {
      console.log('代理状态修改成功！')
      ElMessage.success(t('proxy.statusChanged'))
    } else {
      const error = '代理状态没有改变'
      throw error
    }
  } catch (error) {
    console.log('代理状态修改失败', error)
  }
}

const handleProxyPortChange = (value: number) => {
  const rawValue = proxyPort_.value
  if (rawValue === proxyPort_.value) {
    console.log('提供的端口没有发生改变，不做变化')
    return 0
  }
  try {
    proxyPort_.value = value
    if (rawValue != proxyPort_.value) {
      console.log(`端口修改成功，旧端口是${rawValue},新端口是${value}`)
      ElMessage.success(t('proxy.portChanged', { oldPort: rawValue, newPort: value }))
    } else {
      const error = '端口修改失败'
      throw error
    }
  } catch (error) {
    console.log(error)
    ElMessage.error(t('proxy.portChangeFailed'))
  }
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

.form-item-enhanced {
  margin-bottom: 20px;
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
</style>
