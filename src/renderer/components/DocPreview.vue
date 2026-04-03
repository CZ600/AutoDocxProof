<template>
  <div class="doc-preview-wrapper">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-alert" />

    <div class="action-bar">
      <div class="header-content">
        <div class="file-info-container">
          <el-tooltip v-if="fileName" :content="fileName" placement="bottom">
            <span class="file-name-tag">
              <el-icon style="margin-right: 4px"><Document /></el-icon>
              {{ fileName.length > 18 ? fileName.slice(0, 18) + '...' : fileName }}
            </span>
          </el-tooltip>
          <template v-if="selectRepository.length > 0">
            <el-tag
              type="success"
              size="small"
              v-for="item in selectRepository"
              :key="item"
              closable
              :disable-transitions="false"
              @close="deleteSelectRepository(item)"
              >{{ item }}</el-tag
            >
            <el-button type="danger" size="small" text @click="deleteAllSelectRepository">{{
              t('proof.clear')
            }}</el-button>
          </template>
        </div>

        <transition name="inline-progress-fade">
          <div v-if="progressDialogVisible" class="inline-progress-container">
            <span class="inline-progress-stage">{{ progressStageText }}</span>
            <el-progress
              class="inline-progress-bar"
              :percentage="progressPercent"
              :show-text="false"
              :stroke-width="8"
              :color="progressBarColor"
            />
            <span class="inline-progress-percent">{{ progressPercent }}%</span>
          </div>
        </transition>

        <div class="button-group">
          <el-button type="primary" :loading="isLoading" @click="selectFileWithMainProcessRead" size="default">
            {{ isLoading ? t('proof.loading') : t('proof.selectFile') }}
          </el-button>

          <el-select v-model="form.model" :placeholder="t('proof.modePlaceholder')" size="default" class="mode-select">
            <el-option :label="t('proof.modeWordError')" value="wordError" />
            <el-option :label="t('proof.modeComprehensive')" value="ComprehensiveError" />
            <el-option :label="t('proof.modePolish')" value="polish" />
          </el-select>

          <el-dropdown placement="bottom">
            <el-button size="default" :class="['kb-button', selectRepository.length > 0 ? 'kb-button-active' : '']">
              <el-icon><Collection /></el-icon>
            </el-button>
            <template #dropdown>
              <el-text style="display: flex; justify-content: center; padding: 8px 0 4px">{{
                t('proof.selectKnowledge')
              }}</el-text>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="value in repositoryList"
                  :key="value"
                  :index="value"
                  @click="addRepository(value)"
                  >{{ value }}</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-button
            type="primary"
            size="default"
            @click="onSubmit"
            :disabled="!form.filePath || processing"
            :loading="processing"
          >
            {{ processing ? t('proof.proofreading') : t('proof.startProof') }}
          </el-button>

          <el-button
            type="success"
            size="default"
            @click="exportToDocx"
            :disabled="proofreadingResults.length === 0"
            :loading="exporting"
          >
            {{ t('proof.exportResult') }}
          </el-button>
        </div>
      </div>
    </div>

    <div class="preview-area">
      <div ref="previewContainer" class="preview-container">
        <el-empty v-if="!fileName" :description="t('proof.previewFile')" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed, provide, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElAlert,
  ElEmpty,
  ElSelect,
  ElOption,
  ElMessage,
  ElProgress,
  ElTooltip,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElTag,
  ElIcon
} from 'element-plus'
import { renderAsync } from 'docx-preview'
import { fileInfoStore } from '../stores/store'
import { useEmbeddingStore } from '../stores/embeddingStore'
import { useApiStore } from '../stores/apiStore'
import { Collection, Document } from '@element-plus/icons-vue'
import { useDark } from '@vueuse/core'

const electronAPI = window.electronAPI
const router = useRouter()
const { t } = useI18n()
const isDark = useDark()

