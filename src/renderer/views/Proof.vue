<template>
  <el-container direction="vertical" class="app-container">
    <!-- 操作区域 -->
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-alert" />
    <el-header class="action-bar">
      <div class="header-content">
        <!-- 左侧：文件信息 + 知识库标签 -->
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
            <el-button type="danger" size="small" text @click="deleteAllSelectRepository">清空</el-button>
          </template>
        </div>

        <!-- 中间：内联进度条 -->
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

        <!-- 右侧：操作按钮 -->
        <div class="button-group">
          <el-button type="primary" :loading="isLoading" @click="selectFileWithMainProcessRead" size="default">
            {{ isLoading ? '加载中...' : '选择文件' }}
          </el-button>

          <el-select v-model="form.model" placeholder="校对模式" size="default" class="mode-select">
            <el-option label="逐句精校" value="wordError" />
            <el-option label="逐段校正" value="ComprehensiveError" />
            <el-option label="全文润色" value="polish" />
          </el-select>

          <el-dropdown placement="bottom">
            <el-button size="default" :class="['kb-button', selectRepository.length > 0 ? 'kb-button-active' : '']">
              <el-icon><Collection /></el-icon>
            </el-button>
            <template #dropdown>
              <el-text style="display: flex; justify-content: center; padding: 8px 0 4px">选择知识库</el-text>
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
            {{ processing ? '校对中...' : '开始校正' }}
          </el-button>

          <el-button
            type="success"
            size="default"
            @click="exportToDocx"
            :disabled="proofreadingResults.length === 0"
            :loading="exporting"
          >
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
          <el-dropdown placement="bottom" trigger="click">
            <el-button type="primary" :disabled="proofreadingResults.length === 0" class="apply-all-button">
              <span>应用修改</span>
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="applyALLCorrection()">
                  <el-icon style="margin-right: 8px"><Select /></el-icon>
                  应用全部修改 ({{ proofreadingResults.filter(r => !r.applied).length }})
                </el-dropdown-item>
                <el-dropdown-item divided>
                  <span style="font-weight: 600; color: #606266">按类别应用</span>
                </el-dropdown-item>
                <el-dropdown-item
                  v-for="cat in availableCategories"
                  :key="cat.value"
                  @click="applyByCategory(cat.value)"
                >
                  <span class="category-badge" :class="`category-${cat.value.toLowerCase()}`">{{ cat.label }}</span>
                  <span style="margin-left: 8px">{{ getCategoryCount(cat.value) }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="results-container" v-if="proofreadingResults.length > 0">
          <el-collapse v-model="activeNames">
            <el-collapse-item
              v-for="(item, index) in proofreadingResults"
              :key="index"
              :name="index"
              :id="`error-item-${index}`"
              :class="`correction-item type-${(item.type || '').toLowerCase()}`"
            >
              <template #title>
                <div class="correction-header" @click="scrollPreviewToCorrection(index)">
                  <span class="correction-type" :class="`type-${(item.type || '').toLowerCase()}`">
                    {{ formatCorrectionType(item.type) }}
                  </span>
                  <span class="correction-count">{{ index + 1 }}/{{ proofreadingResults.length }}</span>
                </div>
              </template>

              <div class="correction-content">
                <div class="original"><strong>原文:</strong> {{ item.original || '无数据' }}</div>
                <div class="suggested"><strong>建议:</strong> {{ item.suggested || '无数据' }}</div>
                <div class="reason"><strong>原因:</strong> {{ item.reason || '无数据' }}</div>
                <div class="actions">
                  <el-button type="primary" size="small" @click.stop="applyCorrection(index)" :disabled="item.applied">
                    {{ item.applied ? '已应用' : '应用修改' }}
                  </el-button>
                  <el-popover placement="bottom-start" width="500px" trigger="click" popper-class="reference-popover">
                    <template #reference>
                      <el-button type="primary" size="small" style="margin-left: 8px" @click.stop> 查看参考 </el-button>
                    </template>

                    <div class="reference-content">
                      <h4>参考内容：</h4>
                      <div class="reference-list">
                        <div v-for="(reference, refIndex) in item.References" :key="refIndex" class="reference-item">
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
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
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
  ElMessageBox,
  ElProgress,
  ElTooltip
} from 'element-plus'
import { renderAsync } from 'docx-preview'
import { fileInfoStore } from '../stores/store'
import { useEmbeddingStore } from '../stores/embeddingStore'
import { useApiStore } from '../stores/apiStore'
import { Collection, Document, ArrowDown, Select } from '@element-plus/icons-vue'
import { useDark } from '@vueuse/core'
import { scrollTo } from 'vue-scrollto'
// 从 Electron 获取 API
const electronAPI = window.electronAPI
// 状态变量
const previewContainer = ref(null)
// const fileName = ref('')
const isLoading = ref(false)
const error = ref('')
const processing = ref(false)
const exporting = ref(false) // 新增导出状态
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
let previewFocusTimer = null
// const proofreadingResults = ref([]) // 存储校对结果
const activeNames = ref([]) // 折叠面板展开项
// 使用 useDark 获取全局暗黑模式状态
const isDark = useDark()
// 从Pinia store中获取数据
const fileStore = fileInfoStore()
const apiSettingsStore = useApiStore()
const embeddingStore = useEmbeddingStore()
// 选择使用计算属性computed双向绑定store，避免手动watch同步
const fileName = computed(() => fileStore.fileName)
// 访问频率限制 - 只有当 TimeLimit 存在且大于 0 时才使用
const timeLimit =
  apiSettingsStore.selectedApi.TimeLimit && apiSettingsStore.selectedApi.TimeLimit > 0
    ? apiSettingsStore.selectedApi.TimeLimit
    : undefined

