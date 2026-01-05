# 推荐的组件目录结构

```
src/renderer/
├── views/
│   └── APISet.vue                    # 主页面（精简后 ~150行）
│
├── components/
│   ├── ApiSettings/                  # API设置相关组件组
│   │   ├── ApiSelector.vue           # API选择器
│   │   ├── ApiFormDialog.vue         # 添加API对话框
│   │   ├── TokenStats.vue            # Token统计卡片
│   │   ├── ConcurrencySettings.vue   # 并发设置卡片
│   │   ├── RateLimitSettings.vue     # 频率限制卡片
│   │   ├── ProxySettings.vue         # 代理设置卡片
│   │   └── index.ts                  # 统一导出
│   │
│   ├── PromptSettings/               # 提示词设置组件组
│   │   ├── PromptDisplay.vue         # 当前提示词展示
│   │   ├── PromptEditor.vue          # 提示词编辑器
│   │   └── index.ts
│   │
│   └── common/                       # 通用基础组件
│       ├── SettingCard.vue           # 设置卡片容器
│       └── SectionDescription.vue    # 区域说明文字
│
├── composables/                      # 组合式函数（业务逻辑）
│   ├── useApiSettings.ts             # API设置逻辑
│   ├── useTokenStats.ts              # Token统计逻辑
│   ├── usePromptSettings.ts          # 提示词设置逻辑
│   └── useProxySettings.ts           # 代理设置逻辑
│
├── types/                            # 类型定义
│   └── api-settings.ts               # API相关类型
│
└── stores/
    └── apiStore.ts                   # 已有的store（需完善）
```

---

## 组件拆分原则

### 1. **单一职责原则**
每个组件只负责一个功能模块

### 2. **组件分类**
- **页面组件（Views）**: 路由页面，负责组装子组件
- **业务组件（Components）**: 可复用的业务功能组件
- **基础组件（Common）**: 通用的UI组件

### 3. **组件通信**
- **Props Down**: 父组件向子组件传递数据
- **Events Up**: 子组件向父组件传递事件
- **Store**: 跨组件共享状态
- **Composables**: 可复用的逻辑

---

## 具体实现示例

### 1️⃣ 创建类型定义

```typescript
// src/renderer/types/api-settings.ts

export interface ApiConfig {
  id: number | null
  URL: string
  apiKey: string
  modelName: string
  createdAt: string
  parallel: number
  timeLimit?: number | null
  totalTokens?: number
}

export interface ApiSettingsFormData {
  URL: string
  key: string
  name: string
}

export interface ProxyConfig {
  enabled: boolean
  port: number
}

export interface ConcurrencyConfig {
  parallel: number
}

export interface RateLimitConfig {
  enabled: boolean
  limit: number | null
}
```

### 2️⃣ 创建 Composable（业务逻辑层）

```typescript
// src/renderer/composables/useApiSettings.ts

import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { ApiConfig, ApiSettingsFormData } from '@/types/api-settings'

export function useApiSettings() {
  const apiList = ref<ApiConfig[]>([])
  const selectedApiId = ref<number | null>(null)

  // 添加API
  const addApi = async (formData: ApiSettingsFormData) => {
    try {
      const result = await window.electronAPI.APISettings(
        formData.URL,
        formData.key,
        formData.name
      )

      if (result === 'success') {
        await fetchAllApis()
        ElMessage.success('API设置成功')
        return true
      } else {
        ElMessage.error('API设置失败')
        return false
      }
    } catch (error) {
      ElMessage.error('添加API失败')
      return false
    }
  }

  // 删除API
  const deleteApi = async (id: number) => {
    const result = await window.electronAPI.deleteOneAPI(id)
    if (result) {
      await fetchAllApis()
      ElMessage.success('删除成功')
      return true
    }
    ElMessage.error('删除失败')
    return false
  }

  // 获取所有API
  const fetchAllApis = async () => {
    const result = await window.electronAPI.getALLAPISettings()
    apiList.value = result || []
  }

  // 测试API
  const testApi = async (api: ApiConfig) => {
    try {
      const result = await window.electronAPI.testAPI(
        api.URL,
        api.apiKey,
        api.modelName
      )
      if (result) {
        ElMessage.success('测试成功')
        return true
      }
      ElMessage.error('测试失败')
      return false
    } catch (error) {
      ElMessage.error('测试失败')
      return false
    }
  }

  // 选择API
  const selectApi = async (api: ApiConfig) => {
    await window.electronAPI.selectAPISetting(
      api.URL,
      api.apiKey,
      api.modelName,
      api.parallel,
      api.timeLimit
    )
  }

  return {
    apiList,
    selectedApiId,
    addApi,
    deleteApi,
    fetchAllApis,
    testApi,
    selectApi
  }
}
```

### 3️⃣ 创建子组件

#### 组件1: ApiFormDialog.vue（添加API对话框）

