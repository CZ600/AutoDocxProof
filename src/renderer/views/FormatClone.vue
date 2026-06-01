<template>
  <div class="format-clone-panel">
    <div class="clone-header">
      <span class="header-title">{{ t('proof.formatClone.title') }}</span>
      <el-button text size="small" @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon>
        {{ t('proof.formatClone.back') }}
      </el-button>
    </div>

    <div class="clone-body">
      <!-- 模式切换 Tab -->
      <div class="mode-tabs">
        <button
          class="mode-tab"
          :class="{ active: inputMode === 'ref' }"
          @click="inputMode = 'ref'"
        >{{ t('proof.formatClone.selectRef') }}</button>
        <button
          class="mode-tab"
          :class="{ active: inputMode === 'desc' }"
          @click="inputMode = 'desc'"
        >{{ t('proof.formatFromDesc.tabTitle') }}</button>
      </div>

      <!-- 模式1: 选择参考文档 -->
      <template v-if="inputMode === 'ref'">
        <div class="ref-file-row">
          <el-button size="small" @click="selectRefFile" :loading="selectingRef">
            {{ t('proof.formatClone.selectRef') }}
          </el-button>
          <el-tooltip v-if="refFileName" :content="refFileName" placement="bottom">
            <span class="ref-file-name">{{ truncatedName(refFileName) }}</span>
          </el-tooltip>
        </div>
      </template>

      <!-- 模式2: 从描述生成 -->
      <template v-if="inputMode === 'desc'">
        <div class="desc-input-area">
          <div class="desc-file-row">
            <el-button size="small" @click="selectDescFile" :loading="selectingDescFile">
              {{ t('proof.formatFromDesc.selectFile') }}
            </el-button>
            <el-tooltip v-if="descFileName" :content="descFileName" placement="bottom">
              <span class="ref-file-name">{{ truncatedName(descFileName) }}</span>
            </el-tooltip>
          </div>
          <textarea
            class="desc-textarea"
            v-model="descText"
            :placeholder="t('proof.formatFromDesc.placeholder')"
            rows="6"
          ></textarea>
          <el-button
            type="primary"
            size="small"
            class="generate-btn"
            @click="generateFromDesc"
            :loading="generating"
            :disabled="!descText.trim()"
          >
            {{ generating ? t('proof.formatFromDesc.generating') : t('proof.formatFromDesc.generate') }}
          </el-button>
        </div>
      </template>

      <div v-if="formatItems.length > 0" class="format-list">
        <el-collapse v-model="activeNames">
          <el-collapse-item
            v-for="(item, index) in formatItems"
            :key="index"
            :name="index"
            class="format-item"
          >
            <template #title>
              <div class="format-item-header">
                <span class="format-name">{{ item.name }}</span>
                <span class="format-type-badge">{{ item.type }}</span>
              </div>
            </template>
            <div class="format-detail">
              <div v-if="item.paragraphStyle && Object.keys(item.paragraphStyle).length > 0" class="style-section">
                <strong>{{ t('proof.formatClone.paragraphStyle') }}</strong>
                <div class="style-props">
                  <div v-for="(val, key) in item.paragraphStyle" :key="key" class="style-prop">
                    <span class="prop-key">{{ key }}</span>
                    <span class="prop-val">
                      <template v-if="isBoolField(val)">
                        <button class="toggle-btn" :class="{ on: val }" @click="toggleStyleProp(item, 'paragraphStyle', key)">
                          {{ val }}
                        </button>
                      </template>
                      <template v-else-if="isStepperField(key)">
                        <span class="stepper">
                          <button class="step-btn" @click="stepValue(item, 'paragraphStyle', key, -1)">−</button>
                          <span class="stepper-val">{{ val }}</span>
                          <button class="step-btn" @click="stepValue(item, 'paragraphStyle', key, 1)">+</button>
                        </span>
                      </template>
                      <template v-else-if="isColorField(key)">
                        <el-popover placement="bottom" :width="200" trigger="click">
                          <template #reference>
                            <span class="color-chip">
                              <span class="color-swatch" :style="{ background: toHex(val) }"></span>
                              {{ val }}
                            </span>
                          </template>
                          <input type="color" :value="toHex(val)" @change="setColor(item, 'paragraphStyle', key, $event)" />
                        </el-popover>
                      </template>
                      <template v-else-if="isSpacingField(key)">
                        <span class="spacing-row">
                          <template v-if="val.before !== undefined">
                            <span class="spacing-label">before</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'before', -1)">−</button>
                            <span class="stepper-val">{{ val.before }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'before', 1)">+</button>
                          </template>
                          <template v-if="val.after !== undefined">
                            <span class="spacing-label">after</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'after', -1)">−</button>
                            <span class="stepper-val">{{ val.after }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'after', 1)">+</button>
                          </template>
                          <template v-if="val.line !== undefined">
                            <span class="spacing-label">line</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'line', -1)">−</button>
                            <span class="stepper-val">{{ val.line }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'paragraphStyle', 'line', 1)">+</button>
                          </template>
                          <template v-for="(sv, sk) in val" :key="sk">
                            <template v-if="sk !== 'before' && sk !== 'after' && sk !== 'line'">
                              <span class="spacing-label">{{ sk }}</span>
                              <span class="spacing-other">{{ sv }}</span>
                            </template>
                          </template>
                        </span>
                      </template>
                      <template v-else>
                        {{ formatPropVal(val) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="item.runStyle && Object.keys(item.runStyle).length > 0" class="style-section">
                <strong>{{ t('proof.formatClone.runStyle') }}</strong>
                <div class="style-props">
                  <div v-for="(val, key) in item.runStyle" :key="key" class="style-prop">
                    <span class="prop-key">{{ key }}</span>
                    <span class="prop-val">
                      <template v-if="isBoolField(val)">
                        <button class="toggle-btn" :class="{ on: val }" @click="toggleStyleProp(item, 'runStyle', key)">
                          {{ val }}
                        </button>
                      </template>
                      <template v-else-if="isStepperField(key)">
                        <span class="stepper">
                          <button class="step-btn" @click="stepValue(item, 'runStyle', key, -1)">−</button>
                          <span class="stepper-val">{{ val }}</span>
                          <button class="step-btn" @click="stepValue(item, 'runStyle', key, 1)">+</button>
                        </span>
                      </template>
                      <template v-else-if="isColorField(key)">
                        <el-popover placement="bottom" :width="200" trigger="click">
                          <template #reference>
                            <span class="color-chip">
                              <span class="color-swatch" :style="{ background: toHex(val) }"></span>
                              {{ val }}
                            </span>
                          </template>
                          <input type="color" :value="toHex(val)" @change="setColor(item, 'runStyle', key, $event)" />
                        </el-popover>
                      </template>
                      <template v-else-if="isSpacingField(key)">
                        <span class="spacing-row">
                          <template v-if="val.before !== undefined">
                            <span class="spacing-label">before</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'before', -1)">−</button>
                            <span class="stepper-val">{{ val.before }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'before', 1)">+</button>
                          </template>
                          <template v-if="val.after !== undefined">
                            <span class="spacing-label">after</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'after', -1)">−</button>
                            <span class="stepper-val">{{ val.after }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'after', 1)">+</button>
                          </template>
                          <template v-if="val.line !== undefined">
                            <span class="spacing-label">line</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'line', -1)">−</button>
                            <span class="stepper-val">{{ val.line }}</span>
                            <button class="step-btn" @click="stepSpacing(item, 'runStyle', 'line', 1)">+</button>
                          </template>
                          <template v-for="(sv, sk) in val" :key="sk">
                            <template v-if="sk !== 'before' && sk !== 'after' && sk !== 'line'">
                              <span class="spacing-label">{{ sk }}</span>
                              <span class="spacing-other">{{ sv }}</span>
                            </template>
                          </template>
                        </span>
                      </template>
                      <template v-else>
                        {{ formatPropVal(val) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <div v-if="defaults" class="defaults-section">
        <el-collapse v-model="defaultsActive">
          <el-collapse-item name="defaults">
            <template #title>
              <div class="format-item-header">
                <span class="format-name">{{ t('proof.formatClone.defaults') }}</span>
              </div>
            </template>
            <div class="format-detail">
              <div v-if="defaults.paragraphStyle && Object.keys(defaults.paragraphStyle).length > 0" class="style-section">
                <strong>{{ t('proof.formatClone.paragraphStyle') }}</strong>
                <div class="style-props">
                  <div v-for="(val, key) in defaults.paragraphStyle" :key="key" class="style-prop">
                    <span class="prop-key">{{ key }}</span>
                    <span class="prop-val">
                      <template v-if="isBoolField(val)">
                        <button class="toggle-btn" :class="{ on: val }" @click="toggleDefaultsProp('paragraphStyle', key)">
                          {{ val }}
                        </button>
                      </template>
                      <template v-else-if="isStepperField(key)">
                        <span class="stepper">
                          <button class="step-btn" @click="stepDefaultsValue('paragraphStyle', -1)">−</button>
                          <span class="stepper-val">{{ val }}</span>
                          <button class="step-btn" @click="stepDefaultsValue('paragraphStyle', 1)">+</button>
                        </span>
                      </template>
                      <template v-else-if="isColorField(key)">
                        <el-popover placement="bottom" :width="200" trigger="click">
                          <template #reference>
                            <span class="color-chip">
                              <span class="color-swatch" :style="{ background: toHex(val) }"></span>
                              {{ val }}
                            </span>
                          </template>
                          <input type="color" :value="toHex(val)" @change="setDefaultsColor('paragraphStyle', key, $event)" />
                        </el-popover>
                      </template>
                      <template v-else-if="isSpacingField(key)">
                        <span class="spacing-row">
                          <template v-if="val.before !== undefined">
                            <span class="spacing-label">before</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'before', -1)">−</button>
                            <span class="stepper-val">{{ val.before }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'before', 1)">+</button>
                          </template>
                          <template v-if="val.after !== undefined">
                            <span class="spacing-label">after</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'after', -1)">−</button>
                            <span class="stepper-val">{{ val.after }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'after', 1)">+</button>
                          </template>
                          <template v-if="val.line !== undefined">
                            <span class="spacing-label">line</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'line', -1)">−</button>
                            <span class="stepper-val">{{ val.line }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('paragraphStyle', 'line', 1)">+</button>
                          </template>
                          <template v-for="(sv, sk) in val" :key="sk">
                            <template v-if="sk !== 'before' && sk !== 'after' && sk !== 'line'">
                              <span class="spacing-label">{{ sk }}</span>
                              <span class="spacing-other">{{ sv }}</span>
                            </template>
                          </template>
                        </span>
                      </template>
                      <template v-else>
                        {{ formatPropVal(val) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="defaults.runStyle && Object.keys(defaults.runStyle).length > 0" class="style-section">
                <strong>{{ t('proof.formatClone.runStyle') }}</strong>
                <div class="style-props">
                  <div v-for="(val, key) in defaults.runStyle" :key="key" class="style-prop">
                    <span class="prop-key">{{ key }}</span>
                    <span class="prop-val">
                      <template v-if="isBoolField(val)">
                        <button class="toggle-btn" :class="{ on: val }" @click="toggleDefaultsProp('runStyle', key)">
                          {{ val }}
                        </button>
                      </template>
                      <template v-else-if="isStepperField(key)">
                        <span class="stepper">
                          <button class="step-btn" @click="stepDefaultsValue('runStyle', -1)">−</button>
                          <span class="stepper-val">{{ val }}</span>
                          <button class="step-btn" @click="stepDefaultsValue('runStyle', 1)">+</button>
                        </span>
                      </template>
                      <template v-else-if="isColorField(key)">
                        <el-popover placement="bottom" :width="200" trigger="click">
                          <template #reference>
                            <span class="color-chip">
                              <span class="color-swatch" :style="{ background: toHex(val) }"></span>
                              {{ val }}
                            </span>
                          </template>
                          <input type="color" :value="toHex(val)" @change="setDefaultsColor('runStyle', key, $event)" />
                        </el-popover>
                      </template>
                      <template v-else-if="isSpacingField(key)">
                        <span class="spacing-row">
                          <template v-if="val.before !== undefined">
                            <span class="spacing-label">before</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'before', -1)">−</button>
                            <span class="stepper-val">{{ val.before }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'before', 1)">+</button>
                          </template>
                          <template v-if="val.after !== undefined">
                            <span class="spacing-label">after</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'after', -1)">−</button>
                            <span class="stepper-val">{{ val.after }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'after', 1)">+</button>
                          </template>
                          <template v-if="val.line !== undefined">
                            <span class="spacing-label">line</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'line', -1)">−</button>
                            <span class="stepper-val">{{ val.line }}</span>
                            <button class="step-btn" @click="stepDefaultsSpacing('runStyle', 'line', 1)">+</button>
                          </template>
                          <template v-for="(sv, sk) in val" :key="sk">
                            <template v-if="sk !== 'before' && sk !== 'after' && sk !== 'line'">
                              <span class="spacing-label">{{ sk }}</span>
                              <span class="spacing-other">{{ sv }}</span>
                            </template>
                          </template>
                        </span>
                      </template>
                      <template v-else>
                        {{ formatPropVal(val) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElButton, ElCollapse, ElCollapseItem, ElMessage, ElTooltip, ElIcon, ElPopover } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useApiStore } from '../stores/apiStore'

