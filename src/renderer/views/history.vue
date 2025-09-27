<template>
  <el-table :data="history" style="width: 100%" max-height="1200">
    <el-table-column prop="created_at" label="Date" width="150" />
    <el-table-column prop="modelName" label="modelName" width="120" />
    <el-table-column prop="filePath" label="filePath" width="300" />
    <el-table-column fixed="right" label="Operations" width="200">
      <template #default="scope">
        <el-button link type="primary" size="small" @click="showDetail(scope.row)">
          Detail
        </el-button>
        <el-button link type="danger" size="small" @click="deleteHistory(scope.row.id)">
          Delete
        </el-button>
      </template>
    </el-table-column>
  </el-table>
  <div style="margin-top: 20px;">
    <el-button type="danger" @click="deleteAllHistory" :disabled="history.length === 0">Delete All</el-button>
  </div>

  <!-- 详情弹窗 -->
  <el-dialog v-model="dialogVisible" title="校对结果详情" width="60%">
    <pre style="white-space: pre-wrap; word-wrap: break-word;">{{ detailContent }}</pre>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const electronAPI = window.electronAPI
const history = ref([])
const dialogVisible = ref(false)
const detailContent = ref('')

// 展示历史记录中详细的纠错内容
const showDetail = async (row: any) => {
  try {
    const result = await electronAPI.getHistoryById(row.id)
    if (result && result.result) {
      detailContent.value = JSON.stringify(JSON.parse(result.result), null, 2)
      dialogVisible.value = true
    } else {
      ElMessage.error('未找到详细内容')
    }
  } catch (error) {
    console.error('获取详情失败:', error)
    ElMessage.error('获取详情失败')
  }
}

// 删除所有历史记录
const deleteAllHistory = async () => {
  ElMessageBox.confirm(
    '确定要删除所有历史记录吗？此操作无法撤销。',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      const result = await electronAPI.deleteAllHistory()
      if (result) {
        ElMessage.success('已清空所有历史记录')
        await loadHistory()
      } else {
        ElMessage.error('删除失败')
      }
    } catch (error) {
      console.error('删除所有历史记录失败:', error)
      ElMessage.error('删除失败')
    }
  }).catch(() => {
    // 用户取消删除
  })
}

// 删除指定的条目数据
const deleteHistory = async (id: number) => {
  try {
    const result = await electronAPI.deleteHistoryById(id)
    if (result) {
      ElMessage.success('删除成功')
      await loadHistory()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    console.error('删除历史记录失败:', error)
    ElMessage.error('删除失败')
  }
}

const loadHistory = async () => {
  try {
    const result = await electronAPI.getAllHistory()
    history.value = result
  } catch (error) {
    console.error('获取历史记录失败:', error)
    ElMessage.error('获取历史记录失败')
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style></style>