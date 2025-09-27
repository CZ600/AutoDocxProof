<template>
    <el-container direction="vertical" class="app-container" style="height: 100vh;">
        <!-- 操作区域 -->
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 15px;" />
        <el-header class="action-bar" height="auto">
            <el-row justify="center" type="flex" align="middle">
                <p v-if="fileName" class="file-info" style="margin: 10px 0; color: #606266; font-size: 14px; ">
                    当前文件: {{ fileName }}
                </p>
                <el-col :span="4">
                    <el-button type="primary" :loading="isLoading" @click="selectFileWithMainProcessRead" size="large"
                        style="width: 100%; margin-bottom: 10px;">
                        {{ isLoading ? '正在加载...' : '选择 DOCX 文件' }}
                    </el-button>
                </el-col>
                <el-col :span="6" style="margin-left: 10px;">
                    <el-form-item label="">
                        <el-select v-model="form.model" placeholder="选择纠错模式">
                            <el-option label="逐句精校（适合高精度）" value="wordError" />
                            <el-option label="逐段校正（适合长文献）" value="ComprehensiveError" />
                            <el-option label="全文润色（适合简文章）" value="polish" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="4">
                    <el-button type="primary" size="large" style="margin-left: 10px;" @click="onSubmit"
                        :disabled="!form.filePath || processing" :loading="processing">
                        {{ processing ? '正在校对...' : '开始校正' }}
                    </el-button>
                </el-col>
                <el-col :span="4">
                    <el-button type="default" size="large" style="margin-left: 10px;" @click="exportToDocx"
                        :disabled="proofreadingResults.length === 0" :loading="exporting">
                        导出结果
                    </el-button>
                </el-col>
            </el-row>
        </el-header>

        <!-- 主内容区域 - 拆分为预览区和校对结果区 -->
        <el-container class="main-content" style="flex: 1; overflow: hidden;">
            <!-- 文档预览区域 -->
            <el-main class="preview-area" style="padding: 0; overflow: hidden; width: 70%;">
                <div ref="previewContainer" class="preview-container" style="height: 100%; overflow: auto;">
                    <el-empty v-if="!fileName" description="选择一个 DOCX 文件进行预览" :image-size="80" />
                </div>
            </el-main>

            <!-- 校对结果侧栏 -->
            <el-aside class="proofreading-sidebar" width="30%"
                style="border-left: 1px solid #ebeef5; background: #f8f9fa; overflow-y: auto;">
                <el-button type="default" @click="applyALLCorrection()">
                    应用全部修改
                </el-button>
                <div class="results-container" v-if="proofreadingResults.length > 0">
                    <el-collapse v-model="activeNames">
                        <el-collapse-item v-for="(item, index) in proofreadingResults" :key="index" :name="index"
                            :class="`correction-item type-${item.type.toLowerCase()}`">
                            <template #title>
                                <div class="correction-header">
                                    <span class="correction-type" :class="`type-${item.type.toLowerCase()}`">
                                        {{ formatCorrectionType(item.type) }}
                                    </span>
                                    <span class="correction-count">{{ index + 1 }}/{{
                                        proofreadingResults.length }}</span>
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
                                    <el-button type="text" size="small" @click="applyCorrection(index)">
                                        应用修改
                                    </el-button>
                                </div>
                            </div>
                        </el-collapse-item>
                    </el-collapse>
                </div>

                <div v-else class="no-results" style="padding: 20px; text-align: center; color: #909399;">
                    <el-empty :description="fileName ? '暂无校对结果' : '请选择文档进行校对'" :image-size="60" />
                </div>
            </el-aside>
        </el-container>
    </el-container>
</template>


<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
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

// 状态变量
const previewContainer = ref(null)
const fileName = ref('')
const isLoading = ref(false)
const error = ref('')
const processing = ref(false)
const exporting = ref(false) // 新增导出状态
const proofreadingResults = ref([]) // 存储校对结果
const activeNames = ref([]) // 折叠面板展开项