defineEmits(['back'])

const electronAPI = window.electronAPI
const apiStore = useApiStore()

// 注入来自 App.vue 的共享状态（跨兄弟组件）
const targetFilePath = inject('formatCloneTargetFilePath')
const refFilePath = inject('formatCloneRefFilePath')
const clonedFilePath = inject('formatCloneClonedFilePath')
const cloning = inject('formatCloneCloning')
const exporting = inject('formatCloneExporting')
const formatItems = inject('formatCloneFormatItems')
const defaults = inject('formatCloneDefaults')
const doClone = inject('formatCloneDoClone')
const doExport = inject('formatCloneDoExport')
const buildProfile = inject('formatCloneBuildProfile')

// 仅在本组件内使用的本地状态
const refFileName = ref('')
const selectingRef = ref(false)
const activeNames = ref([])
const defaultsActive = ref([])

// ---- 从描述生成相关状态 ----
const inputMode = ref('ref') // 'ref' | 'desc'
const descText = ref('')
const descFileName = ref('')
const selectingDescFile = ref(false)
const generating = ref(false)

const truncatedName = name => (name.length > 20 ? name.slice(0, 20) + '...' : name)

const isBoolField = val => typeof val === 'boolean'
const isStepperField = key => key === 'fontSize' || key === 'outlineLevel'
const isColorField = key => key === 'color' || key === 'highlight'
const isSpacingField = key => key === 'spacing'

