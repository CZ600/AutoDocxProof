<template>
    <p> 在本页面设置提示词 </p>
    <el-card id="defaultPrompt">
        <el-text>
            {{ defaultPrompt }}
        </el-text>
    </el-card>

    <el-input style="margin-bottom: 20px;" v-model="newPrompt" placeholder="请输入新的提示词" />

    <el-button @click="updatePrompt()" type="primary"> 修改提示词 </el-button>
    <el-button @click="backTodefault()" type="Default"> 恢复默认设置 </el-button>



</template>

<script setup lang='ts'>
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
const electronAPI = window.electronAPI
const theDefaultPrompt = ref('')
const defaultPrompt = ref('')
const newPrompt = ref('')

const updatePrompt = async () => {
    const result = await electronAPI.setNewPrompt(newPrompt.value)
    if (result) {
        defaultPrompt.value = newPrompt.value
    }
    ElMessage.success('修改成功')
    newPrompt.value = ''
}

const backTodefault = async () => {
    const result = await electronAPI.setNewPrompt(theDefaultPrompt.value)
    if (result) {
        defaultPrompt.value = theDefaultPrompt.value
        newPrompt.value = ''
        ElMessage.success('恢复为默认设置')
    }
}

const initPrompt = async () => {
    theDefaultPrompt.value = await electronAPI.getDefaultPrompt()
    defaultPrompt.value = await electronAPI.getDefaultPrompt()
}

onMounted(() => {
    initPrompt()
})
</script>

<style>
#defaultPrompt {
    margin-bottom: 20px;
}
</style>