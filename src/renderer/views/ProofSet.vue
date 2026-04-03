<template>
  <div class="proof-set-page">
    <PromptSettingsPanel />
  </div>
</template>

<script setup lang="ts">
import PromptSettingsPanel from '../components/prompt/PromptEditor.vue'
</script>

<style scoped>
.proof-set-page {
  padding: 16px 20px;
  height: 100%;
  overflow-y: auto;
  background: #ffffff;
}
</style>
