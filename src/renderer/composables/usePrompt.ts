// composables/usePrompt.ts
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * Prompt 管理功能
 * 封装提示词的获取、更新、重置等操作
 */
export function usePrompt() {
    const electronAPI = window.electronAPI

    // 默认提示词
    const defaultPrompt = ref('')
    const theDefaultPrompt = ref('')

    // 新编辑的提示词
    const newPrompt = ref('')

    /**
     * 初始化 - 获取默认提示词
     */
    const initialize = async () => {
        try {
            const prompt = await electronAPI.getDefaultPrompt()
            theDefaultPrompt.value = prompt
            defaultPrompt.value = prompt
        } catch (error) {
            console.error('获取默认提示词失败:', error)
        }
    }

    /**
     * 更新提示词
     */
    const updatePrompt = async () => {
        if (!newPrompt.value.trim()) {
            ElMessage.warning('请输入新的提示词内容')
            return false
        }

        try {
            const result = await electronAPI.setNewPrompt(newPrompt.value)
            if (result) {
                defaultPrompt.value = newPrompt.value
                ElMessage.success('修改成功')
                newPrompt.value = ''
                return true
            }
            return false
        } catch (error) {
            console.error('更新提示词失败:', error)
            ElMessage.error('修改失败')
            return false
        }
    }

    /**
     * 恢复默认提示词
     */
    const resetToDefault = async () => {
        try {
            const result = await electronAPI.setNewPrompt(theDefaultPrompt.value)
            if (result) {
                defaultPrompt.value = theDefaultPrompt.value
                newPrompt.value = ''
                ElMessage.success('恢复为默认设置')
                return true
            }
            return false
        } catch (error) {
            console.error('恢复默认提示词失败:', error)
            ElMessage.error('恢复失败')
            return false
        }
    }

    return {
        // 状态
        defaultPrompt,
        theDefaultPrompt,
        newPrompt,

        // 方法
        initialize,
        updatePrompt,
        resetToDefault
    }
}