```vue
<!-- src/renderer/components/ApiSettings/ApiFormDialog.vue -->
<template>
  <el-dialog
    v-model="visible"
    title="添加新API"
    width="500px"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <el-icon><Plus /></el-icon>
        <span>添加新API</span>
      </div>
    </template>

    <el-form :model="formData" label-position="top">
      <el-form-item label="API URL">
        <el-input
          v-model="formData.URL"
          placeholder="请输入API地址"
          :prefix-icon="Link"
        />
      </el-form-item>

      <el-form-item label="API KEY">
        <el-input
          v-model="formData.key"
          type="password"
          show-password
          placeholder="请输入API密钥"
          :prefix-icon="Lock"
        />
      </el-form-item>

      <el-form-item label="模型名称">
        <el-input
          v-model="formData.name"
          placeholder="请输入模型名称"
          :prefix-icon="Cpu"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleReset">重置</el-button>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Link, Lock, Cpu } from '@element-plus/icons-vue'
import type { ApiSettingsFormData } from '@/types/api-settings'

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', data: ApiSettingsFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = ref(props.modelValue)
const formData = ref<ApiSettingsFormData>({
  URL: '',
  key: '',
  name: ''
})

// 监听 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

const handleClose = () => {
  visible.value = false
}

const handleReset = () => {
  formData.value = {
    URL: '',
    key: '',
    name: ''
  }
}

const handleSubmit = () => {
  // 表单验证
  if (!formData.value.URL || !formData.value.key || !formData.value.name) {
    ElMessage.warning('请填写完整信息')
    return
  }

  emit('submit', { ...formData.value })
  handleReset()
  handleClose()
}
</script>

<style scoped lang="scss">
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 18px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
```

#### 组件2: ApiSelector.vue（API选择器）

```vue
<!-- src/renderer/components/ApiSettings/ApiSelector.vue -->
<template>
  <el-card shadow="hover" class="setting-card">
    <template #header>
      <div class="card-header">
        <el-icon><Connection /></el-icon>
        <span>API选择</span>
      </div>
    </template>

    <SectionDescription>
      兼容支持openai规范的接口，对话模型和embedding模型都在这里添加
    </SectionDescription>

    <el-form :model="form" label-width="auto">
      <el-form-item label="当前API">
        <el-select
          v-model="selectedApiId"
          placeholder="请选择您的API"
          class="api-select"
          @change="handleSelectChange"
        >
          <el-option
            v-for="item in apiList"
            :key="item.id"
            :label="item.modelName"
            :value="item.id"
          >
            <div class="api-option">
              <div class="api-option-info">
                <el-icon><Cpu /></el-icon>
                <span>{{ item.modelName }}</span>
              </div>
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                circle
                @click.stop="handleDelete(item)"
              />
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <div class="button-group">
        <el-button
          type="primary"
          :icon="Plus"
          @click="showAddDialog = true"
        >
          添加新API
        </el-button>
        <el-button
          :icon="Connection"
          @click="handleTest"
          :disabled="!selectedApi"
        >
          测试连通性
        </el-button>
      </div>
    </el-form>

    <!-- 添加API对话框 -->
    <ApiFormDialog
      v-model="showAddDialog"
      @submit="handleAddApi"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Connection,
  Cpu,
  Delete,
  Plus
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import ApiFormDialog from './ApiFormDialog.vue'
import SectionDescription from '@/components/common/SectionDescription.vue'
import type { ApiConfig, ApiSettingsFormData } from '@/types/api-settings'

interface Props {
  apiList: ApiConfig[]
  modelValue: number | null
}

interface Emits {
  (e: 'update:modelValue', value: number | null): void
  (e: 'add', data: ApiSettingsFormData): void
  (e: 'delete', id: number): void
  (e: 'test', api: ApiConfig): void
  (e: 'select', api: ApiConfig): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showAddDialog = ref(false)

const selectedApiId = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedApi = computed(() =>
  props.apiList.find(item => item.id === props.modelValue)
)

const handleSelectChange = () => {
  if (selectedApi.value) {
    emit('select', selectedApi.value)
  }
}

const handleAddApi = (data: ApiSettingsFormData) => {
  emit('add', data)
}

const handleDelete = async (api: ApiConfig) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 API "${api.modelName}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    emit('delete', api.id!)
  } catch {
    // 用户取消
  }
}

const handleTest = () => {
  if (selectedApi.value) {
    emit('test', selectedApi.value)
  }
}
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.api-select {
  width: 100%;
}

.api-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0;
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
}
</style>
```

#### 组件3: TokenStats.vue（Token统计）

```vue
<!-- src/renderer/components/ApiSettings/TokenStats.vue -->
<template>
  <el-card shadow="hover" class="token-stats-card">
    <template #header>
      <div class="card-header">
        <el-icon><DataLine /></el-icon>
        <span>使用统计</span>
      </div>
    </template>

    <div class="token-stats">
      <el-statistic :value="totalTokens">
        <template #title>
          <div class="statistic-title">
            <span>累计Token使用量</span>
            <el-tooltip
              effect="dark"
              content="数据存放于缓存中，清空缓存则清零重置"
              placement="top"
            >
              <el-icon class="tooltip-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
      </el-statistic>

      <el-button
        type="danger"
        :icon="Delete"
        @click="handleReset"
      >
        清空统计
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { DataLine, QuestionFilled, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

interface Props {
  totalTokens: number
}

interface Emits {
  (e: 'reset'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleReset = async () => {
  try {
    await ElMessageBox.confirm(
      '是否要清空token记录?',
      'Warning',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    emit('reset')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.token-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
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

  &:hover {
    color: var(--el-color-primary);
  }
}
</style>
```

