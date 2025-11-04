<template>
    <el-container direction="vertical" class="app-container">
        <!-- 操作区域 -->
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-alert" />
        <el-header class="action-bar">
            <div class="header-content">
                <div class="file-info-container">
                    <p v-if="fileName" class="file-info">
                        当前文件: {{ fileName }}
                    </p>
                    <p class="file-info" v-if="selectRepository.length > 0" style="margin-left:30px"> 已经选择的知识库：</p>
                    <div class="flex gap-2" v-if="selectRepository.length > 0">
                        <el-tag type="success" v-for="item in selectRepository" :key="item" :index="item" closable
                            :disable-transitions="false" @close="deleteSelectRepository(item)">{{ item
                            }}</el-tag>
                        <el-button type="danger" size="small" @click="deleteAllSelectRepository"
                            v-if="selectRepository.length > 0" style="margin-left:5px">
                            清空
                        </el-button>

                    </div>
                </div>
                <div class="button-group">
                    <el-button type="primary" :loading="isLoading" @click="selectFileWithMainProcessRead" size="large"
                        class="action-button">
                        {{ isLoading ? '正在加载...' : '选择 DOCX 文件' }}
                    </el-button>

                    <el-select v-model="form.model" placeholder="选择纠错模式" size="large" class="mode-select">
                        <el-option label="逐句精校（适合高精度）" value="wordError" />
                        <el-option label="逐段校正（适合长文献）" value="ComprehensiveError" />
                        <el-option label="全文润色（适合简文章）" value="polish" />
                    </el-select>
                    <el-dropdown placement="bottom">
                        <el-button color="#626aef" :dark="isDark" class="dictionary-button">
                            <el-icon>
                                <Collection />
                            </el-icon>
                        </el-button>
                        <template #dropdown>
                            <el-text class="mx-1"
                                style="display: flex; justify-content: center; align-items: center; padding-top: 10px ; padding-bottom: 0px;">选择知识库</el-text>
                            <el-dropdown-menu>
                                <el-dropdown-item v-for="value in repositoryList" :key="value" :index="value"
                                    @click="addRepository(value)">
                                    {{ value }}
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>

                    <el-button type="primary" size="large" @click="onSubmit" :disabled="!form.filePath || processing"
                        :loading="processing" class="action-button">
                        {{ processing ? '正在校对...' : '开始校正' }}
                    </el-button>

                    <el-button type="success" size="large" @click="exportToDocx"
                        :disabled="proofreadingResults.length === 0" :loading="exporting" class="action-button">
                        导出结果
                    </el-button>
                </div>
            </div>
        </el-header>

        <!-- 主内容区域 - 拆分为预览区和校对结果区 -->
        <el-container class="main-content">
            <!-- 文档预览区域 -->
            <el-main class="preview-area">
                <div ref="previewContainer" class="preview-container">
                    <el-empty v-if="!fileName" description="选择一个 DOCX 文件进行预览" :image-size="80" />
                </div>
            </el-main>

            <!-- 校对结果侧栏 -->
            <el-aside class="proofreading-sidebar">
                <div class="sidebar-header">
                    <el-button type="primary" @click="applyALLCorrection()" :disabled="proofreadingResults.length === 0"
                        class="apply-all-button">
                        应用全部修改
                    </el-button>
                </div>

                <div class="results-container" v-if="proofreadingResults.length > 0">
                    <el-collapse v-model="activeNames">
                        <el-collapse-item v-for="(item, index) in proofreadingResults" :key="index" :name="index"
                            :class="`correction-item type-${item.type.toLowerCase()}`">
                            <template #title>
                                <div class="correction-header">
                                    <span class="correction-type" :class="`type-${item.type.toLowerCase()}`">
                                        {{ formatCorrectionType(item.type) }}
                                    </span>
                                    <span class="correction-count">{{ index + 1 }}/{{ proofreadingResults.length
                                        }}</span>
                                </div>
                            </template>

                            <div class="correction-content">
                                <div class="original">
                                    <strong>原文:</strong> {{ item.original }}
                                </div>
                                <div class="suggested">
                                    <strong>建议:</strong> {{ item.suggested }}
                                </div>
                                <div class="reason">
                                    <strong>原因:</strong> {{ item.reason }}
                                </div>
                                <div class="actions">
                                    <el-button type="primary" size="small" @click="applyCorrection(index)"
                                        :disabled="item.applied">
                                        {{ item.applied ? '已应用' : '应用修改' }}
                                    </el-button>
                                    <el-popover placement="bottom-start" width="500px" trigger="click"
                                        popper-class="reference-popover">
                                        <template #reference>
                                            <el-button type="primary" size="small" style="margin-left: 8px;">
                                                查看参考
                                            </el-button>
                                        </template>

                                        <div class="reference-content">
                                            <h4>参考内容：</h4>
                                            <div class="reference-list">
                                                <div v-for="(reference, refIndex) in item.References" :key="refIndex"
                                                    class="reference-item">
                                                    <span class="reference-index">{{ refIndex + 1 }}.</span>
                                                    <span class="reference-text">{{ reference }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </el-popover>

                                </div>
                            </div>
                        </el-collapse-item>
                    </el-collapse>
                </div>

                <div v-else class="no-results">
                    <el-empty :description="fileName ? '暂无校对结果' : '请选择文档进行校对'" :image-size="60" />
                </div>
            </el-aside>
        </el-container>
    </el-container>
</template>


<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import {
    ElContainer,
    ElHeader,
    ElMain,
    ElAside,
    ElButton,
    ElAlert,
    ElEmpty,
    ElRow,
    ElCol,
    ElSelect,
    ElOption,
    ElCollapse,
    ElCollapseItem,
    ElFormItem,
    ElMessage,
    ElMessageBox
} from 'element-plus'
import { renderAsync } from 'docx-preview'
import { fileInfoStore } from "../stores/store"
import { useEmbeddingStore } from "../stores/embeddingStore"
import { files } from 'jszip'
import { HomeFilled, Monitor, InfoFilled, Setting, Clock, Collection } from '@element-plus/icons-vue'
// 从 Electron 获取 API
const electronAPI = window.electronAPI
// 状态变量
const previewContainer = ref(null)
// const fileName = ref('')
const isLoading = ref(false)
const error = ref('')
const processing = ref(false)
const exporting = ref(false) // 新增导出状态
// const proofreadingResults = ref([]) // 存储校对结果
const activeNames = ref([]) // 折叠面板展开项
const isDark = ref(false) // 添加缺失的 isDark 属性
// 从Pinia store中获取数据
const fileStore = fileInfoStore()
const embeddingStore = useEmbeddingStore()
// 选择使用计算属性computed双向绑定store，避免手动watch同步
const fileName = computed(() => fileStore.fileName)

const form = ref({
    model: fileStore.proofModel,
    filePath: fileStore.filePath,
})
const proofreadingResults = computed({
    get: () => fileStore.results,
    set: (val) => fileStore.setCorrectResult(val)
})
// rag 多选器 设置选项
const props = {
    multiple: true
}
// 知识库列表名称
const repositoryList = ref([])
// the selected repositorylist
const selectRepository = ref([])

// 格式化校对类型显示
const formatCorrectionType = (type) => {
    const typeMap = {
        'Typo': '错别字',
        'Punctuation': '标点',
        'Grammar': '语法',
        'Consistency': '一致性',
        'wordError': '错别字',
        'ComprehensiveError': '综合错误',
        'polish': '润色建议'
    }
    return typeMap[type] || type
}

// 监听表单变化，自动保存到 store
watch(
    () => form.model,
    (newVal) => {
        if (newVal) fileStore.setProofModel(newVal)
    }
)

watch(
    () => form.filePath,
    (newVal) => {
        if (newVal) fileStore.setFilePath(newVal)
    }
)

watch(proofreadingResults, (newProof, oldProof) => {
    console.log("the result of the proof:", newProof)
})
// 获取后端的所有的repositoryName
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

function unique(arr) {
    return Array.from(new Set(arr));
}
const addRepository = async (item) => {
    selectRepository.value.push(item)
    selectRepository.value = unique(selectRepository.value)  //  去重
    console.log("new select repository:", selectRepository.value)
}
const deleteSelectRepository = async (value) => {
    selectRepository.value = selectRepository.value.filter(function (item) {
        return item !== value
    })
}
const deleteAllSelectRepository = async (value) => {
    selectRepository.value = []
}

const initRepository = async () => {
    await getRepositories()
}


const pushToDB = async (resultCorrect) => {
    try {
        const filePath = form.value.filePath
        const modelInfo = await electronAPI.getAPISettings()
        const URL = modelInfo.URL
        const modelName = modelInfo.modelName

        // 检查必要参数
        if (!filePath) {
            console.warn('文件路径为空，无法保存历史记录')
            return
        }

        if (!URL || !modelName) {
            console.error('API设置不完整，无法保存历史记录')
            return
        }

        // 检查结果数据
        if (!resultCorrect || (Array.isArray(resultCorrect) && resultCorrect.length === 0)) {
            console.warn('校对结果为空，无需保存历史记录')
            return
        }

        try {
            // 调用主进程方法保存历史记录
            const result = await electronAPI.insertOneHistory(
                filePath,
                URL,
                modelName,
                JSON.stringify(resultCorrect)
            )

            // 检查返回结果
            if (result && result.success === false) {
                console.error('保存历史记录失败:', result.error)
                ElMessage({
                    message: '保存历史记录失败: ' + (result.error || '未知错误'),
                    type: 'error',
                    duration: 3000
                })
                return
            }

            console.log('历史记录保存成功:', result)
            ElMessage({
                message: '历史记录保存成功',
                type: 'success',
                duration: 1500
            })
        } catch (ipcError) {
            // IPC调用异常处理
            console.error('IPC调用失败:', ipcError)
            ElMessage({
                message: '与主进程通信失败，无法保存历史记录',
                type: 'error',
                duration: 3000
            })
            return
        }

        getALLHistory().then(result => {
            console.log('获取历史记录:', result)
        }).catch(err => {
            console.error('获取历史记录失败:', err)
        })
    } catch (error) {
        // 外层异常处理
        console.error('保存历史记录时发生未预期错误:', error)
        ElMessage({
            message: '保存历史记录时发生错误: ' + error.message,
            type: 'error',
            duration: 3000
        })
    }
}

const getALLHistory = async () => {
    try {
        const result = await electronAPI.getAllHistory()
        return result
    } catch (error) {
        console.error('获取历史记录失败:', error)
        return []
    }
}



// 替换原有的 highlightCorrections 函数
const highlightCorrections = () => {
    const container = previewContainer.value;  // 获取预览容器
    if (!container || proofreadingResults.value.length === 0) return;

    // 清除所有现有高亮
    const existingHighlights = container.querySelectorAll('.highlight-correction');
    existingHighlights.forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    });

    // 创建空格不敏感的匹配函数
    const createWhitespaceInsensitiveMatcher = (searchText) => {
        // 转义正则特殊字符
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 将连续空白替换为 \s+ 匹配任意空白序列
        const pattern = escapedText.replace(/\s+/g, '\\s+');
        return new RegExp(pattern, 'g');
    };

    // 按文档顺序处理校对项（确保高亮顺序正确）
    const sortedResults = [...proofreadingResults.value].sort((a, b) =>
        (a.startIndex || 0) - (b.startIndex || 0)
    );

    // 处理每个校对项
    sortedResults.forEach(item => {
        const originalText = item.original.trim();
        if (!originalText) return;

        // 创建空格不敏感的正则表达式
        const regex = createWhitespaceInsensitiveMatcher(originalText);

        // 创建文档范围用于精确查找
        const range = document.createRange();
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        let found = false;

        while ((node = walker.nextNode()) && !found) {
            const text = node.textContent;

            // 重置正则状态
            regex.lastIndex = 0;
            const match = regex.exec(text);

            if (match) {
                const startIndex = match.index;
                const matchedLength = match[0].length;
                const endIndex = startIndex + matchedLength;

                // 创建高亮元素
                const highlightEl = document.createElement('span');
                highlightEl.className = 'highlight-correction';
                highlightEl.textContent = text.substring(startIndex, endIndex);
                highlightEl.dataset.correctionId = item.id || Math.random().toString(36).slice(2);

                // 创建文档片段
                const fragment = document.createDocumentFragment();

                // 处理前缀
                if (startIndex > 0) {
                    fragment.appendChild(document.createTextNode(text.substring(0, startIndex)));
                }

                // 添加高亮元素
                fragment.appendChild(highlightEl);

                // 处理后缀
                if (endIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(endIndex)));
                }

                // 替换原始节点
                node.parentNode.replaceChild(fragment, node);

                // 绑定点击事件
                highlightEl.addEventListener('click', () => {
                    const index = proofreadingResults.value.findIndex(r =>
                        r.original.trim() === originalText
                    );
                    if (index !== -1) {
                        activeNames.value = [index];
                        const resultEl = document.querySelector(`.correction-item[name="${index}"]`);
                        resultEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });

                found = true; // 只处理第一个匹配
            }
        }
    });
};

