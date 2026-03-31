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
  padding: 20px;
}

@media (max-width: 768px) {
  .proof-set-page {
    padding: 10px;
  }
}
</style>