const form = ref({
  model: fileStore.proofModel,
  filePath: fileStore.filePath
})
const proofreadingResults = computed({
  get: () => fileStore.results,
  set: val => fileStore.setCorrectResult(val)
})
const progressStageText = computed(() => {
  const stageMap = {
    splitting: '正在整理信息',
    theme: '正在分析文档',
    proofreading: '正在校对',
    reviewing: '正在审核校对结果',
    completed: '校对完成'
  }
  return stageMap[progressStage.value] || '正在校对'
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
const formatCorrectionType = type => {
  const typeMap = {
    Typo: '错别字',
    Punctuation: '标点',
    Grammar: '语法',
    Consistency: '一致性',
    wordError: '错别字',
    ComprehensiveError: '综合错误',
    polish: '润色建议'
  }
  return typeMap[type] || type
}

const normalizeCorrectionType = type => {
  return (type || '').toString().trim().toLowerCase()
}

// 监听表单变化，自动保存到 store
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

watch(proofreadingResults, (newProof, oldProof) => {
  console.log('the result of the proof:', newProof)
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
    console.error('获取知识库列表失败:', error)
    return []
  }
}

function unique(arr) {
  return Array.from(new Set(arr))
}
const addRepository = async item => {
  selectRepository.value.push(item)
  selectRepository.value = unique(selectRepository.value) //  去重
  console.log('new select repository:', selectRepository.value)
}
const deleteSelectRepository = async value => {
  selectRepository.value = selectRepository.value.filter(function (item) {
    return item !== value
  })
}
const deleteAllSelectRepository = async value => {
  selectRepository.value = []
}

const initRepository = async () => {
  await getRepositories()
}

const pushToDB = async resultCorrect => {
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
      const result = await electronAPI.insertOneHistory(filePath, URL, modelName, JSON.stringify(resultCorrect))

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

    getALLHistory()
      .then(result => {
        console.log('获取历史记录:', result)
      })
      .catch(err => {
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
      // 审核阶段: 后端已经映射到 95-100 区间
      progressPercent.value = Math.max(progressPercent.value, Math.floor(payload.percent))
    } else {
      progressPercent.value = Math.min(95, Math.max(progressPercent.value, Math.floor(payload.percent)))
    }
  }
}

const createWhitespaceInsensitiveMatcher = (searchText, flags = 'g') => {
  const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = escapedText.replace(/\s+/g, '\\s+')
  return new RegExp(pattern, flags)
}

const clearHighlights = container => {
  const existingHighlights = container.querySelectorAll('.highlight-correction')
  existingHighlights.forEach(el => {
    const parent = el.parentNode
    if (!parent) return

    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    parent.removeChild(el)
    parent.normalize()
  })
}

const buildTextNodeMap = container => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const segments = []
  let fullText = ''
  let currentOffset = 0
  let node

  while ((node = walker.nextNode())) {
    const text = node.textContent || ''
    if (!text) continue

    segments.push({
      node,
      start: currentOffset,
      end: currentOffset + text.length
    })
    fullText += text
    currentOffset += text.length
  }

  return { fullText, segments }
}

const getDomPositionFromIndex = (segments, targetIndex, preferEnd = false) => {
  if (segments.length === 0) return null

  if (targetIndex <= 0) {
    return { node: segments[0].node, offset: 0 }
  }

  const lastSegment = segments[segments.length - 1]
  if (targetIndex >= lastSegment.end) {
    return {
      node: lastSegment.node,
      offset: lastSegment.node.textContent.length
    }
  }

  for (const segment of segments) {
    if (preferEnd) {
      if (targetIndex >= segment.start && targetIndex <= segment.end) {
        return {
          node: segment.node,
          offset: Math.min(targetIndex - segment.start, segment.node.textContent.length)
        }
      }
    } else if (targetIndex >= segment.start && targetIndex < segment.end) {
      return {
        node: segment.node,
        offset: targetIndex - segment.start
      }
    }
  }

  return null
}

const rangesOverlap = (left, right) => !(left.end <= right.start || left.start >= right.end)

const locateCorrectionsInPreview = (container, corrections) => {
  const { fullText, segments } = buildTextNodeMap(container)
  const occupiedRanges = []
  const matches = []

  corrections.forEach(({ item, index }) => {
    const originalText = item.original?.trim()
    if (!originalText) return

    const regex = createWhitespaceInsensitiveMatcher(originalText)
    let match

    while ((match = regex.exec(fullText))) {
      const start = match.index
      const end = start + match[0].length
      const range = { start, end }

      if (!occupiedRanges.some(existing => rangesOverlap(existing, range))) {
        occupiedRanges.push(range)
        matches.push({
          index,
          item,
          start,
          end
        })
        break
      }

      if (match[0].length === 0) {
        regex.lastIndex += 1
      }
    }
  })

  return { matches, segments }
}

const scrollToCorrectionItem = index => {
  if (index === -1) return

  activeNames.value = [index]
  nextTick(() => {
    scrollTo(`#error-item-${index}`, {
      container: '.results-container',
      duration: 500,
      offset: -350,
      easing: 'ease-in-out',
      force: true
    })
  })
}

const findHighlightElement = correctionId => {
  const container = previewContainer.value
  if (!container || !correctionId) return null

  return container.querySelector(`.highlight-correction[data-correction-id="${correctionId}"]`)
}

const focusPreviewHighlight = highlightEl => {
  if (!highlightEl) return

  if (previewFocusTimer) {
    clearTimeout(previewFocusTimer)
    previewFocusTimer = null
  }

  highlightEl.classList.remove('highlight-correction-focused')
  void highlightEl.offsetWidth
  highlightEl.classList.add('highlight-correction-focused')
  previewFocusTimer = setTimeout(() => {
    highlightEl.classList.remove('highlight-correction-focused')
    previewFocusTimer = null
  }, 2800)
}

const scrollPreviewToCorrection = index => {
  const container = previewContainer.value
  const correction = proofreadingResults.value[index]
  if (!container || !correction) return false

  const correctionId = correction.id || `correction-${index}`
  const highlightEl = findHighlightElement(correctionId)
  if (!highlightEl) return false

  const containerRect = container.getBoundingClientRect()
  const highlightRect = highlightEl.getBoundingClientRect()
  const offsetTop = highlightRect.top - containerRect.top + container.scrollTop
  const targetScrollTop = Math.max(offsetTop - container.clientHeight * 0.35, 0)

  container.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth'
  })

  focusPreviewHighlight(highlightEl)
  return true
}

