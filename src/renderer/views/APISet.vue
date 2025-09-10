<template>
    <p> select or add your api infomation</p>
    <el-form :model="form" label-width="auto" style="max-width: 600px">
        <el-form-item label="select your api">
            <el-select v-model="form.name" placeholder="please select your zone">
                <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName" :value="item.id"
                    id="api-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <!-- justify-content: space-between 实现两端对齐-->
                        <span>{{ item.modelName }}</span>
                        <el-button type="danger" :icon="Delete" size="small" circle
                            @click="deleteItem(item.modelName)" />
                    </div>
                </el-option>
            </el-select>
        </el-form-item>
        <el-button type="primary" @click="dialogVisible = true">
            add new api
        </el-button>


        <el-dialog v-model="dialogVisible" title="add new api" width="400px">
            <el-form-item label="API URL:">
                <el-input v-model="form.URL" />
            </el-form-item>
            <el-form-item label="API KEY:">
                <el-input v-model="form.key" />
            </el-form-item>
            <el-form-item label="model name:">
                <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="onSubmit">保存</el-button>
                <el-button @click="resetForm()">重置</el-button>
                <el-button>测试连通性</el-button>
                <el-button @click="dialogVisible = false">取消</el-button>
            </el-form-item>
        </el-dialog>

    </el-form>


</template>

<script setup lang='ts'>
import {
    Check,
    Delete,
    Edit,
    Message,
    Search,
    Star,
} from '@element-plus/icons-vue'
import { reactive, ref } from 'vue'
const dialogVisible = ref(false)
const electronAPI = window.electronAPI
// do not use same name with ref
const form = reactive({
    id: 0,
    URL: '',
    key: '',
    name: ''
})

const newForm = reactive({
    URL: '',
    key: '',
    name: ''
})

// 定义一个由form对象组成的响应式数组
const apiSettings = reactive([
    { id: 1, URL: 'abc', Key: 'abc', modelName: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { id: 2, URL: 'abc', Key: 'abc', modelName: 'test2' },
    { id: 3, URL: 'abc', Key: 'abc', modelName: 'test3' }

])

const getAPISettings = async () => {
    const apiSettings = await electronAPI.getAPISettings()
    console.log('res', apiSettings)
    if (apiSettings) {
        newForm.URL = apiSettings.URL
        newForm.key = apiSettings.Key
        newForm.name = apiSettings.modelName
    }
}

const onSubmit = async () => {
    console.log('form', form)
    const res = await electronAPI.APISettings(form.URL, form.key, form.name)
    console.log('res', res)
    if (res === 'success') {
        getAPISettings()
        alert('api 设置成功')
    } else {
        alert('api 设置失败')
    }
}

const resetForm = () => {
    form.URL = ''
    form.key = ''
    form.name = 'deepseek-v3.1-chat'
}

const deleteItem = (name: string) => {
    console.log('will delete the key:', name)
}

</script>

<style></style>