const toHex = v => {
  if (!v || typeof v !== 'string') return '#000000'
  return v.startsWith('#') ? v : '#' + v
}

const fromHex = v => (v || '').replace('#', '').toUpperCase()

const formatPropVal = val => {
  if (typeof val === 'object' && val !== null) {
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return String(val)
}

const toggleStyleProp = (item, styleType, key) => {
  item[styleType][key] = !item[styleType][key]
}

const stepValue = (item, styleType, fieldKey, delta) => {
  const cur = parseInt(item[styleType][fieldKey]) || 0
  const max = fieldKey === 'outlineLevel' ? 9 : 200
  const min = fieldKey === 'outlineLevel' ? 0 : 6
  const step = fieldKey === 'outlineLevel' ? 1 : 2
  const next = Math.max(min, Math.min(max, cur + delta * step))
  item[styleType][fieldKey] = String(next)
}

const stepSpacing = (item, styleType, fieldKey, delta) => {
  const cur = parseInt(item[styleType].spacing[fieldKey]) || 0
  const next = Math.max(0, cur + delta * 20)
  item[styleType].spacing[fieldKey] = String(next)
}

const setColor = (item, styleType, key, event) => {
  item[styleType][key] = fromHex(event.target.value)
}

const toggleDefaultsProp = (styleType, key) => {
  if (!defaults.value[styleType]) return
  defaults.value[styleType][key] = !defaults.value[styleType][key]
}

const stepDefaultsValue = (styleType, fieldKey, delta) => {
  if (!defaults.value[styleType]) return
  const cur = parseInt(defaults.value[styleType][fieldKey]) || 0
  const max = fieldKey === 'outlineLevel' ? 9 : 200
  const min = fieldKey === 'outlineLevel' ? 0 : 6
  const step = fieldKey === 'outlineLevel' ? 1 : 2
  const next = Math.max(min, Math.min(max, cur + delta * step))
  defaults.value[styleType][fieldKey] = String(next)
}

const stepDefaultsSpacing = (styleType, fieldKey, delta) => {
  if (!defaults.value[styleType] || !defaults.value[styleType].spacing) return
  const cur = parseInt(defaults.value[styleType].spacing[fieldKey]) || 0
  const next = Math.max(0, cur + delta * 20)
  defaults.value[styleType].spacing[fieldKey] = String(next)
}

const setDefaultsColor = (styleType, key, event) => {
  if (!defaults.value[styleType]) return
  defaults.value[styleType][key] = fromHex(event.target.value)
}

const selectRefFile = async () => {
  selectingRef.value = true
  try {
    const filePath = await electronAPI.selectDocxFile()
    if (!filePath) return

    refFilePath.value = filePath
    refFileName.value = filePath.split('\\').pop().split('/').pop()
    clonedFilePath.value = ''

    const profile = await electronAPI.getFormatProfile(filePath)
    defaults.value = profile.defaults || null

    const items = []
    for (const [id, style] of Object.entries(profile.styles || {})) {
      items.push({
        id,
        name: style.name || id,
        type: style.type || 'paragraph',
        paragraphStyle: { ...style.paragraphStyle } || {},
        runStyle: { ...style.runStyle } || {}
      })
    }
    formatItems.value = items
    if (items.length > 0) activeNames.value = [0]
    if (defaults.value) defaultsActive.value = ['defaults']
  } catch (e) {
    ElMessage.error(t('proof.formatClone.extractFailed'))
  } finally {
    selectingRef.value = false
  }
}

// ---- 从描述文件读取内容 ----
const selectDescFile = async () => {
  selectingDescFile.value = true
  try {
    const filePath = await electronAPI.selectFormatDescFile()
    if (!filePath) return

    descFileName.value = filePath.split('\\').pop().split('/').pop()

    const ext = filePath.split('.').pop().toLowerCase()

    if (ext === 'docx') {
      const fileData = await electronAPI.readDocxFile(filePath)
      if (fileData && fileData.content) {
        const byteCharacters = atob(fileData.content)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: byteArray.buffer })
        descText.value = result.value || ''
      }
    } else {
      const result = await electronAPI.readTextFile(filePath)
      if (result.success) {
        descText.value = result.content
      } else {
        ElMessage.error(t('proof.formatFromDesc.readFileFailed'))
      }
    }
  } catch (e) {
    ElMessage.error(t('proof.formatFromDesc.readFileFailed'))
  } finally {
    selectingDescFile.value = false
  }
}

