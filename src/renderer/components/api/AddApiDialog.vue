<template>
    <el-dialog :model-value="visible" @update:model-value="handleDialogVisibilityChange" :title="dialogTitle"
        width="500px" class="api-dialog">
        <template #header>
            <div class="dialog-header">
                <el-icon>
                    <component :is="headerIcon" />
                </el-icon>
                <span>{{ dialogTitle }}</span>
            </div>
        </template>
        <el-form :model="formData" label-position="top" class="dialog-form">
            <el-form-item label="API URL" class="form-item">
                <div class="input-tip">
                    <el-icon class="tip-icon">
                        <InfoFilled />
                    </el-icon>
                    <span>格式示例：https://api.openai.com/v1 </span>
                </div>
                <el-input v-model="formData.URL" placeholder="请输入 API 地址" :prefix-icon="Link" />

            </el-form-item>
            <el-form-item label="API KEY" class="form-item">
                <el-input v-model="formData.key" type="password" show-password placeholder="请输入 API 密钥"
                    :prefix-icon="Lock" />
            </el-form-item>
            <el-form-item label="模型名称" class="form-item">
                <el-input v-model="formData.name" placeholder="请输入模型名称" :prefix-icon="Cpu" />
            </el-form-item>
        </el-form>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleReset">重置</el-button>
                <el-button @click="handleClose">取消</el-button>
                <el-button :loading="testing" @click="handleTest">测试连通性</el-button>
                <el-button type="primary" :loading="submitting" @click="handleSubmit">
                    {{ mode === 'edit' ? '保存修改' : '保存' }}
                </el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup lang='ts'>
import { computed, reactive, ref, watch } from 'vue'
import { Plus, Edit, Link, Lock, Cpu, InfoFilled } from '@element-plus/icons-vue'
import { useApiSettings, type ApiFormData } from '../../composables/useApiSettings'

const props = withDefaults(
    defineProps<{
        visible: boolean
        mode?: 'create' | 'edit'
        initialData?: ApiFormData | null
    }>(),
    {
        mode: 'create',
        initialData: null
    }
)

const emit = defineEmits<{
    'update:visible': [value: boolean]
    'submit': [data: ApiFormData]
}>()

const { testApiConnection } = useApiSettings()

const formData = reactive<ApiFormData>({
    id: undefined,
    URL: '',
    key: '',
    name: ''
})

const testing = ref(false)
const submitting = ref(false)

const dialogTitle = computed(() => props.mode === 'edit' ? '编辑 API' : '添加新 API')
const headerIcon = computed(() => props.mode === 'edit' ? Edit : Plus)

const resetForm = () => {
    formData.id = undefined
    formData.URL = ''
    formData.key = ''
    formData.name = ''
}

const syncFormData = () => {
    if (!props.visible) {
        return
    }

    if (props.mode === 'edit' && props.initialData) {
        formData.id = props.initialData.id
        formData.URL = props.initialData.URL || ''
        formData.key = props.initialData.key || ''
        formData.name = props.initialData.name || ''
        return
    }

    resetForm()
}

watch(
    () => [props.visible, props.mode, props.initialData] as const,
    () => {
        syncFormData()
    },
    { immediate: true, deep: true }
)

const handleDialogVisibilityChange = (value: boolean) => {
    if (!value) {
        resetForm()
    }
    emit('update:visible', value)
}

const handleClose = () => {
    handleDialogVisibilityChange(false)
}

const handleSubmit = async () => {
    submitting.value = true
    try {
        emit('submit', {
            id: formData.id,
            URL: formData.URL,
            key: formData.key,
            name: formData.name
        })
    } finally {
        submitting.value = false
    }
}

const handleReset = () => {
    if (props.mode === 'edit' && props.initialData) {
        formData.id = props.initialData.id
        formData.URL = props.initialData.URL || ''
        formData.key = props.initialData.key || ''
        formData.name = props.initialData.name || ''
        return
    }

    resetForm()
}

const handleTest = async () => {
    testing.value = true
    try {
        await testApiConnection({
            url: formData.URL,
            key: formData.key,
            modelName: formData.name
        })
    } finally {
        testing.value = false
    }
}
</script>

<style scoped>
.api-dialog {
    border-radius: 12px;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 18px;
}

.dialog-form {
    padding: 20px 0;
}

.form-item {
    margin-bottom: 20px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
}
</style>