const createWhitespaceInsensitiveMatcher = (searchText) => {
    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escapedText.replace(/\s+/g, '\\s+');
    return new RegExp(pattern, 'g');
};


// 应用单个校对建议
const applyCorrection = (index) => {
    const newResults = [...proofreadingResults.value]
    newResults[index] = { ...newResults[index], applied: true }
    proofreadingResults.value = newResults // 触发 setter

    // 更新 DOM
    const container = previewContainer.value
    if (!container) return
    let content = container.innerHTML
    const regex = createWhitespaceInsensitiveMatcher(newResults[index].original.trim())
    content = content.replace(regex, newResults[index].suggested)
    container.innerHTML = content

    ElMessage.success('已应用修改')
}

// 应用所有校对建议
const applyALLCorrection = () => {
    const newResults = proofreadingResults.value.map(item => ({ ...item, applied: true }))
    proofreadingResults.value = newResults

    const container = previewContainer.value
    if (!container) return
    let content = container.innerHTML
    newResults.forEach(item => {
        const regex = createWhitespaceInsensitiveMatcher(item.original.trim())
        content = content.replace(regex, item.suggested)
    })
    container.innerHTML = content

    ElMessage.success('已应用全部修改')
}

// 提交校对请求
const onSubmit = async () => {
    if (!form.value.filePath) {
        error.value = '请先选择文档文件'
        return
    }

    if (!form.value.model) {
        error.value = '请选择校对模式'
        return
    }

    fileStore.setProofModel(form.model)

    try {
        processing.value = true;
        error.value = '';
        proofreadingResults.value = [];
        let results;
        if (selectRepository.value.length > 0) {
            // 确保传递的参数是可序列化的
            const params = {
                model: form.value.model,
                filePath: form.value.filePath,
                repositoryNameList: [...selectRepository.value]
            };
            // 从Pinia store获取embedding配置并传递给后端
            // 确保传递可序列化的纯对象
            const { apiURL, apiKey, modelName } = embeddingStore.getAPIConfig;
            console.log("embedding settings:", { apiURL, apiKey, modelName })
            results = await electronAPI.processDocx(params.model, params.filePath, params.repositoryNameList, { apiURL, apiKey, modelName });
        } else {
            const params = {
                model: form.value.model,
                filePath: form.value.filePath
            };
            results = await electronAPI.processDocx(params.model, params.filePath);
        }

        if (results.message === "Please select an API setting!") {
            ElMessage({
                message: '请先设置API密钥',
                type: 'error',
                duration: 1500
            });
            return;
        }

        // 确保结果是数组格式
        const finalResults = Array.isArray(results) ? results : [];
        proofreadingResults.value = finalResults.map((item, index) => ({
            ...item,
            id: `correction-${index}`,
            applied: false
        }));

        // 将结果保存到数据库
        if (finalResults.length > 0) {
            await pushToDB(finalResults);
        } else {
            console.log('无校对结果，跳过保存历史记录')
        }

        // 关键：等待DOM更新后再高亮
        await nextTick();
        highlightCorrections();

        if (finalResults.length > 0) {
            activeNames.value = [0];
        }
    } catch (err) {
        error.value = `校对处理失败: ${err.message}`
        console.error('校对处理异常:', err)
        ElMessage({
            message: '校对处理失败: ' + err.message,
            type: 'error',
            duration: 3000
        });
    } finally {
        processing.value = false;
    }
}