### 4️⃣ 重构主页面组件

```vue
<!-- src/renderer/views/APISet.vue -->
<template>
  <div class="api-settings-container">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- API设置标签页 -->
      <el-tab-pane label="API设置" name="api">
        <div class="tab-content">
          <!-- API选择器 -->
          <ApiSelector
            v-model="selectedApiId"
            :api-list="apiList"
            @add="handleAddApi"
            @delete="handleDeleteApi"
            @test="handleTestApi"
            @select="handleSelectApi"
          />

          <!-- Token统计 -->
          <TokenStats
            :total-tokens="totalTokens"
            @reset="handleResetTokens"
          />

          <!-- 并发设置 -->
          <ConcurrencySettings
            v-model="parallel"
            :max="100"
          />

          <!-- 频率限制 -->
          <RateLimitSettings
            v-model="timeLimit"
          />

          <!-- 代理设置 -->
          <ProxySettings />
        </div>
      </el-tab-pane>

      <!-- 提示词设置标签页 -->
      <el-tab-pane label="提示词设置" name="prompt">
        <div class="tab-content">
          <PromptDisplay :prompt="defaultPrompt" />
          <PromptEditor @update="handleUpdatePrompt" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApiSettings } from '@/composables/useApiSettings'
import { useApiStore } from '@/stores/apiStore'

// 组件导入
import ApiSelector from '@/components/ApiSettings/ApiSelector.vue'
import TokenStats from '@/components/ApiSettings/TokenStats.vue'
import ConcurrencySettings from '@/components/ApiSettings/ConcurrencySettings.vue'
import RateLimitSettings from '@/components/ApiSettings/RateLimitSettings.vue'
import ProxySettings from '@/components/ApiSettings/ProxySettings.vue'
import PromptDisplay from '@/components/PromptSettings/PromptDisplay.vue'
import PromptEditor from '@/components/PromptSettings/PromptEditor.vue'

// 状态
const activeTab = ref('api')
const selectedApiId = ref<number | null>(null)
const apiStore = useApiStore()

// 使用 composables
const {
  apiList,
  addApi,
  deleteApi,
  fetchAllApis,
  testApi,
  selectApi
} = useApiSettings()

// 计算属性
const totalTokens = computed(() => apiStore.totalTokens)
const parallel = computed({
  get: () => apiStore.selectedApi.parallel,
  set: (val) => apiStore.setParallel(val)
})
const timeLimit = computed({
  get: () => apiStore.selectedApi.timeLimit,
  set: (val) => apiStore.setTimeLimit(val)
})

// 事件处理
const handleAddApi = async (data: ApiSettingsFormData) => {
  await addApi(data)
}

const handleDeleteApi = async (id: number) => {
  await deleteApi(id)
}

const handleTestApi = async (api: ApiConfig) => {
  await testApi(api)
}

const handleSelectApi = async (api: ApiConfig) => {
  await selectApi(api)
  apiStore.setSelectedApi(api)
}

const handleResetTokens = () => {
  apiStore.setTotalTokens(0)
}

const handleUpdatePrompt = async (newPrompt: string) => {
  await window.electronAPI.setNewPrompt(newPrompt)
  defaultPrompt.value = newPrompt
}

// 初始化
onMounted(async () => {
  await fetchAllApis()
})
</script>

<style scoped lang="scss">
.api-settings-container {
  padding: 20px;
  min-height: 100vh;
}

.tab-content {
  padding: 30px;
  background-color: var(--el-bg-color);

  > * {
    margin-bottom: 24px;
  }
}
</style>
```

---

## 组件通信方式总结

### 1. **Props Down（父 → 子）**
```vue
<!-- 父组件 -->
<TokenStats :total-tokens="totalTokens" />

<!-- 子组件 -->
interface Props {
  totalTokens: number
}
```

### 2. **Events Up（子 → 父）**
```vue
<!-- 子组件 -->
emit('reset', data)

<!-- 父组件 -->
<TokenStats @reset="handleReset" />
```

### 3. **v-model（双向绑定）**
```vue
<!-- 子组件 -->
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

<!-- 父组件 -->
<ApiSelector v-model="selectedApiId" />
```

### 4. **Store（跨组件共享）**
```typescript
// 任何组件都可以访问
import { useApiStore } from '@/stores/apiStore'
const apiStore = useApiStore()
```

---

## 重构前后对比

### 重构前：
- ❌ 1018行代码在单个文件
- ❌ 业务逻辑和UI混合
- ❌ 难以复用
- ❌ 难以测试
- ❌ 难以维护

### 重构后：
- ✅ 主页面 ~150行
- ✅ 组件平均 50-150行
- ✅ 逻辑清晰分层
- ✅ 组件可复用
- ✅ 易于单元测试
- ✅ 易于维护和扩展
