<template>
    <div class="prompt-settings-panel">
        <PromptDisplay />
        <PromptEditor />
    </div>
</template>

<script setup lang='ts'>
import { onMounted } from 'vue'
import PromptDisplay from './PromptDisplay.vue'
import PromptEditor from './PromptEditor.vue'
import { usePrompt } from '../../composables/usePrompt'

const { initialize } = usePrompt()

onMounted(async () => {
    await initialize()
})
</script>

<style scoped>
.prompt-settings-panel {
    display: flex;
    flex-direction: column;
}
</style>