const renderDocx = async (file) => {
    try {
        // 清空之前的预览内容
        previewContainer.value.innerHTML = ''

        // 渲染 DOCX 文件
        await renderAsync(file, previewContainer.value)
    } catch (err) {
        error.value = `文档渲染失败: ${err.message}`
        console.error('DOCX 渲染错误:', err)
        throw err
    }
}

// 使用主进程读取文件内容的方法
const selectFileWithMainProcessRead = async () => {
    try {
        isLoading.value = true
        error.value = ''

        // 调用 Electron API 选择文件
        const filePath = await electronAPI.selectDocxFile()

        if (!filePath) {
            isLoading.value = false
            return
        }

        // 提取文件名
        const name = filePath.split('\\').pop().split('/').pop()
        fileStore.setFilePath(filePath)
        fileStore.setFileName(name)

        form.value.filePath = filePath
        fileName.value = name

        // 让主进程读取文件内容
        const fileData = await electronAPI.readDocxFile(filePath)

        // 将 base64 转换为 Blob
        const byteCharacters = atob(fileData.content)
        const byteArrays = []

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512)

            const byteNumbers = new Array(slice.length)
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i)
            }

            const byteArray = new Uint8Array(byteNumbers)
            byteArrays.push(byteArray)
        }

        const blob = new Blob(byteArrays, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        const file = new File([blob], fileName.value, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

        // 渲染文档
        await renderDocx(file)

        // 重置校对结果
        proofreadingResults.value = []
        activeNames.value = []

        isLoading.value = false
    } catch (err) {
        error.value = `文件处理失败: ${err.message}`
        console.error('文件处理错误:', err)
        isLoading.value = false
    }
}

