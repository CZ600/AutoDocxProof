<template>
    <el-alert v-if="showAlertSuccess" type="success" auto-close="4000" show-icon>
        {{ AlertTitle }}
    </el-alert>
    <el-alert v-if="showAlertError" type="error" auto-close="4000" show-icon>
        {{ AlertTitle }}
    </el-alert>
    <p> select or add your api infomation</p>
    <el-form :model="selectform" label-width="auto" style="max-width: 600px">
        <el-form-item label="select your api">
            <el-select v-model="selectform.id" placeholder="please select your api">
                <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName" :value="item.id"
                    id="api-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <!-- justify-content: space-between 实现两端对齐-->
                        <span>{{ item.modelName }}</span>
                        <el-button type="danger" :icon="Delete" size="small" circle @click.stop="deleteItem(item.id)" />
                    </div>
                </el-option>
            </el-select>
        </el-form-item>
        <el-button type="primary" @click="dialogVisible = true">
            add new api
        </el-button>
        <el-button @click="testAPI()">测试连通性</el-button>


        <el-dialog v-model="dialogVisible" title="add new api" width="400px">
            <el-form-item label="API URL:">
                <el-input v-model="newForm.URL" />
            </el-form-item>
            <el-form-item label="API KEY:">
                <el-input v-model="newForm.key" />
            </el-form-item>
            <el-form-item label="model name:">
                <el-input v-model="newForm.name" />
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="onSubmit">保存</el-button>
                <el-button @click="resetForm()">重置</el-button>

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
import { on } from 'events'
import { get } from 'http'
import { reactive, ref, onMounted, watch } from 'vue'
const dialogVisible = ref(false)
const electronAPI = window.electronAPI
const showAlertSuccess = ref(false)
const showAlertError = ref(false)
const AlertTitle = ref('Success alert')
// do not use same name with ref
const selectform = ref(
    {
        id: null as number | null,
        URL: '',
        key: '',
        name: '',
        time: ''
    }
)

const newForm = reactive({
    URL: '',
    key: '',
    name: ''
})

// 定义一个由form对象组成的响应式数组
const apiSettings = reactive([])


const onSubmit = async () => {
    console.log('newform:', newForm)
    const res = await electronAPI.APISettings(newForm.URL, newForm.key, newForm.name)  // add a new api setting
    console.log('res', res)
    if (res === 'success') {
        getALLAPISettings()
        alert('api 设置成功')
    } else {
        alert('api 设置失败')
    }
}

const resetForm = () => {
    newForm.URL = ''
    newForm.key = ''
    newForm.name = ''
}

const deleteItem = async (id: number) => {
    console.log('will delete the key:', id)
    const res = await electronAPI.deleteOneAPI(id)
    if (res) {
        showAlertSuccess.value = true
        getALLAPISettings()
        AlertTitle.value = '删除成功'
    } else {
        showAlertError.value = true
        AlertTitle.value = '删除失败'
    }
}


const getALLAPISettings = async () => {
    const res = await electronAPI.getALLAPISettings()
    console.log('res', res)
    apiSettings.splice(0, apiSettings.length)  // 清空数组
    res.forEach((item: any) => {
        apiSettings.push(item)
    })
}

const testAPI = async () => {
    const url = selectform.value.URL
    const key = selectform.value.key
    const modelName = selectform.value.name
    console.log("will test API:", url, key, modelName)

    try {
        const res = await electronAPI.testAPI(url, key, modelName)
        if (res) {
            alert('测试成功')
        }

    } catch (err) {
        alert('测试失败')
    }

}


function initForm() {
    getALLAPISettings()
}
// 监听变化，更新selectform的值
watch(
    () => selectform.value.id,
    (newId) => {
        console.log('选中的 API ID:', newId)
        if (newId === null) {
            // 清空表单
            selectform.value.URL = ''
            selectform.value.key = ''
            selectform.value.name = ''
            return
        }

        // 根据 id 查找对应的 API 设置
        const selectedItem = apiSettings.find(item => item.id === newId)
        if (selectedItem) {
            selectform.value.URL = selectedItem.apiURL || ''
            selectform.value.key = selectedItem.apiKey || ''
            selectform.value.name = selectedItem.modelName || '' // 注意：你存储的是 modelName，不是 name
        }
        const res = electronAPI.selectAPISetting(selectform.value.URL, selectform.value.key, selectform.value.name)
        if (res) {
            console.log('已经更新api设置的选择');
        } else {
            console.log('更新api设置的选择失败');
        }
    }
)

const initSelect = async () => {
    const res = await electronAPI.getAPISettings()
    if (res) {
        selectform.value.URL = res.URL
        selectform.value.key = res.Key
        selectform.value.name = res.modelName
        console.log('已经初始化了api设置的选择');
        console.log(res);
    }
    else {
        console.log('初始化api设置的选择失败');
    }
}
// 挂载时执行
onMounted(() => {
    initForm()
    initSelect()
})

</script>

<style></style>