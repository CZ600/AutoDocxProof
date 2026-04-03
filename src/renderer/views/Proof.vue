<template>
  <div class="proof-results-panel">
    <div class="panel-header">
      <el-dropdown placement="bottom" trigger="click">
        <el-button type="primary" :disabled="proofreadingResults.length === 0" class="apply-all-button">
          <span>{{ t('proof.applyChanges') }}</span>
          <el-icon><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="applyALLCorrection()">
              <el-icon style="margin-right: 8px"><Select /></el-icon>
              {{ t('proof.applyAllCount', { count: proofreadingResults.filter(r => !r.applied).length }) }}
            </el-dropdown-item>
            <el-dropdown-item divided>
              <span style="font-weight: 600; color: #606266">{{ t('proof.applyByCategory') }}</span>
            </el-dropdown-item>
            <el-dropdown-item v-for="cat in availableCategories" :key="cat.value" @click="applyByCategory(cat.value)">
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
            <div class="original">
              <strong>{{ t('proof.original') }}</strong> {{ item.original || t('proof.noData') }}
            </div>
            <div class="suggested">
              <strong>{{ t('proof.suggested') }}</strong> {{ item.suggested || t('proof.noData') }}
            </div>
            <div class="reason">
              <strong>{{ t('proof.reason') }}</strong> {{ item.reason || t('proof.noData') }}
            </div>
            <div class="actions">
              <el-button type="primary" size="small" @click.stop="applyCorrection(index)" :disabled="item.applied">
                {{ item.applied ? t('proof.applied') : t('proof.applyChanges') }}
              </el-button>
              <el-popover placement="bottom-start" width="500px" trigger="click" popper-class="reference-popover">
                <template #reference>
                  <el-button type="primary" size="small" style="margin-left: 8px" @click.stop>
                    {{ t('proof.viewReference') }}
                  </el-button>
                </template>

                <div class="reference-content">
                  <h4>{{ t('proof.referenceContent') }}</h4>
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
      <el-empty :description="fileName ? t('proof.noResults') : t('proof.selectDocToProof')" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElButton, ElEmpty, ElCollapse, ElCollapseItem, ElMessage, ElPopover } from 'element-plus'
import { ArrowDown, Select } from '@element-plus/icons-vue'
import { scrollTo } from 'vue-scrollto'
import { fileInfoStore } from '../stores/store'

const previewContainer = inject('previewContainer')
const fileStore = fileInfoStore()
const fileName = computed(() => fileStore.fileName)
const proofreadingResults = computed({
  get: () => fileStore.results,
  set: val => fileStore.setCorrectResult(val)
})
const activeNames = ref([])
let previewFocusTimer = null

const formatCorrectionType = type => {
  const typeMap = {
    Typo: t('proof.correctionTypes.Typo'),
    Punctuation: t('proof.correctionTypes.Punctuation'),
    Grammar: t('proof.correctionTypes.Grammar'),
    Consistency: t('proof.correctionTypes.Consistency'),
    wordError: t('proof.correctionTypes.wordError'),
    ComprehensiveError: t('proof.correctionTypes.ComprehensiveError'),
    polish: t('proof.correctionTypes.polish')
  }
  return typeMap[type] || type
}

const normalizeCorrectionType = type => {
  return (type || '').toString().trim().toLowerCase()
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

const applyCorrection = index => {
  const newResults = [...proofreadingResults.value]
  newResults[index] = { ...newResults[index], applied: true }
  proofreadingResults.value = newResults
  const container = previewContainer.value
  if (!container) return
  const updated = replaceCorrectionInPreview(container, newResults[index])
  highlightCorrections()
  if (updated) {
    ElMessage.success(t('proof.messages.applied'))
  } else {
    ElMessage.warning(t('proof.messages.notLocatedInPreview'))
  }
}

const availableCategories = computed(() => {
  const typeMap = {
    Typo: t('proof.correctionTypes.Typo'),
    Punctuation: t('proof.correctionTypes.Punctuation'),
    Grammar: t('proof.correctionTypes.Grammar'),
    Consistency: t('proof.correctionTypes.Consistency'),
    wordError: t('proof.correctionTypes.wordError'),
    ComprehensiveError: t('proof.correctionTypes.ComprehensiveError'),
    polish: t('proof.correctionTypes.polish')
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

const getCategoryCount = type => {
  const count = proofreadingResults.value.filter(item => !item.applied && item.type === type).length
  return t('proof.messages.countItems', { count })
}

const applyByCategory = type => {
  const applicableResults = proofreadingResults.value.filter(item => !item.applied && item.type === type)
  if (applicableResults.length === 0) {
    ElMessage.warning(t('proof.messages.noPendingInCategory'))
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
    ElMessage.success(t('proof.messages.appliedAllType', { typeLabel }))
  } else {
    ElMessage.warning(
      t('proof.messages.appliedPartialType', { replaced: replacedCount, total: applicableResults.length, typeLabel })
    )
  }
}

const applyALLCorrection = () => {
  const applicableResults = proofreadingResults.value.filter(item => !item.applied)
  if (applicableResults.length === 0) {
    ElMessage.warning(t('proof.messages.noPendingChanges'))
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
    ElMessage.success(t('proof.messages.appliedAll'))
  } else {
    ElMessage.warning(t('proof.messages.appliedPartial', { replaced: replacedCount, total: applicableResults.length }))
  }
}

watch(
  () => fileStore.results,
  newResults => {
    if (newResults.length > 0) {
      nextTick(() => highlightCorrections())
      activeNames.value = [0]
    }
  }
)

onMounted(async () => {
  if (proofreadingResults.value.length > 0) {
    await nextTick()
    highlightCorrections()
    activeNames.value = [0]
  }
})

onUnmounted(() => {
  if (previewFocusTimer) {
    clearTimeout(previewFocusTimer)
    previewFocusTimer = null
  }
})
</script>

<style>
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

html.dark .panel-header {
  background-color: #1d1e1f;
  border-bottom-color: #2c2e30;
}

html.dark .proof-results-panel {
  background-color: #141414;
}

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
.proof-results-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fafbfc;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  flex-shrink: 0;
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

.results-container {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

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
</style>