// 导出修正后的 DOCX 文件
const exportToDocx = async () => {
    if (proofreadingResults.value.length === 0) return;

    try {
        exporting.value = true;

        // 获取当前预览内容（包含已应用的修改）
        const container = previewContainer.value;
        if (!container) throw new Error('预览内容为空');

        // 创建导出配置，只传递可序列化的数据
        const exportConfig = {
            originalFilePath: form.value.filePath,
            fileName: fileName.value,
            appliedCorrections: proofreadingResults.value
                .filter(item => item.applied)
                .map(item => ({
                    original: item.original,
                    suggested: item.suggested,
                    applied: item.applied
                }))
        };

        // 调用 Electron API 导出
        const success = await electronAPI.exportCorrectedDocx(exportConfig);
        console.log("success:", success)

        if (success) {
            ElMessage({
                message: '文件导出成功！',
                type: 'success',
                duration: 2000
            });
        } else {
            throw new Error('导出过程未完成');
        }
    } catch (err) {
        console.error('导出错误:', err);
        ElMessage({
            message: `导出失败: ${err.message}`,
            type: 'error',
            duration: 3000
        });
    } finally {
        exporting.value = false;
    }
}

const initCorrectStatus = async () => {
    if (!fileStore.isfilePathEmpty) {
        form.value.filePath = fileStore.getFilePath
    }
    if (!fileStore.isFileNameEmpty) {
        fileName.value = fileStore.getFileName
    }
    if (!fileStore.isProofModelEmpty) {
        form.value.model = fileStore.getProofModel
    }
}