// ---- 调用大模型生成格式参数 ----
const generateFromDesc = async () => {
  if (!descText.value.trim()) {
    ElMessage.warning(t('proof.formatFromDesc.emptyDesc'))
    return
  }
  generating.value = true
  clonedFilePath.value = ''
  try {
    // 从 Pinia store 取当前 API 配置传给主进程，不依赖全局 api_info
    const currentApi = apiStore.selectedApi
    const apiConfig = {
      apiKey: currentApi.key,
      modelName: currentApi.name,
      apiURL: currentApi.URL,
      provider: currentApi.provider
    }
    const result = await electronAPI.formatFromDescription(descText.value.trim(), apiConfig, targetFilePath.value)
    if (!result.success) {
      ElMessage.error(result.error || t('proof.formatFromDesc.generateFailed'))
      return
    }

    const profile = result.profile
    defaults.value = profile.defaults || null

    const items = []
    for (const [id, style] of Object.entries(profile.styles || {})) {
      items.push({
        id,
        name: style.name || id,
        type: style.type || 'paragraph',
        paragraphStyle: { ...(style.paragraphStyle || {}) },
        runStyle: { ...(style.runStyle || {}) }
      })
    }
    formatItems.value = items
    if (items.length > 0) activeNames.value = [0]
    if (defaults.value) defaultsActive.value = ['defaults']

    ElMessage.success(t('proof.formatFromDesc.generateSuccess'))
  } catch (e) {
    ElMessage.error(t('proof.formatFromDesc.generateFailed'))
  } finally {
    generating.value = false
  }
}


