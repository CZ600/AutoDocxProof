<template>
  <div class="table-container">
    <el-table :data="history" max-height="1200" class="table">
      <el-table-column prop="created_at" :label="t('history.date')" width="150" />
      <el-table-column prop="modelName" :label="t('history.modelName')" width="120" />
      <el-table-column prop="filePath" :label="t('history.filePath')" width="300" />
      <el-table-column fixed="right" :label="t('history.operations')" width="200">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="showDetail(scope.row)">
            {{ t('history.detail') }}
          </el-button>
          <el-button link type="danger" size="small" @click="deleteHistory(scope.row.id)">
            {{ t('history.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div style="margin-top: 20px">
      <el-button type="danger" @click="deleteAllHistory" :disabled="history.length === 0">{{
        t('history.deleteAll')
      }}</el-button>
    </div>

    <el-dialog v-model="dialogVisible" :title="t('history.detailTitle')" width="60%">
      <pre style="white-space: pre-wrap; word-wrap: break-word">{{ detailContent }}</pre>
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

<style>
.table-container {
  padding: 20px;
}

.table {
  border: 1px solid rgb(235, 233, 233);
  border-radius: 8px;
  width: 100%;
}
</style>