// 组件挂载后检查 Electron API 是否可用
onMounted(async () => {
    if (!window.electronAPI) {
        error.value = 'Electron 环境未正确加载...'
        return
    }
    initRepository()

    // 如果 store 中有文件路径，尝试重新加载预览
    if (fileStore.filePath && fileStore.fileName) {
        try {
            isLoading.value = true
            const fileData = await electronAPI.readDocxFile(fileStore.filePath)
            const byteCharacters = atob(fileData.content)
            const byteArrays = []
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512)
                const byteNumbers = Array.from({ length: slice.length }, (_, i) => slice.charCodeAt(i))
                byteArrays.push(new Uint8Array(byteNumbers))
            }
            const blob = new Blob(byteArrays, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
            const file = new File([blob], fileStore.fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
            await renderDocx(file)

            // 恢复校对结果高亮
            if (proofreadingResults.value.length > 0) {
                await nextTick()
                highlightCorrections()
                activeNames.value = [0]
            }
        } catch (err) {
            console.error('恢复预览失败:', err)
            // 可选：清空 store
            fileStore.clearAll()
        } finally {
            isLoading.value = false
        }
    }
})
</script>

<style scoped>
.app-container {
    height: 100vh;
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.error-alert {
    margin: 15px;
    border-radius: 8px;
}

.action-bar {
    padding: 15px;
    height: auto !important;
    border-bottom: 1px solid #ebeef5;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.file-info-container {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
    padding: 10px 0;
    justify-content: center;
}

.file-info {
    margin: 0;
    color: #606266;
    font-size: 14px;
}

.button-group {
    display: flex;
    gap: 15px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    margin: 10px 0;
}

.action-button {
    min-width: 120px;
    border-radius: 8px;
}

.dictionary-button {
    height: 100%;
}

.mode-select {
    width: 220px;
    border-radius: 8px;
}

.main-content {
    flex: 1;
    overflow: hidden;
}

.preview-area {
    padding: 0;
    overflow: hidden;
    width: 70%;
}

.preview-container {
    height: 100%;
    overflow: auto;
    border: 1px solid #dcdfe6;
    border-radius: 0px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    padding: 20px;
    margin: 0px;
}

.proofreading-sidebar {
    width: 30%;
    border-left: 1px solid #ebeef5;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 15px;
    border-bottom: 1px solid #ebeef5;
}

.apply-all-button {
    width: 100%;
    border-radius: 8px;
}

.results-container {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
}

.correction-item {
    margin-bottom: 15px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #ebeef5;
}

.correction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
}