// 从 Electron 获取 API
const electronAPI = window.electronAPI
const form = ref({
    model: '',
    filePath: '',
})

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
    console.log("replace index:", "index")
    const item = proofreadingResults.value[index];


    // 获取预览容器内容
    const container = previewContainer.value;
    if (!container) return;

    // 创建空格不敏感的匹配函数
    const createWhitespaceInsensitiveMatcher = (searchText) => {
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escapedText.replace(/\s+/g, '\\s+');
        return new RegExp(pattern, 'g');
    };

    const regex = createWhitespaceInsensitiveMatcher(item.original.trim());
    console.log("regex:", regex)
    let content = container.innerHTML;

    // 替换第一个匹配项
    content = content.replace(regex, item.suggested);

    // 更新预览内容
    container.innerHTML = content;

    // 更新校对状态（标记为已应用）
    proofreadingResults.value[index].applied = true;

    // 显示成功提示
    ElMessage({
        message: '已应用修改',
        type: 'success',
        duration: 1500
    });
};

// 应用所有校对建议
const applyALLCorrection = () => {
    console.log("will apply all")

    // 获取预览容器内容
    const container = previewContainer.value;
    if (!container) return;

    let content = container.innerHTML;

    // 遍历所有校对结果并应用修改
    proofreadingResults.value.forEach((item, index) => {
        const regex = createWhitespaceInsensitiveMatcher(item.original.trim());
        console.log("regex:", regex)

        // 替换第一个匹配项
        content = content.replace(regex, item.suggested);

        // 更新校对状态（标记为已应用）
        proofreadingResults.value[index].applied = true;
    });

    // 更新预览内容
    container.innerHTML = content;

    // 显示成功提示
    ElMessage({
        message: '已应用全部修改',
        type: 'success',
        duration: 1500
    });
};

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

  try {
    processing.value = true;
    error.value = '';
    proofreadingResults.value = [];

    const results = await electronAPI.processDocx(form.value.model, form.value.filePath);
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
        form.value.filePath = filePath

        if (!filePath) {
            isLoading.value = false
            return
        }

        // 提取文件名
        fileName.value = filePath.split('\\').pop().split('/').pop()

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

// 组件挂载后检查 Electron API 是否可用
onMounted(() => {
    if (!window.electronAPI) {
        error.value = 'Electron 环境未正确加载，请在 Electron 应用中运行此页面'
        console.error('Electron API 未定义')
    }
})
</script>

<style scoped>
.app-container {
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    max-width: 1200px;
    margin: 0 auto;
}

.preview-container {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: auto;
    background-color: white;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    padding: 20px;
}

/* 校对结果侧栏样式 */
.proofreading-sidebar {
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    flex: 0 0 auto;
}

.results-container {
    flex: 1 1 auto;
    padding: 10px;
}

.correction-item {
    margin-bottom: 10px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.correction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10px;
}

.correction-type {
    display: inline-block;
    padding: 2px 8px;
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
    background: #fff;
    border-top: 1px solid #ebeef5;
    border-radius: 0 0 4px 4px;
}

.correction-content>div {
    margin-bottom: 10px;
    line-height: 1.5;
}

.correction-content strong {
    color: #606266;
    min-width: 50px;
    display: inline-block;
}

.actions {
    margin-top: 10px;
    text-align: right;
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

/* 文档中的高亮样式 */
:deep(.correction-highlight) {
    cursor: pointer;
    transition: all 0.2s ease;
}

:deep(.correction-highlight:hover) {
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.3);
}

/* 移除 scoped 属性或添加全局样式 */
:root {
    --highlight-bg: rgba(255, 223, 0, 0.6);
    --highlight-border: #ff9800;
}

/* 全局高亮样式 */
/* .highlight-correction {
    background-color: var(--highlight-bg) !important;
    border-bottom: 2px dashed var(--highlight-border) !important;
    cursor: pointer !important;
    padding: 0 2px !important;
    border-radius: 2px !important;
    transition: all 0.2s ease !important;
}

.highlight-correction:hover {
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.3) !important;
    background-color: rgba(255, 200, 0, 0.7) !important;
} */
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