const previewContainer = inject('previewContainer')
const isLoading = ref(false)
const error = ref('')
const processing = ref(false)
const exporting = ref(false)
const progressDialogVisible = ref(false)
const progressPercent = ref(0)
const progressStage = ref('splitting')
const progressMode = ref('real')
const progressDetail = ref('')
const progressBarColor = [
  { color: '#d8ebff', percentage: 30 },
  { color: '#b7dcff', percentage: 70 },
  { color: '#8ec5ff', percentage: 100 }
]
let fakeProgressTimer = null
let closeProgressTimer = null
let proofreadProgressUnsubscribe = null

const fileStore = fileInfoStore()
const apiSettingsStore = useApiStore()
const embeddingStore = useEmbeddingStore()

const fileName = computed(() => fileStore.fileName)
const proofreadingResults = computed(() => fileStore.results)
const timeLimit =
  apiSettingsStore.selectedApi.TimeLimit && apiSettingsStore.selectedApi.TimeLimit > 0
    ? apiSettingsStore.selectedApi.TimeLimit
    : undefined

const form = ref({
  model: fileStore.proofModel,
  filePath: fileStore.filePath
})

const progressStageText = computed(() => {
  const stageMap = {
    splitting: t('proof.progress.splitting'),
    theme: t('proof.progress.theme'),
    proofreading: t('proof.progress.proofreading'),
    reviewing: t('proof.progress.reviewing'),
    completed: t('proof.progress.completed')
  }
  return stageMap[progressStage.value] || t('proof.progress.default')
})

const repositoryList = ref([])
const selectRepository = ref([])

watch(
  () => form.model,
  newVal => {
    if (newVal) fileStore.setProofModel(newVal)
  }
)

watch(
  () => form.filePath,
  newVal => {
    if (newVal) fileStore.setFilePath(newVal)
  }
)

function unique(arr) {
  return Array.from(new Set(arr))
}

const addRepository = async item => {
  selectRepository.value.push(item)
  selectRepository.value = unique(selectRepository.value)
}

const deleteSelectRepository = async value => {
  selectRepository.value = selectRepository.value.filter(item => item !== value)
}

const deleteAllSelectRepository = async () => {
  selectRepository.value = []
}

const getRepositories = async () => {
  try {
    const result = await electronAPI.listRepositories()
    if (Array.isArray(result)) {
      repositoryList.value = [...result]
    }
    return result
  } catch (error) {
    console.error('获取知识库列表失败:', error)
    return []
  }
}

const pushToDB = async resultCorrect => {
  try {
    const filePath = form.value.filePath
    const modelInfo = await electronAPI.getAPISettings()
    const URL = modelInfo.URL
    const modelName = modelInfo.modelName

    if (!filePath) {
      console.warn('文件路径为空，无法保存历史记录')
      return
    }
    if (!URL || !modelName) {
      console.error('API设置不完整，无法保存历史记录')
      return
    }
    if (!resultCorrect || (Array.isArray(resultCorrect) && resultCorrect.length === 0)) {
      console.warn('校对结果为空，无需保存历史记录')
      return
    }

    try {
      const result = await electronAPI.insertOneHistory(filePath, URL, modelName, JSON.stringify(resultCorrect))
      if (result && result.success === false) {
        console.error('保存历史记录失败:', result.error)
        ElMessage({
          message: t('proof.messages.historySaveFailed') + (result.error || ''),
          type: 'error',
          duration: 3000
        })
        return
      }
      console.log('历史记录保存成功:', result)
      ElMessage({
        message: t('proof.messages.historySaveSuccess'),
        type: 'success',
        duration: 1500
      })
    } catch (ipcError) {
      console.error('IPC调用失败:', ipcError)
      ElMessage({
        message: t('proof.messages.historyIpcFailed'),
        type: 'error',
        duration: 3000
      })
      return
    }
  } catch (error) {
    console.error('保存历史记录时发生未预期错误:', error)
    ElMessage({
      message: t('proof.messages.historyUnexpectedError') + error.message,
      type: 'error',
      duration: 3000
    })
  }
}

