<template>
    <div class="common-layout">
        <el-container>
            <el-aside width="260px" class="sidebar">
                <el-card class="repository-card" shadow="hover">
                    <template #header>
                        <div class="card-header">
                            <span class="header-title">
                                <el-icon>
                                    <Collection />
                                </el-icon>
                                知识库列表
                            </span>
                        </div>
                    </template>

                    <div class="repository-list">
                        <el-menu :default-active="activeIndex" class="el-menu-vertical" @select="handleSelect"
                            active-text-color="#409eff" :unique-opened="true">
                            <el-menu-item v-for="item in repositoryList" :key="item" :index="item"
                                class="repository-item">
                                <div class="menu-item-content">
                                    <span class="repository-name">{{ item }}</span>
                                    <el-button type="danger" size="small" :icon="Delete" circle
                                        @click.stop="deleteSelectRepository(item)" class="delete-btn" />
                                </div>
                            </el-menu-item>
                        </el-menu>

                        <div v-if="repositoryList.length === 0" class="empty-state">
                            <el-empty description="暂无知识库" :image-size="80" />
                        </div>
                    </div>

                    <el-button type="primary" class="add-repo-btn" @click="dialogFormVisible = true">
                        <el-icon>
                            <FolderAdd />
                        </el-icon>
                        添加知识库
                    </el-button>
                </el-card>
            </el-aside>

            <el-container class="main-container">
                <el-header class="header">
                    <div class="header-content">
                        <div class="api-selector">
                            <el-form-item label="选择Embedding模型">
                                <el-select v-model="selectform.id" placeholder="请选择您的API模型" class="api-select"
                                    @change="handleApiChange">
                                    <el-option v-for="item in apiSettings" :key="item.id" :label="item.modelName"
                                        :value="item.id">
                                        <div class="api-option">
                                            <span class="api-name">{{ item.modelName }}</span>

                                        </div>
                                    </el-option>
                                </el-select>
                            </el-form-item>
                        </div>
                    </div>
                </el-header>

                <el-main class="main-content">
                    <div class="welcome-panel" v-if="!activeIndex">
                        <el-card shadow="never">
                            <div class="welcome-content">
                                <el-icon size="64" color="#409eff">
                                    <Collection />
                                </el-icon>
                                <h2>欢迎使用知识库管理系统</h2>
                                <p>请选择或创建一个知识库开始使用</p>
                            </div>
                        </el-card>
                    </div>

                    <div v-else class="repository-detail">
                        <el-card shadow="never">
                            <template #header>
                                <div class="detail-header">
                                    <span>当前知识库：{{ activeIndex }}</span>

                                    <div class="action-buttons">
                                        <el-button type="success" :icon="FolderAdd" @click="addFile">
                                            添加文件
                                        </el-button>
                                    </div>

                                </div>
                            </template>
                            <div class="detail-content">
                                <el-table :data="fileList" style="width: 100%">
                                    <el-table-column label="文件名">
                                        <template #default="{ row }">{{ row }}</template>
                                    </el-table-column>
                                    <el-table-column label="操作">
                                        <template #default="{ row }">
                                            <el-button type="danger" size="small"
                                                @click.stop="deleteFile(row)">删除</el-button>
                                        </template>
                                    </el-table-column>
                                </el-table>
                            </div>
                        </el-card>
                    </div>
                </el-main>
            </el-container>
        </el-container>
    </div>

    <el-dialog v-model="dialogFormVisible" title="添加知识库" width="500" :close-on-click-modal="false">
        <el-form :model="form" label-width="120px">
            <el-form-item label="知识库名称" required>
                <el-input v-model="form.repositoryName" placeholder="请输入知识库名称" clearable />
            </el-form-item>
        </el-form>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取消</el-button>
                <el-button type="primary" @click="addRepositoryWindow" :loading="submitting">
                    确认
                </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang='ts'>
import { HomeFilled, Monitor, InfoFilled, Setting, Clock, Collection, FolderAdd, Edit, Delete } from '@element-plus/icons-vue'
import { ref, reactive, onMounted, watch } from 'vue'
import { useEmbeddingStore } from "../stores/embeddingStore"
import { ElMessage, ElMessageBox } from 'element-plus'

// 变量设置
const fileStore = useEmbeddingStore()
const activeIndex = ref('')
const repositoryList = ref<string[]>([])
const electronAPI = window.electronAPI
const dialogFormVisible = ref(false)
const submitting = ref(false)

const form = reactive({
    repositoryName: '',
    modelName: '',
    apiKey: '',
    apiURL: ''
})