</script>

<style scoped>
.format-clone-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #ffffff;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.clone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #edf0f4;
  flex-shrink: 0;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: #4a6580;
}

.clone-body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

/* ---- 模式切换 Tab ---- */
.mode-tabs {
  display: flex;
  gap: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #d0d5dd;
  flex-shrink: 0;
}

.mode-tab {
  flex: 1;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: #f5f6f8;
  color: #8a929e;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-tab:not(:last-child) {
  border-right: 1px solid #d0d5dd;
}

.mode-tab.active {
  background: #ffffff;
  color: #4a6580;
  font-weight: 600;
}

.mode-tab:hover:not(.active) {
  background: #edf0f4;
}

.ref-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ref-file-name {
  font-size: 12px;
  color: #5a6a7a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

/* ---- 描述输入区域 ---- */
.desc-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.desc-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desc-textarea {
  width: 100%;
  min-height: 100px;
  max-height: 200px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #4a6580;
  background: #f8fafb;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.desc-textarea:focus {
  border-color: #7b9eb8;
  background: #ffffff;
}

.desc-textarea::placeholder {
  color: #b0b8c4;
}

.generate-btn {
  align-self: flex-end;
}

.format-list {
  flex: 4;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.format-list::-webkit-scrollbar {
  display: none;
}

.defaults-section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.defaults-section::-webkit-scrollbar {
  display: none;
}

.format-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.format-item-header .format-type-badge {
  margin-left: auto;
}

.format-name {
  font-weight: 500;
  font-size: 13px;
  color: #4a6580;
}

.format-type-badge {
  font-size: 11px;
  color: #8a929e;
}

.format-detail {
  padding: 4px 0;
  min-width: 0;
  overflow-x: hidden;
}

.style-section {
  margin-bottom: 10px;
  min-width: 0;
}

.style-section strong {
  display: block;
  font-size: 12px;
  color: #7b9eb8;
  margin-bottom: 6px;
}

.style-props {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.style-prop {
  display: flex;
  align-items: center;
  font-size: 12px;
  line-height: 1.5;
  min-width: 0;
  gap: 6px;
}

.prop-key {
  color: #8a929e;
  width: 80px;
  flex-shrink: 0;
}

.prop-val {
  color: #5a6a7a;
  min-width: 0;
  overflow: hidden;
  flex: 1;
}

.toggle-btn {
  border: 1px solid #d0d5dd;
  border-radius: 4px;
  padding: 1px 10px;
  font-size: 11px;
  cursor: pointer;
  background: #f5f6f8;
  color: #8a929e;
  transition: all 0.15s;
}

.toggle-btn.on {
  background: rgba(103, 194, 58, 0.12);
  border-color: #67c23a;
  color: #5baa3a;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stepper-val {
  font-size: 12px;
  min-width: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.step-btn {
  border: 1px solid #d0d5dd;
  border-radius: 3px;
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  background: #f5f6f8;
  color: #5a6a7a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.step-btn:hover {
  background: #e8ebf0;
}

.color-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid #e0e3e8;
}

.color-chip:hover {
  border-color: #b0b8c4;
}

.color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.spacing-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.spacing-label {
  font-size: 10px;
  color: #a0a8b4;
  margin-right: 2px;
}

.spacing-other {
  font-size: 12px;
  color: #5a6a7a;
  margin-right: 8px;
}

</style>