const clearFakeProgressTimer = () => {
  if (fakeProgressTimer) {
    clearInterval(fakeProgressTimer)
    fakeProgressTimer = null
  }
}

const clearCloseProgressTimer = () => {
  if (closeProgressTimer) {
    clearTimeout(closeProgressTimer)
    closeProgressTimer = null
  }
}

const resetProgressState = () => {
  clearFakeProgressTimer()
  clearCloseProgressTimer()
  progressPercent.value = 0
  progressStage.value = 'splitting'
  progressDetail.value = ''
  progressMode.value = 'real'
}

const openProgressDialog = mode => {
  resetProgressState()
  progressDialogVisible.value = true
  progressMode.value = mode === 'polish' ? 'fake' : 'real'
}

const closeProgressDialog = () => {
  clearFakeProgressTimer()
  clearCloseProgressTimer()
  closeProgressTimer = setTimeout(() => {
    progressDialogVisible.value = false
    progressDetail.value = ''
    closeProgressTimer = null
  }, 400)
}

const startFakeProgress = () => {
  clearFakeProgressTimer()
  const startTime = Date.now()
  const duration = 120000
  fakeProgressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime
    const ratio = Math.min(elapsed / duration, 1)
    const easedRatio = 1 - Math.pow(1 - ratio, 3)
    const nextPercent = Math.min(95, Math.floor(easedRatio * 95))
    progressPercent.value = Math.max(progressPercent.value, nextPercent)
    if (ratio >= 1) {
      progressPercent.value = 95
      clearFakeProgressTimer()
    }
  }, 120)
}

const finishProgress = () => {
  clearFakeProgressTimer()
  progressStage.value = 'completed'
  progressDetail.value = ''
  progressPercent.value = 100
  closeProgressDialog()
}

const handleProofreadProgress = payload => {
  if (!progressDialogVisible.value || !processing.value) return
  if (payload.stage) {
    progressStage.value = payload.stage
  }
  if (payload.stage === 'proofreading') {
    if (typeof payload.total === 'number' && payload.total > 0) {
      const completed = typeof payload.completed === 'number' ? payload.completed : 0
      progressDetail.value = `${completed} / ${payload.total}`
    } else {
      progressDetail.value = ''
    }
  } else if (payload.stage === 'reviewing') {
    if (typeof payload.total === 'number' && payload.total > 0) {
      const completed = typeof payload.completed === 'number' ? payload.completed : 0
      progressDetail.value = `${completed} / ${payload.total}`
    } else {
      progressDetail.value = ''
    }
  } else {
    progressDetail.value = ''
  }
  if (progressMode.value === 'real' && typeof payload.percent === 'number') {
    if (payload.stage === 'completed') {
      progressPercent.value = 100
    } else if (payload.stage === 'reviewing') {
      progressPercent.value = Math.max(progressPercent.value, Math.floor(payload.percent))
    } else {
      progressPercent.value = Math.min(95, Math.max(progressPercent.value, Math.floor(payload.percent)))
    }
  }
}

const renderDocx = async file => {
  try {
    if (previewContainer.value) {
      previewContainer.value.innerHTML = ''
      await renderAsync(file, previewContainer.value)
    } else {
      throw new Error(t('proof.errors.previewNotInit'))
    }
  } catch (err) {
    error.value = t('proof.errors.renderFailed', { message: err.message })
    console.error('DOCX 渲染错误:', err)
    throw err
  }
}