const apiSettings = reactive<any[]>([])
const selectform = ref({
    id: null as number | null,
    URL: '',
    key: '',
    name: '',
    time: ''
})

// 处理菜单选择
const handleSelect = (index: string) => {
    activeIndex.value = index
    console.log("Selected repository:", index)
}

// 处理API选择变化
const handleApiChange = (newId: number | null) => {
    if (newId === null) {
        selectform.value.URL = ''
        selectform.value.key = ''
        selectform.value.name = ''
        return
    }

    const selectedItem = apiSettings.find(item => item.id === newId)
    if (selectedItem) {
        selectform.value.URL = selectedItem.apiURL || ''
        selectform.value.key = selectedItem.apiKey || ''
        selectform.value.name = selectedItem.modelName || ''

        // 同步更新form对象
        form.apiURL = selectedItem.apiURL || ''
        form.apiKey = selectedItem.apiKey || ''
        form.modelName = selectedItem.modelName || ''

        // 更新Pinia store中的embedding配置
        fileStore.setConfig({
            apiURL: selectform.value.URL,
            apiKey: selectform.value.key,
            modelName: selectform.value.name
        })
    }
}

// 删除API设置
const deleteItem = async (id: number) => {
    try {
        await ElMessageBox.confirm('确定要删除这个API设置吗？', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
        })

        const res = await electronAPI.deleteOneAPI(id)
        if (res) {
            await getALLAPISettings()
            ElMessage.success("删除成功")

            // 如果删除的是当前选中的API，清空选择
            if (selectform.value.id === id) {
                selectform.value.id = null
                selectform.value.URL = ''
                selectform.value.key = ''
                selectform.value.name = ''
                form.apiURL = ''
                form.apiKey = ''
                form.modelName = ''
            }
        } else {
            ElMessage.error("删除失败")
        }
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error("删除失败")
        }
    }
}

// 获取所有API设置
const getALLAPISettings = async () => {
    try {
        const res = await electronAPI.getALLAPISettings()
        apiSettings.splice(0, apiSettings.length)
        if (Array.isArray(res)) {
            apiSettings.push(...res)
        }
    } catch (error) {
        console.error('获取API设置失败:', error)
    }
}

// 初始化API选择 - 从Pinia store获取当前配置
const initSelect = async () => {
    try {
        // 从embedding store获取当前配置
        const config = fileStore.getAPIConfig

        if (config.apiURL && config.apiKey && config.modelName) {
            selectform.value.URL = config.apiURL
            selectform.value.key = config.apiKey
            selectform.value.name = config.modelName

            form.apiKey = config.apiKey
            form.apiURL = config.apiURL
            form.modelName = config.modelName

            // 找到对应的ID并设置
            const matchedApi = apiSettings.find(item =>
                item.modelName === config.modelName &&
                item.apiURL === config.apiURL
            )
            if (matchedApi) {
                selectform.value.id = matchedApi.id
            }
        }
    } catch (error) {
        console.error('初始化API选择失败:', error)
    }
}

// 获取知识库列表
const getRepositories = async () => {
    try {
        // 获取全部的知识库列表
        const result = await electronAPI.listRepositories()
        if (Array.isArray(result)) {
            repositoryList.value = [...result]
        }
        return result
    } catch (error) {
        console.error("获取知识库列表失败:", error)
        return []
    }
}

// 添加知识库
const addOneRepository = async (repositoryName_: string, modelName_: string, apiKey_: string, apiURL_: string) => {
    try {
        await electronAPI.createRepository({
            repositoryName: repositoryName_,
            modelName: modelName_,
            apiKey: apiKey_,
            apiURL: apiURL_
        })
        // 无论创建结果如何，都尝试刷新列表
        const newRList = await getRepositories()
        console.log("the new repository list : ", newRList)
    } catch (error) {
        console.error("创建知识库失败:", error)
        throw error
    }
}

// 添加知识库窗口
const addRepositoryWindow = async () => {
    if (!fileStore.isConfigured) {
        ElMessage.error("请先选择一个Embedding API模型用于初始化知识库向量")
        return
    }

    const config = fileStore.getAPIConfig

    if (!form.repositoryName.trim()) {
        ElMessage.error("请输入知识库名称")
        return
    }

    submitting.value = true
    try {
        await addOneRepository(
            form.repositoryName,
            config.modelName,
            config.apiKey,
            config.apiURL
        )

        dialogFormVisible.value = false
        form.repositoryName = ''
        ElMessage.success("知识库创建成功")
    } catch (error) {
        ElMessage.error("创建知识库失败")
    } finally {
        submitting.value = false
    }
}

