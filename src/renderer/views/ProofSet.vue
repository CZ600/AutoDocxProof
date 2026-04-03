<template>
  <div class="proof-set-page">
    <PromptSettingsPanel />
  </div>
</template>

<script setup lang="ts">
import PromptSettingsPanel from '../components/prompt/PromptSettingsPanel.vue'
</script>

<style scoped>
.proof-set-page {
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}
</style>