const wrapPreviewRange = (container, match) => {
  const { segments, start, end, item, index } = match
  const startPos = getDomPositionFromIndex(segments, start, false)
  const endPos = getDomPositionFromIndex(segments, end, true)

  if (!startPos || !endPos) return false

  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset)

  const highlightEl = document.createElement('span')
  const correctionTypeClass = `highlight-type-${normalizeCorrectionType(item.type)}`
  highlightEl.className = `highlight-correction ${correctionTypeClass}`
  highlightEl.dataset.correctionId = item.id || `correction-${index}`
  highlightEl.addEventListener('click', () => scrollToCorrectionItem(index))

  highlightEl.appendChild(range.extractContents())
  range.insertNode(highlightEl)
  return true
}

const highlightCorrections = () => {
  const container = previewContainer.value
  if (!container) return

  clearHighlights(container)

  const pendingCorrections = proofreadingResults.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.applied)
  if (pendingCorrections.length === 0) return

  const { matches, segments } = locateCorrectionsInPreview(container, pendingCorrections)
  matches
    .map(match => ({ ...match, segments }))
    .sort((a, b) => b.start - a.start)
    .forEach(match => {
      wrapPreviewRange(container, match)
    })
}

const replaceCorrectionInPreview = (container, correction) => {
  clearHighlights(container)

  const { matches, segments } = locateCorrectionsInPreview(container, [{ item: correction, index: 0 }])
  const match = matches[0]
  if (!match) return false

  const startPos = getDomPositionFromIndex(segments, match.start, false)
  const endPos = getDomPositionFromIndex(segments, match.end, true)
  if (!startPos || !endPos) return false

  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset)
  range.deleteContents()
  range.insertNode(document.createTextNode(correction.suggested || ''))
  container.normalize()
  return true
}