// 删除知识库
const deleteSelectRepository = async (repositoryName: string) => {
    try {
        await ElMessageBox.confirm(`确定要删除知识库 "${repositoryName}" 吗？`, '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
        })

        await electronAPI.deleteRepository(repositoryName)
        await initRepositories()

        if (activeIndex.value === repositoryName) {
            activeIndex.value = ''
        }

        ElMessage.success("删除成功")
        getRepositories()
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error("删除失败")
        }
    }
}

// 初始化知识库列表
const initRepositories = async () => {
    await getRepositories()
}

const fileList = ref<string[]>([])

const loadFileList = async () => {
    if (!activeIndex.value) return
    try {
        const files = await electronAPI.listFilenamesInRepository(activeIndex.value)
        fileList.value = files
    } catch (error) {
        console.error('加载文件列表失败:', error)
        fileList.value = []
    }
}

const addFile = async () => {
    if (!activeIndex.value) {
        ElMessage.warning('请先选择一个知识库')
        return
    }
    try {
        const modelConfig = fileStore.getAPIConfig
        const newConfig = {
            apiURL: modelConfig.apiURL,
            apiKey: modelConfig.apiKey,
            modelName: modelConfig.modelName
        }
        await electronAPI.selectAndProcessPDF(activeIndex.value, newConfig)
        await loadFileList()
        ElMessage.success('文件添加成功')
    } catch (error) {
        ElMessage.error('添加文件失败')
        console.error(error)
    }
}

const deleteFile = async (filename: string) => {
    try {
        await ElMessageBox.confirm(`确定要删除文件 "${filename}" 吗？`, '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
        await electronAPI.deleteDocumentByName(activeIndex.value, filename)
        await loadFileList()
        ElMessage.success('删除成功')
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error('删除失败')
        }
    }
}

// 监听activeIndex变化，加载文件列表
watch(activeIndex, async (newVal) => {
    if (newVal) {
        await loadFileList()
    }
}, { immediate: true })

onMounted(async () => {
    await Promise.all([
        initRepositories(),
        getALLAPISettings()
    ])
    await initSelect()
})
</script>

<style scoped>
.common-layout {
    height: 100vh;

}

.sidebar {
    background: transparent;
    padding: 20px;
}

.repository-card {
    height: calc(100vh - 40px);
    border-radius: 12px;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
}

.repository-list {
    max-height: calc(100vh - 280px);
    overflow-y: auto;
    margin-bottom: 16px;
}

.el-menu-vertical {
    border: none;
}

.menu-item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-shadow: 2px 2px 5px rgb(212, 211, 211);
    margin-bottom: 10px;
    padding-left: 20px;
    padding-right: 20px;
    border-radius: 5px;
}

.repository-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

}

.delete-btn {
    opacity: 0;
    transition: opacity 0.3s;
}

.el-menu-item:hover .delete-btn {
    opacity: 1;
}


.empty-state {
    padding: 20px;
    text-align: center;
}

.add-repo-btn {
    width: 100%;
    border-radius: 8px;
    font-weight: 500;
}

.main-container {
    padding: 20px;
}

.header {
    border-radius: 12px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    padding: 0 24px;
    height: 64px !important;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
}

.api-selector .el-form-item {
    margin-bottom: 0;
}

.api-select {
    width: 280px;
}

.api-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding-right: 8px;
}

.api-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.delete-api-btn {
    opacity: 0;
    transition: opacity 0.3s;
}

.el-select:hover .delete-api-btn {
    opacity: 1;
}

.action-buttons {
    display: flex;
    gap: 12px;
}

.main-content {
    padding: 20px;
    background: transparent;
}

.welcome-panel,
.repository-detail {
    height: 100%;
}

.welcome-content {
    text-align: center;
    padding: 60px 20px;

}

.welcome-content h2 {
    margin: 20px 0 12px;
    color: #303133;
    font-size: 24px;

}

.welcome-content p {
    color: #909399;
    font-size: 14px;
}

.detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.detail-content {
    padding: 20px;
    min-height: 300px;
}

.dialog-footer {
    text-align: right;
}

/* 滚动条样式 */
.repository-list::-webkit-scrollbar {
    width: 6px;
}

.repository-list::-webkit-scrollbar-track {
    border-radius: 3px;
}

.repository-list::-webkit-scrollbar-thumb {
    border-radius: 3px;
}

.repository-list::-webkit-scrollbar-thumb:hover {
    background: #909399;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .sidebar {
        width: 200px !important;
    }

    .api-select {
        width: 200px;
    }

    .header-content {
        flex-direction: column;
        gap: 12px;
        padding: 12px 0;
    }
}
</style>