const selectFileWithMainProcessRead = async () => {
  try {
    isLoading.value = true
    error.value = ''
    const filePath = await electronAPI.selectDocxFile()
    if (!filePath) {
      isLoading.value = false
      return
    }
    const name = filePath.split('\\').pop().split('/').pop()
    fileStore.setFilePath(filePath)
    fileStore.setFileName(name)
    form.value.filePath = filePath
    const fileData = await electronAPI.readDocxFile(filePath)
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
    const blob = new Blob(byteArrays, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    const file = new File([blob], name, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    await renderDocx(file)
    fileStore.setCorrectResult([])
    isLoading.value = false
  } catch (err) {
    error.value = t('proof.errors.fileFailed', { message: err.message })
    console.error('文件处理错误:', err)
    isLoading.value = false
  }
}

const exportToDocx = async () => {
  if (proofreadingResults.value.length === 0) return
  try {
    exporting.value = true
    const container = previewContainer.value
    if (!container) throw new Error(t('proof.errors.previewEmpty'))
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
    }
    const result = await electronAPI.exportCorrectedDocx(exportConfig)
    if (result?.canceled) {
      return
    }
    if (result?.success) {
      ElMessage({
        message: t('proof.messages.exportSuccess') + (result.filePath || ''),
        type: 'success',
        duration: 2000
      })
    } else {
      throw new Error(t('proof.messages.exportIncomplete'))
    }
  } catch (err) {
    console.error('导出错误:', err)
    ElMessage({
      message: t('proof.messages.exportFailed') + err.message,
      type: 'error',
      duration: 3000
    })
  } finally {
    exporting.value = false
  }
}

const onSubmit = async () => {
  if (!form.value.filePath) {
    error.value = t('proof.errors.selectDoc')
    return
  }
  if (!form.value.model) {
    error.value = t('proof.errors.selectMode')
    return
  }
  fileStore.setProofModel(form.model)

  try {
    processing.value = true
    error.value = ''
    fileStore.setCorrectResult([])
    openProgressDialog(form.value.model)
    progressStage.value = 'splitting'
    if (form.value.model === 'polish') {
      startFakeProgress()
    }

    let apiURL, apiKey, modelName, parallel, timeLimit_
    const currentApiSettings = apiSettingsStore.selectedApi
    if (currentApiSettings.id && (!currentApiSettings.URL || !currentApiSettings.key)) {
      const foundApi = apiSettingsStore.apiSettings.find(item => item.id === currentApiSettings.id)
      if (foundApi) {
        apiURL = foundApi.apiURL
        apiKey = foundApi.apiKey
        modelName = foundApi.modelName
      }
    } else {
      apiURL = currentApiSettings.URL
      apiKey = currentApiSettings.key
      modelName = currentApiSettings.name
    }
    parallel = apiSettingsStore.selectedApi.parallel || 30
    timeLimit_ = apiSettingsStore.selectedApi.TimeLimit

    if (!apiURL || !apiKey || !modelName) {
      ElMessage({
        message: t('proof.errors.apiIncomplete'),
        type: 'error',
        duration: 3000
      })
      clearFakeProgressTimer()
      clearCloseProgressTimer()
      progressDialogVisible.value = false
      progressDetail.value = ''
      processing.value = false
      return
    }

    await electronAPI.selectAPISetting(apiURL, apiKey, modelName, parallel, timeLimit_)

    let results
    let token_usage = 0
    if (selectRepository.value.length > 0) {
      const params = {
        model: form.value.model,
        filePath: form.value.filePath,
        repositoryNameList: [...selectRepository.value]
      }
      const { apiURL: embApiURL, apiKey: embApiKey, modelName: embModelName } = embeddingStore.getAPIConfig
      let preResult = await electronAPI.processDocx(
        params.model,
        params.filePath,
        params.repositoryNameList,
        { apiURL: embApiURL, apiKey: embApiKey, modelName: embModelName },
        timeLimit_,
        apiSettingsStore.selectedApi.parallel,
        apiSettingsStore.reviewModelId ?? null
      )
      if ('message' in preResult) {
        if (preResult.message === 'Please select an API setting!') {
          ElMessage({
            message: t('proof.errors.apiKeyRequired'),
            type: 'error',
            duration: 1500
          })
          clearFakeProgressTimer()
          clearCloseProgressTimer()
          progressDialogVisible.value = false
          progressDetail.value = ''
          return
        }
      }
      results = preResult.proofResult
      token_usage += preResult.token_usage
    } else {
      let preResult = await electronAPI.processDocx(
        form.value.model,
        form.value.filePath,
        undefined,
        undefined,
        timeLimit_,
        apiSettingsStore.selectedApi.parallel,
        apiSettingsStore.reviewModelId ?? null
      )
      if ('message' in preResult) {
        if (preResult.message === 'Please select an API setting!') {
          ElMessage({
            message: t('proof.errors.apiKeyRequired'),
            type: 'error',
            duration: 1500
          })
          clearFakeProgressTimer()
          clearCloseProgressTimer()
          progressDialogVisible.value = false
          progressDetail.value = ''
          return
        }
      }
      results = preResult.proofResult
      token_usage += preResult.token_usage
    }
    apiSettingsStore.addTotalTokens(token_usage)

    ElMessage({
      message: t('proof.messages.processSuccess') + token_usage,
      type: 'success',
      duration: 2000
    })

    finishProgress()
    const finalResults = Array.isArray(results) ? results : []
    const filteredOut = finalResults.filter(item => item.filtered)
    const validResults = finalResults.filter(item => !item.filtered)
    if (filteredOut.length > 0) {
      console.log(
        `审核已过滤 ${filteredOut.length} 条无效建议:`,
        filteredOut.map(r => ({
          original: r.original,
          suggested: r.suggested,
          reason: r.filterReason
        }))
      )
    }
    fileStore.setCorrectResult(
      validResults.map((item, index) => ({
        ...item,
        id: `correction-${index}`,
        applied: false
      }))
    )

    if (validResults.length > 0) {
      await pushToDB(validResults)
    }

    router.push('/proof')
  } catch (err) {
    clearFakeProgressTimer()
    clearCloseProgressTimer()
    progressDialogVisible.value = false
    progressDetail.value = ''
    error.value = t('proof.errors.processFailed', { message: err.message })
    console.error('校对处理异常:', err)
    ElMessage({
      message: t('proof.errors.processFailed', { message: err.message }),
      type: 'error',
      duration: 3000
    })
  } finally {
    clearFakeProgressTimer()
    processing.value = false
  }
}

const initCorrectStatus = async () => {
  if (!fileStore.isfilePathEmpty) {
    form.value.filePath = fileStore.getFilePath
  }
  if (!fileStore.isProofModelEmpty) {
    form.value.model = fileStore.getProofModel
  }
}

const initProofreadProgressListener = () => {
  if (proofreadProgressUnsubscribe) {
    proofreadProgressUnsubscribe()
  }
  proofreadProgressUnsubscribe = electronAPI.onProofreadProgress(handleProofreadProgress)
}

onMounted(async () => {
  if (!window.electronAPI) {
    error.value = t('proof.errors.electronNotReady')
    return
  }
  initProofreadProgressListener()
  getRepositories()
  initCorrectStatus()

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
      const blob = new Blob(byteArrays, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      const file = new File([blob], fileStore.fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      await renderDocx(file)
    } catch (err) {
      console.error('恢复预览失败:', err)
      fileStore.clearAll()
    } finally {
      isLoading.value = false
    }
  }
})

onUnmounted(() => {
  clearFakeProgressTimer()
  clearCloseProgressTimer()
  if (proofreadProgressUnsubscribe) {
    proofreadProgressUnsubscribe()
    proofreadProgressUnsubscribe = null
  }
})
</script>

<style>
html.dark .action-bar {
  background-color: #1d1e1f;
  border-bottom-color: #2c2e30;
}

html.dark .file-name-tag {
  background-color: #1a2740;
  color: #8ec5ff;
}

html.dark .preview-container {
  background-color: #1d1e1f;
  border-color: #2c2e30;
}

html.dark .preview-container section.docx {
  background-color: #1d1e1f;
}

html.dark .preview-container .docx-wrapper {
  background-color: #1d1e1f;
  padding: 0;
}

html.dark .preview-container p,
html.dark .preview-container span,
html.dark .preview-container div,
html.dark .preview-container li,
html.dark .preview-container td,
html.dark .preview-container th {
  color: #e4e7ed !important;
}

html.dark .preview-container h1,
html.dark .preview-container h2,
html.dark .preview-container h3,
html.dark .preview-container h4,
html.dark .preview-container h5,
html.dark .preview-container h6 {
  color: #f2f3f5 !important;
}

html.dark .preview-container table {
  background-color: #1d1e1f !important;
}

html.dark .preview-container td,
html.dark .preview-container th {
  border-color: #2c2e30 !important;
  background-color: transparent !important;
}

html.dark .preview-container tr {
  background-color: transparent !important;
}

html.dark .preview-container ul,
html.dark .preview-container ol {
  color: #e4e7ed;
}

html.dark .preview-container pre,
html.dark .preview-container code {
  background-color: #141414 !important;
  color: #e4e7ed !important;
}

html.dark .preview-container a {
  color: #75c777 !important;
}

html.dark .preview-container blockquote {
  border-left-color: #4c4d4f !important;
  background-color: #141414 !important;
  color: #e4e7ed !important;
}

html.dark .preview-container img {
  filter: brightness(0.9) contrast(1.1);
}

html.dark .preview-container hr {
  border-color: #2c2e30 !important;
}

html.dark .inline-progress-container {
  background: rgba(30, 32, 34, 0.9);
  border-color: #2c2e30;
}

html.dark .inline-progress-stage {
  color: #8ec5ff;
}

html.dark .inline-progress-percent {
  color: #d7e9ff;
}

.inline-progress-container {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 400px;
  min-width: 240px;
  padding: 6px 16px;
  border-radius: 8px;
  background: rgba(240, 245, 255, 0.7);
  border: 1px solid rgba(142, 197, 255, 0.22);
  transition: all 0.3s ease;
  -webkit-app-region: no-drag;
}

.inline-progress-stage {
  font-size: 12px;
  font-weight: 500;
  color: #3a8ee6;
  white-space: nowrap;
  flex-shrink: 0;
}

.inline-progress-bar {
  flex: 1;
  min-width: 60px;
}

.inline-progress-percent {
  font-size: 13px;
  font-weight: 700;
  color: #2f5f8f;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
}

.inline-progress-fade-enter-active {
  transition: all 0.3s ease-out;
}

.inline-progress-fade-leave-active {
  transition: all 0.25s ease-in;
}

.inline-progress-fade-enter-from {
  opacity: 0;
  transform: scaleX(0.8);
}

.inline-progress-fade-leave-to {
  opacity: 0;
  transform: scaleX(0.8);
}
</style>

<style scoped>
.doc-preview-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

.error-alert {
  margin: 8px 12px;
  border-radius: 8px;
}

.action-bar {
  position: fixed;
  top: 0;
  left: 52px;
  right: 0;
  height: 52px;
  padding: 0 20px;
  padding-right: 146px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  z-index: 99;
  -webkit-app-region: drag;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 100%;
}

.file-info-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

.file-name-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  background-color: #f0f5ff;
  color: #3a8ee6;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
  flex-shrink: 1;
}

.button-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.file-info-container .el-tag,
.file-info-container .el-button {
  -webkit-app-region: no-drag;
}

.mode-select {
  width: 150px;
}

.kb-button {
  padding: 8px;
}

.kb-button-active {
  color: #67c23a;
  border-color: #67c23a;
}

.preview-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.preview-container {
  height: 100%;
  overflow: auto;
  padding: 0px;
  margin: 0;
  background-color: #fff;
  transition: box-shadow 0.2s ease;
}

.preview-container:hover {
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.06);
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
}
</style>