.correction-type {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
}

.correction-count {
    font-size: 12px;
    color: #909399;
}

.correction-content {
    padding: 15px;
    border-top: 1px solid #ebeef5;
}

.correction-content>div {
    margin-bottom: 12px;
    line-height: 1.6;
}

.correction-content strong {
    color: #606266;
    min-width: 50px;
    display: inline-block;
}

.actions {
    margin-top: 15px;
    text-align: right;
}

.no-results {
    padding: 20px;
    text-align: center;
    color: #909399;
}

/* 根据校对类型设置颜色 */
.type-typo,
.type-错别字,
.type-worderror {
    background-color: rgba(245, 108, 108, 0.15);
    color: #f56c6c;
}

.type-punctuation,
.type-标点 {
    background-color: rgba(230, 162, 60, 0.15);
    color: #e6a23c;
}

.type-grammar,
.type-语法 {
    background-color: rgba(64, 158, 255, 0.15);
    color: #409eff;
}

.type-consistency,
.type-一致性 {
    background-color: rgba(144, 147, 152, 0.15);
    color: #909399;
}

.type-comprehensiveerror,
.type-综合错误,
.type-polish,
.type-润色建议 {
    background-color: rgba(103, 194, 58, 0.15);
    color: #67c23a;
}

@media (max-width: 992px) {
    .button-group {
        flex-direction: column;
        align-items: stretch;
    }

    .mode-select,
    .action-button {
        width: 100%;
    }

    .preview-area,
    .proofreading-sidebar {
        width: 100%;
    }

    .main-content {
        flex-direction: column;
    }
}
</style>

<style>
/* 全局高亮样式 - 必须放在非scoped样式中 */
.highlight-correction {
    background-color: rgba(255, 223, 0, 0.6) !important;
    border-bottom: 2px dashed #ff9800 !important;
    cursor: pointer !important;
    padding: 0 2px !important;
    border-radius: 2px !important;
    transition: all 0.2s ease !important;
}

.highlight-correction:hover {
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.3) !important;
    background-color: rgba(255, 200, 0, 0.7) !important;
}
</style>

<style scoped>
/* 参考内容样式 */
.reference-content {
    padding: 8px 0;
}

.reference-content h4 {
    margin: 0 0 12px 0;
    color: #303133;
    font-size: 14px;
    font-weight: 600;
}

.reference-list {
    max-height: 300px;
    overflow-y: auto;
}

.reference-item {
    display: flex;
    align-items: flex-start;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #409eff;
    line-height: 1.5;
}

.reference-item:last-child {
    margin-bottom: 0;
}

.reference-index {
    color: #409eff;
    font-weight: 600;
    margin-right: 8px;
    min-width: 20px;
    flex-shrink: 0;
}

.reference-text {
    color: #606266;
    word-break: break-word;
    white-space: pre-wrap;
}

/* 滚动条样式 */
.reference-list::-webkit-scrollbar {
    width: 6px;
}

.reference-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.reference-list::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
}

.reference-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}
</style>

<style>
/* 全局弹窗样式 */
.reference-popover {
    max-width: 500px;
}

.reference-popover .el-popover__title {
    margin-bottom: 12px;
    color: #303133;
    font-weight: 600;
}
</style>