// 应用单个校对建议
const applyCorrection = index => {
  const newResults = [...proofreadingResults.value]
  newResults[index] = { ...newResults[index], applied: true }
  proofreadingResults.value = newResults // 触发 setter

  const container = previewContainer.value
  if (!container) return
  const updated = replaceCorrectionInPreview(container, newResults[index])
  highlightCorrections()

  if (updated) {
    ElMessage.success('已应用修改')
  } else {
    ElMessage.warning('未能在预览中定位到该处文本，但导出仍会按原文尝试替换')
  }
}

// 获取可用的错误类别列表
const availableCategories = computed(() => {
  const typeMap = {
    Typo: '错别字',
    Punctuation: '标点',
    Grammar: '语法',
    Consistency: '一致性',
    wordError: '错别字',
    ComprehensiveError: '综合错误',
    polish: '润色建议'
  }

  const types = new Set()
  proofreadingResults.value.forEach(item => {
    if (!item.applied && item.type) {
      types.add(item.type)
    }
  })

  return Array.from(types).map(type => ({
    value: type,
    label: typeMap[type] || type
  }))
})

// 获取某个类别的未应用修改数量
const getCategoryCount = type => {
  const count = proofreadingResults.value.filter(item => !item.applied && item.type === type).length
  return `${count} 条`
}

// 按类别应用修改
const applyByCategory = type => {
  const applicableResults = proofreadingResults.value.filter(item => !item.applied && item.type === type)
  if (applicableResults.length === 0) {
    ElMessage.warning('该类别没有待应用的修改')
    return
  }

  const newResults = proofreadingResults.value.map(item => {
    if (!item.applied && item.type === type) {
      return { ...item, applied: true }
    }
    return item
  })
  proofreadingResults.value = newResults

  const container = previewContainer.value
  if (!container) return
  let replacedCount = 0

  applicableResults.forEach(item => {
    if (replaceCorrectionInPreview(container, { ...item, applied: true })) {
      replacedCount += 1
    }
  })

  highlightCorrections()

  const typeLabel = formatCorrectionType(type)
  if (replacedCount === applicableResults.length) {
    ElMessage.success(`已应用全部 ${typeLabel} 修改`)
  } else {
    ElMessage.warning(`已应用 ${replacedCount}/${applicableResults.length} 处 ${typeLabel} 修改`)
  }
}

