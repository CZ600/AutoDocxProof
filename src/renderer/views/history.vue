<template>
  <div class="table-container">

    <el-table :data="history" max-height="800" class="table" size="small">
      <el-table-column prop="created_at" :label="t('history.date')" width="130" />
      <el-table-column prop="modelName" :label="t('history.modelName')" width="100" />
      <el-table-column prop="filePath" :label="t('history.filePath')" min-width="150" show-overflow-tooltip />
      <el-table-column fixed="right" :label="t('history.operations')" width="140">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="showDetail(scope.row)">
            {{ t('history.detail') }}
          </el-button>
          <el-button link class="link-danger" size="small" @click="deleteHistory(scope.row.id)">
            {{ t('history.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="footer-actions">
      <el-button size="small" @click="deleteAllHistory" :disabled="history.length === 0" class="btn-danger">
        {{ t('history.deleteAll') }}
      </el-button>
    </div>

    <el-dialog v-model="dialogVisible" :title="t('history.detailTitle')" width="60%" class="morandi-dialog">
      <pre class="detail-pre">{{ detailContent }}</pre>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ t('history.close') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()

const electronAPI = window.electronAPI
const history = ref([])
const dialogVisible = ref(false)
const detailContent = ref('')

const showDetail = async (row: any) => {
  try {
    const result = await electronAPI.getHistoryById(row.id)
    if (result && result.result) {
      detailContent.value = JSON.stringify(JSON.parse(result.result), null, 2)
      dialogVisible.value = true
    } else {
      ElMessage.error(t('history.detailNotFound'))
    }
  } catch (error) {
    console.error('获取详情失败:', error)
    ElMessage.error(t('history.getDetailFail'))
  }
}

const deleteAllHistory = async () => {
  ElMessageBox.confirm(t('history.deleteAllConfirm'), t('history.deleteAllWarning'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
    .then(async () => {
      try {
        const result = await electronAPI.deleteAllHistory()
        if (result) {
          ElMessage.success(t('history.allDeleted'))
          await loadHistory()
        } else {
          ElMessage.error(t('history.deleteFail'))
        }
      } catch (error) {
        console.error('删除所有历史记录失败:', error)
        ElMessage.error(t('history.deleteFail'))
      }
    })
    .catch(() => {})
}

const deleteHistory = async (id: number) => {
  try {
    const result = await electronAPI.deleteHistoryById(id)
    if (result) {
      ElMessage.success(t('history.deleteSuccess'))
      await loadHistory()
    } else {
      ElMessage.error(t('history.deleteFail'))
    }
  } catch (error) {
    console.error('删除历史记录失败:', error)
    ElMessage.error(t('history.deleteFail'))
  }
}

const loadHistory = async () => {
  try {
    const result = await electronAPI.getAllHistory()
    history.value = result
  } catch (error) {
    console.error('获取历史记录失败:', error)
    ElMessage.error(t('history.loadFail'))
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.table-container {
  padding: 16px 20px;
  height: 100%;
  overflow-y: auto;
  background: #ffffff;
}

.table {
  border: none;
  border-radius: 0;
  width: 100%;
}

.table :deep(.el-table__header th) {
  background-color: #f4f6f9;
  color: #4a6580;
  font-weight: 600;
  border-bottom: none;
}

.table :deep(.el-table__row td) {
  border-bottom: 1px solid #edf0f4;
}

.table :deep(.el-table__row:hover > td) {
  background-color: #f8fafb;
}

.table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.footer-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.link-danger {
  color: #c28a8a;
}

.link-danger:hover {
  color: #b07575;
}

.btn-danger {
  color: #ffffff;
  border-color: #c28a8a;
  background-color: #c28a8a;
}

.btn-danger:hover {
  color: #ffffff;
  border-color: #b07575;
  background-color: #b07575;
}

.btn-danger.is-disabled {
  opacity: 0.5;
}

.detail-pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.7;
  color: #5a6a7a;
  background: #f4f6f9;
  padding: 16px;
  border-radius: 6px;
}

.morandi-dialog :deep(.el-dialog) {
  border-radius: 10px;
  border: none;
  box-shadow: 0 4px 24px rgba(75, 100, 130, 0.12);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>

<style>
html.dark .table-container {
  background-color: #000000;
}

html.dark .table :deep(.el-table__header th) {
  background-color: #1a1a1a;
  color: #c0c4cc;
}

html.dark .table :deep(.el-table__row td) {
  border-bottom-color: #2c2e30;
}

html.dark .table :deep(.el-table__row:hover > td) {
  background-color: #252525;
}

html.dark .detail-pre {
  color: #c0c4cc;
  background: #1a1a1a;
}

html.dark .link-danger {
  color: #d08888;
}

html.dark .link-danger:hover {
  color: #c06666;
}
</style>