// 应用所有校对建议
const applyALLCorrection = () => {
  const applicableResults = proofreadingResults.value.filter(item => !item.applied)
  if (applicableResults.length === 0) {
    ElMessage.warning('没有待应用的修改')
    return
  }

  const newResults = proofreadingResults.value.map(item => ({ ...item, applied: true }))
  proofreadingResults.value = newResults

  const container = previewContainer.value
  if (!container) return
  clearHighlights(container)
  let replacedCount = 0

  applicableResults.forEach(item => {
    if (replaceCorrectionInPreview(container, { ...item, applied: true })) {
      replacedCount += 1
    }
  })

  if (replacedCount === applicableResults.length) {
    ElMessage.success('已应用全部修改')
  } else {
    ElMessage.warning(`已应用 ${replacedCount}/${applicableResults.length} 处预览修改，其余将在导出时继续尝试替换`)
  }
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
    processing.value = true
    error.value = ''
    proofreadingResults.value = []
    openProgressDialog(form.value.model)
    progressStage.value = 'splitting'
    if (form.value.model === 'polish') {
      startFakeProgress()
    }

    // 在开始校对前，先同步 API 设置到主进程
    let apiURL, apiKey, modelName, parallel, timeLimit

    // 尝试从 selectedApi 获取
    const currentApiSettings = apiSettingsStore.selectedApi
    console.log('当前 API 设置:', currentApiSettings)

    // 如果 selectedApi 中的 URL 或 key 为空，尝试从 apiSettings 列表中查找
    if (currentApiSettings.id && (!currentApiSettings.URL || !currentApiSettings.key)) {
      console.log('selectedApi 数据不完整，从 apiSettings 列表中查找')
      const foundApi = apiSettingsStore.apiSettings.find(item => item.id === currentApiSettings.id)
      if (foundApi) {
        console.log('从 apiSettings 列表中找到 API:', foundApi)
        apiURL = foundApi.apiURL
        apiKey = foundApi.apiKey
        modelName = foundApi.modelName
      }
    } else {
      apiURL = currentApiSettings.URL
      apiKey = currentApiSettings.key
      modelName = currentApiSettings.name
    }

    // 使用 store 中的并发和频率限制设置
    parallel = apiSettingsStore.selectedApi.parallel || 30
    timeLimit = apiSettingsStore.selectedApi.TimeLimit

    console.log('最终使用的 API 配置:')
    console.log('  URL:', apiURL)
    console.log('  key:', apiKey ? '***已设置***' : '未设置')
    console.log('  modelName:', modelName)
    console.log('  parallel:', parallel)
    console.log('  timeLimit:', timeLimit)

    if (!apiURL || !apiKey || !modelName) {
      console.error('API 设置不完整')
      ElMessage({
        message: 'API 配置不完整，请重新在设置中选择 API',
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

    // 同步 API 设置到主进程
    await electronAPI.selectAPISetting(apiURL, apiKey, modelName, parallel, timeLimit)

    let results
    let token_usage = 0
    if (selectRepository.value.length > 0) {
      // 确保传递的参数是可序列化的
      const params = {
        model: form.value.model,
        filePath: form.value.filePath,
        repositoryNameList: [...selectRepository.value]
      }
      // 从Pinia store获取embedding配置并传递给后端
      // 确保传递可序列化的纯对象
      const { apiURL, apiKey, modelName } = embeddingStore.getAPIConfig
      // console.log("embedding settings:", { apiURL, apiKey, modelName })
      // console.log("parallel set:", apiSettingsStore.selectedApi.parallel)
      // console.log("timelimit set is:", timeLimit)
      let preResult = await electronAPI.processDocx(
        params.model,
        params.filePath,
        params.repositoryNameList,
        { apiURL, apiKey, modelName },
        timeLimit,
        apiSettingsStore.selectedApi.parallel,
        apiSettingsStore.reviewModelId ?? null
      )
      console.log('校对结果和token消耗量：', preResult)
      if ('message' in preResult) {
        if (preResult.message === 'Please select an API setting!') {
          ElMessage({
            message: '请先设置API密钥',
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
      const params = {
        model: form.value.model,
        filePath: form.value.filePath
      }
      console.log('parallel set is:', apiSettingsStore.selectedApi.parallel)
      console.log('timelimit set is:', timeLimit)
      let preResult = await electronAPI.processDocx(
        params.model,
        params.filePath,
        undefined,
        undefined,
        timeLimit,
        apiSettingsStore.selectedApi.parallel,
        apiSettingsStore.reviewModelId ?? null
      )
      console.log('校对结果和token消耗量：', preResult)
      // 检查后端返回的错误消息
      if ('message' in preResult) {
        if (preResult.message === 'Please select an API setting!') {
          ElMessage({
            message: '请先设置API密钥',
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
    apiSettingsStore.addTotalTokens(token_usage) // 将本次使用的token加入到总的token消耗量中

    ElMessage({
      message: '处理成功,本次任务消耗token: ' + toString(token_usage),
      type: 'success',
      duration: 2000
    })

    // 确保结果是数组格式
    finishProgress()
    const finalResults = Array.isArray(results) ? results : []

    // 调试：打印第一个结果的结构
    console.log('校对结果数量:', finalResults.length)
    if (finalResults.length > 0) {
      console.log('第一个校对项的数据结构:', JSON.stringify(finalResults[0], null, 2))
    }

    // 过滤掉被审核标记为抛弃的结果，仅保留有效建议
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
    proofreadingResults.value = validResults.map((item, index) => ({
      ...item,
      id: `correction-${index}`,
      applied: false
    }))

    // 将结果保存到数据库（仅保存未过滤的有效结果）
    if (validResults.length > 0) {
      await pushToDB(validResults)
    } else {
      console.log('无校对结果，跳过保存历史记录')
    }

    // 关键：等待DOM更新后再高亮
    await nextTick()
    highlightCorrections()

    if (finalResults.length > 0) {
      activeNames.value = [0]
    }
  } catch (err) {
    clearFakeProgressTimer()
    clearCloseProgressTimer()
    progressDialogVisible.value = false
    progressDetail.value = ''
    error.value = `校对处理失败: ${err.message}`
    console.error('校对处理异常:', err)
    ElMessage({
      message: '校对处理失败: ' + err.message,
      type: 'error',
      duration: 3000
    })
  } finally {
    clearFakeProgressTimer()
    processing.value = false
  }
}

const renderDocx = async file => {
  try {
    // 清空之前的预览内容
    if (previewContainer.value) {
      previewContainer.value.innerHTML = ''

      // 渲染 DOCX 文件
      await renderAsync(file, previewContainer.value)
    } else {
      throw new Error('预览容器未初始化')
    }
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

    const blob = new Blob(byteArrays, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    const file = new File([blob], fileName.value, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })

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
  if (proofreadingResults.value.length === 0) return

  try {
    exporting.value = true

    // 获取当前预览内容（包含已应用的修改）
    const container = previewContainer.value
    if (!container) throw new Error('预览内容为空')

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
    }

    // Call Electron API to export the corrected file
    const result = await electronAPI.exportCorrectedDocx(exportConfig)
    console.log('export result:', result)

    if (result?.canceled) {
      return
    }

    if (result?.success) {
      ElMessage({
        message: `\u6587\u4ef6\u5bfc\u51fa\u6210\u529f\uff1a${result.filePath || ''}`,
        type: 'success',
        duration: 2000
      })
    } else {
      throw new Error('\u5bfc\u51fa\u8fc7\u7a0b\u672a\u5b8c\u6210')
    }
  } catch (err) {
    console.error('导出错误:', err)
    ElMessage({
      message: `\u5bfc\u51fa\u5931\u8d25: ${err.message}`,
      type: 'error',
      duration: 3000
    })
  } finally {
    exporting.value = false
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
const initProofreadProgressListener = () => {
  if (proofreadProgressUnsubscribe) {
    proofreadProgressUnsubscribe()
  }
  proofreadProgressUnsubscribe = electronAPI.onProofreadProgress(handleProofreadProgress)
}

onMounted(async () => {
  if (!window.electronAPI) {
    error.value = 'Electron 环境未正确加载...'
    return
  }
  initProofreadProgressListener()
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
      const blob = new Blob(byteArrays, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      const file = new File([blob], fileStore.fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
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

onUnmounted(() => {
  clearFakeProgressTimer()
  clearCloseProgressTimer()
  if (previewFocusTimer) {
    clearTimeout(previewFocusTimer)
    previewFocusTimer = null
  }
  if (proofreadProgressUnsubscribe) {
    proofreadProgressUnsubscribe()
    proofreadProgressUnsubscribe = null
  }
})
</script>

<style>
/* 暗黑模式样式 */
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

html.dark .proofreading-sidebar {
  background-color: #141414;
  border-left-color: #2c2e30;
}

html.dark .sidebar-header {
  background-color: #1d1e1f;
  border-bottom-color: #2c2e30;
}

html.dark .correction-item {
  background-color: #1d1e1f;
  border-color: #2c2e30;
}

html.dark .correction-item:hover {
  border-color: #4c4d4f;
}

html.dark .correction-header {
  background-color: #1d1e1f;
}

html.dark .correction-content {
  background-color: #141414;
  border-top-color: #2c2e30;
}

html.dark .correction-content > div {
  color: #e4e7ed;
}

html.dark .correction-content strong {
  color: #f2f3f5;
}

html.dark .actions {
  border-top-color: #2c2e30;
}

html.dark .reference-item {
  background: #1d1e1f;
  border-left-color: #409eff;
}

html.dark .reference-item:hover {
  background: #252627;
}

html.dark .reference-text {
  color: #e4e7ed;
}

html.dark .reference-content h4 {
  color: #f2f3f5;
}

/* 内联进度条暗黑模式 */
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

/* 文档预览区域暗黑模式样式 */
html.dark .preview-container {
  background-color: #1d1e1f;
}

/* docx-preview 生成的文档结构样式覆盖 */
html.dark .preview-container section.docx {
  background-color: #1d1e1f;
}

html.dark .preview-container .docx-wrapper {
  background-color: #1d1e1f;
  padding: 0;
}

/* 段落和文字样式 */
html.dark .preview-container p,
html.dark .preview-container span,
html.dark .preview-container div,
html.dark .preview-container li,
html.dark .preview-container td,
html.dark .preview-container th {
  color: #e4e7ed !important;
}

/* 标题样式 */
html.dark .preview-container h1,
html.dark .preview-container h2,
html.dark .preview-container h3,
html.dark .preview-container h4,
html.dark .preview-container h5,
html.dark .preview-container h6 {
  color: #f2f3f5 !important;
}

/* 表格样式 */
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

/* 列表样式 */
html.dark .preview-container ul,
html.dark .preview-container ol {
  color: #e4e7ed;
}

/* 代码块样式 */
html.dark .preview-container pre,
html.dark .preview-container code {
  background-color: #141414 !important;
  color: #e4e7ed !important;
}

/* 链接样式 */
html.dark .preview-container a {
  color: #75c777 !important;
}

/* 引用样式 */
html.dark .preview-container blockquote {
  border-left-color: #4c4d4f !important;
  background-color: #141414 !important;
  color: #e4e7ed !important;
}

/* 图片容器 */
html.dark .preview-container img {
  filter: brightness(0.9) contrast(1.1);
}

/* 分隔线 */
html.dark .preview-container hr {
  border-color: #2c2e30 !important;
}

/* 全局高亮样式 - 必须放在非scoped样式中 */
.highlight-correction {
  --highlight-bg: rgba(255, 214, 102, 0.5);
  --highlight-bg-hover: rgba(255, 214, 102, 0.7);
  --highlight-bg-focus: rgba(255, 214, 102, 0.92);
  --highlight-border: #ffb300;
  --highlight-ring: rgba(255, 179, 0, 0.28);
  background-color: var(--highlight-bg) !important;
  border-bottom: 2px solid var(--highlight-border) !important;
  cursor: pointer !important;
  padding: 1px 3px !important;
  border-radius: 3px !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--highlight-border) 28%, transparent) !important;
}

.highlight-correction:hover {
  box-shadow: 0 0 0 3px var(--highlight-ring) !important;
  background-color: var(--highlight-bg-hover) !important;
  transform: translateY(-1px) !important;
}

.highlight-correction-focused {
  background-color: var(--highlight-bg-focus) !important;
  animation: correction-highlight-pulse 0.8s ease-in-out 3 !important;
}

.highlight-type-typo,
.highlight-type-worderror,
.highlight-type-错别字 {
  --highlight-bg: rgba(245, 108, 108, 0.24);
  --highlight-bg-hover: rgba(245, 108, 108, 0.34);
  --highlight-bg-focus: rgba(245, 108, 108, 0.48);
  --highlight-border: #e36262;
  --highlight-ring: rgba(245, 108, 108, 0.32);
}

.highlight-type-punctuation,
.highlight-type-标点 {
  --highlight-bg: rgba(230, 162, 60, 0.24);
  --highlight-bg-hover: rgba(230, 162, 60, 0.34);
  --highlight-bg-focus: rgba(230, 162, 60, 0.48);
  --highlight-border: #d89020;
  --highlight-ring: rgba(230, 162, 60, 0.3);
}

.highlight-type-grammar,
.highlight-type-语法 {
  --highlight-bg: rgba(64, 158, 255, 0.24);
  --highlight-bg-hover: rgba(64, 158, 255, 0.34);
  --highlight-bg-focus: rgba(64, 158, 255, 0.48);
  --highlight-border: #3a8ee6;
  --highlight-ring: rgba(64, 158, 255, 0.32);
}

.highlight-type-consistency,
.highlight-type-一致性 {
  --highlight-bg: rgba(144, 147, 152, 0.24);
  --highlight-bg-hover: rgba(144, 147, 152, 0.34);
  --highlight-bg-focus: rgba(144, 147, 152, 0.48);
  --highlight-border: #828282;
  --highlight-ring: rgba(144, 147, 152, 0.3);
}

.highlight-type-comprehensiveerror,
.highlight-type-polish,
.highlight-type-综合错误,
.highlight-type-润色建议 {
  --highlight-bg: rgba(103, 194, 58, 0.24);
  --highlight-bg-hover: rgba(103, 194, 58, 0.34);
  --highlight-bg-focus: rgba(103, 194, 58, 0.48);
  --highlight-border: #5baa3a;
  --highlight-ring: rgba(103, 194, 58, 0.3);
}

@keyframes correction-highlight-pulse {
  0% {
    box-shadow:
      0 0 0 0 var(--highlight-ring),
      0 1px 3px color-mix(in srgb, var(--highlight-border) 28%, transparent);
    transform: translateY(0);
  }
  50% {
    box-shadow:
      0 0 0 7px color-mix(in srgb, var(--highlight-border) 16%, transparent),
      0 0 18px color-mix(in srgb, var(--highlight-border) 34%, transparent);
    transform: translateY(-1px);
  }
  100% {
    box-shadow:
      0 0 0 0 var(--highlight-ring),
      0 1px 3px color-mix(in srgb, var(--highlight-border) 28%, transparent);
    transform: translateY(0);
  }
}

/* 内联进度条样式 */
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

/* 内联进度条过渡动画 */
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
/* 参考内容样式 */
.reference-content {
  padding: 12px 4px;
}

.reference-content h4 {
  margin: 0 0 14px 0;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.reference-list {
  max-height: 300px;
  overflow-y: auto;
}

.reference-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #409eff;
  line-height: 1.6;
  transition: all 0.2s ease;
}

.reference-item:hover {
  background: #f0f2f5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.reference-item:last-child {
  margin-bottom: 0;
}

.reference-index {
  color: #409eff;
  font-weight: 600;
  margin-right: 10px;
  min-width: 22px;
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
/* 全局弹窗样式 */
.reference-popover {
  max-width: 500px;
  text-align: center;
}

.reference-popover .el-popover__title {
  margin-bottom: 12px;
  color: #303133;
  font-weight: 600;
  text-align: center;
}
</style>

<style scoped>
.app-container {
  height: 100%;
  position: relative;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.error-alert {
  margin: 15px;
  border-radius: 8px;
}

.action-bar {
  padding: 8px 20px;
  height: auto !important;
  border-bottom: 1px solid #e4e7ed;
  background-color: #fff;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.preview-area {
  padding: 0;
  overflow: hidden;
  width: 70%;
}

.preview-container {
  height: 100%;
  overflow: auto;
  padding: 32px;
  margin: 0;
  background-color: #fff;
  transition: box-shadow 0.2s ease;
}

.preview-container:hover {
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.06);
}

.proofreading-sidebar {
  width: 30%;
  border-left: 1px solid #e4e7ed;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #fafbfc;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.apply-all-button {
  width: 100%;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.apply-all-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.category-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.category-typo,
.category-worderror,
.category-错别字 {
  background-color: #f56c6c;
}

.category-punctuation,
.category-标点 {
  background-color: #e6a23c;
}

.category-grammar,
.category-语法 {
  background-color: #409eff;
}

.category-consistency,
.category-一致性 {
  background-color: #909399;
}

.category-comprehensiveerror,
.category-综合错误,
.category-polish,
.category-润色建议 {
  background-color: #67c23a;
}

.results-container {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.correction-item {
  margin-bottom: 12px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid #e4e7ed;
  background-color: #fff;
  transition: all 0.2s ease;
}

.correction-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #c0c4cc;
}

.correction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background-color: #fff;
}

.correction-type {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.correction-count {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
}

.correction-content {
  padding: 18px;
  border-top: 1px solid #e4e7ed;
  background-color: #fafbfc;
}

.correction-content > div {
  margin-bottom: 14px;
  line-height: 1.7;
  color: #606266;
}

.correction-content strong {
  color: #303133;
  min-width: 50px;
  display: inline-block;
  font-weight: 600;
}

.actions {
  margin-top: 16px;
  text-align: right;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
}

.actions .el-button {
  transition: all 0.2s ease;
  border-radius: 6px;
}

.actions .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #909399;
}

/* 根据校对类型设置颜色 - 简约现代风格 */
.type-typo,
.type-错别字,
.type-worderror {
  background-color: rgba(245, 108, 108, 0.12);
  color: #e36262;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.type-punctuation,
.type-标点 {
  background-color: rgba(230, 162, 60, 0.12);
  color: #d89020;
  border: 1px solid rgba(230, 162, 60, 0.2);
}

.type-grammar,
.type-语法 {
  background-color: rgba(64, 158, 255, 0.12);
  color: #3a8ee6;
  border: 1px solid rgba(64, 158, 255, 0.2);
}

.type-consistency,
.type-一致性 {
  background-color: rgba(144, 147, 152, 0.12);
  color: #828282;
  border: 1px solid rgba(144, 147, 152, 0.2);
}

.type-comprehensiveerror,
.type-综合错误,
.type-polish,
.type-润色建议 {
  background-color: rgba(103, 194, 58, 0.12);
  color: #5baa3a;
  border: 1px solid rgba(103, 194, 58, 0.2);
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
