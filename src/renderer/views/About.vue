<template>
  <div class="about-container">
    <el-page-header @back="goBack" :content="t('about.pageTitle')" />

    <div class="logo-section">
      <img src="../assets/logo.png" alt="Logo" class="logo" />
      <p class="subtitle">{{ t('about.subtitle') }}</p>
    </div>

    <el-tabs v-model="activeTab" type="card" class="content-tabs">
      <el-tab-pane :label="t('about.tabs.intro')" name="intro">
        <el-card>
          <h2>📝 {{ t('about.intro.title') }}</h2>
          <p>{{ t('about.intro.desc1') }}</p>
          <p>{{ t('about.intro.desc2') }}</p>

          <h3>{{ t('about.intro.coreFeatures') }}</h3>
          <el-collapse v-model="activeCollapse" accordion>
            <el-collapse-item :title="t('about.intro.feature1Title')" name="1">
              <ul>
                <li>{{ t('about.intro.feature1WordError') }}</li>
                <li>{{ t('about.intro.feature1Comprehensive') }}</li>
                <li>{{ t('about.intro.feature1Polish') }}</li>
              </ul>
            </el-collapse-item>
            <el-collapse-item :title="t('about.intro.feature2Title')" name="2">
              <ul>
                <li>{{ t('about.intro.feature2Typo') }}</li>
                <li>{{ t('about.intro.feature2Punctuation') }}</li>
                <li>{{ t('about.intro.feature2Grammar') }}</li>
              </ul>
            </el-collapse-item>
            <el-collapse-item :title="t('about.intro.feature3Title')" name="3">
              <ul>
                <li>{{ t('about.intro.feature3Create') }}</li>
                <li>{{ t('about.intro.feature3Import') }}</li>
                <li>{{ t('about.intro.feature3RAG') }}</li>
              </ul>
            </el-collapse-item>
            <el-collapse-item :title="t('about.intro.feature4Title')" name="4">
              <ul>
                <li>{{ t('about.intro.feature4Parallel') }}</li>
                <li>{{ t('about.intro.feature4Display') }}</li>
                <li>{{ t('about.intro.feature4Apply') }}</li>
                <li>{{ t('about.intro.feature4Responsive') }}</li>
              </ul>
            </el-collapse-item>
            <el-collapse-item :title="t('about.intro.feature5Title')" name="5">
              <ul>
                <li>{{ t('about.intro.feature5OpenAI') }}</li>
                <li>{{ t('about.intro.feature5Flexible') }}</li>
              </ul>
            </el-collapse-item>
            <el-collapse-item :title="t('about.intro.feature6Title')" name="6">
              <ul>
                <li>{{ t('about.intro.feature6View') }}</li>
                <li>{{ t('about.intro.feature6Batch') }}</li>
              </ul>
            </el-collapse-item>
          </el-collapse>

          <el-alert
            :title="t('about.intro.warningNote')"
            type="warning"
            :description="t('about.intro.warningDesc')"
            show-icon
            :closable="false"
            style="margin-top: 16px"
          />
          <el-alert
            :title="t('about.intro.tip1Title')"
            type="info"
            :description="t('about.intro.tip1Desc')"
            show-icon
            :closable="false"
            style="margin-top: 8px"
          />
          <el-alert
            :title="t('about.intro.tip2Title')"
            type="info"
            :description="t('about.intro.tip2Desc')"
            show-icon
            :closable="false"
            style="margin-top: 8px"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('about.tabs.tech')" name="tech">
        <el-card>
          <h2>🛠 {{ t('about.tech.title') }}</h2>
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('about.tech.framework')">
              <el-link href="https://www.electronjs.org/" target="_blank">Electron</el-link> +
              <el-link href="https://vuejs.org/" target="_blank">Vue 3</el-link> +
              <el-link href="https://www.typescriptlang.org/" target="_blank">TypeScript</el-link>
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.uiLibrary')">
              <el-link href="https://element-plus.org/" target="_blank">Element Plus</el-link>
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.buildTool')">
              <el-link href="https://vitejs.dev/" target="_blank">Vite</el-link> +
              <el-link href="https://www.electronforge.io/" target="_blank">Electron Forge</el-link>
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.docProcessing')">
              <el-link href="https://github.com/mwilliamson/mammoth.js" target="_blank">Mammoth</el-link>
              +
              <el-link href="https://github.com/open-xml-templating/docxtemplater" target="_blank"
                >Docxtemplater</el-link
              >
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.vectorDB')">
              <el-link href="https://lancedb.com/" target="_blank">LanceDB</el-link>
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.codeStandards')">
              <el-link href="https://eslint.org/" target="_blank">ESLint</el-link> +
              <el-link href="https://prettier.io/" target="_blank">Prettier</el-link>
            </el-descriptions-item>
            <el-descriptions-item :label="t('about.tech.versionControl')">
              <el-link href="https://github.com/conventional-changelog/standard-version" target="_blank"
                >Standard Version</el-link
              >
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('about.tabs.start')" name="start">
        <el-card>
          <h2>🚀 {{ t('about.start.title') }}</h2>
          <h3>{{ t('about.start.requirements') }}</h3>
          <ul>
            <li>{{ t('about.start.nodeReq') }}</li>
            <li>{{ t('about.start.npmOrYarn') }}</li>
          </ul>

          <h3>{{ t('about.start.install') }}</h3>
          <el-code-block lang="bash">npm install</el-code-block>

          <h3>{{ t('about.start.devMode') }}</h3>
          <el-code-block lang="bash">npm run start</el-code-block>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('about.tabs.structure')" name="structure">
        <el-card>
          <h2>📦 {{ t('about.structure.title') }}</h2>
          <div class="structure-container">
            <el-tree :data="structureData" :props="defaultProps" default-expand-all show-line class="structure-tree">
              <template #default="{ node, data }">
                <div class="tree-node">
                  <span class="file-icon">{{ data.icon }}</span>
                  <span class="file-name">{{ node.label }}</span>
                  <span v-if="data.description" class="file-description">{{ data.description }}</span>
                </div>
              </template>
            </el-tree>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('about.tabs.guide')" name="guide">
        <el-card>
          <h2>🎯 {{ t('about.guide.title') }}</h2>
          <el-steps direction="vertical" :active="3">
            <el-step :title="t('about.guide.step1Title')">
              <template #description>
                <ol>
                  <li>{{ t('about.guide.step1L1') }}</li>
                  <li>{{ t('about.guide.step1L2') }}</li>
                  <li>{{ t('about.guide.step1L3') }}</li>
                  <li>{{ t('about.guide.step1L4') }}</li>
                  <li>{{ t('about.guide.step1L5') }}</li>
                </ol>
              </template>
            </el-step>
            <el-step :title="t('about.guide.step2Title')">
              <template #description>
                <ol>
                  <li>{{ t('about.guide.step2L1') }}</li>
                  <li>{{ t('about.guide.step2L2') }}</li>
                  <li>{{ t('about.guide.step2L3') }}</li>
                  <li>{{ t('about.guide.step2L4') }}</li>
                </ol>
              </template>
            </el-step>
            <el-step :title="t('about.guide.step3Title')">
              <template #description>
                <ol>
                  <li>{{ t('about.guide.step3L1') }}</li>
                  <li>{{ t('about.guide.step3L2') }}</li>
                  <li>{{ t('about.guide.step3L3') }}</li>
                  <li>{{ t('about.guide.step3L4') }}</li>
                  <li>{{ t('about.guide.step3L5') }}</li>
                  <li>{{ t('about.guide.step3L6') }}</li>
                  <li>{{ t('about.guide.step3L7') }}</li>
                  <li>{{ t('about.guide.step3L8') }}</li>
                  <li>{{ t('about.guide.step3L9') }}</li>
                </ol>
              </template>
            </el-step>
          </el-steps>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('about.tabs.other')" name="other">
        <el-card>
          <h2>🔧 {{ t('about.other.devPlan') }}</h2>
          <ul>
            <li>{{ t('about.other.devPlanL1') }}</li>
            <li>{{ t('about.other.devPlanL2') }}</li>
            <li>{{ t('about.other.devPlanL3') }}</li>
          </ul>

          <h2>📖 {{ t('about.other.version') }}</h2>
          <p>{{ t('about.other.currentVersion') }}</p>
          <p>{{ t('about.other.versionNote') }}</p>
          <el-link href="https://github.com/CZ600/AutoDocxProofread" target="_blank" type="primary">
            {{ t('about.other.projectAddress') }}
          </el-link>
          <h2>📖 {{ t('about.other.acknowledgement') }}</h2>
          <p>{{ t('about.other.ackDesc') }}</p>
          <el-link
            href="https://github.com/night-peiqi/electron-vue3-typescript-template"
            target="_blank"
            type="primary"
          >
            https://github.com/night-peiqi/electron-vue3-typescript-template
          </el-link>
          <h2>📄 {{ t('about.other.license') }}</h2>
          <p>{{ t('about.other.licenseDesc') }}</p>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const activeTab = ref('intro')
const activeCollapse = ref('1')

const structureData = computed(() => [
  {
    label: '.',
    icon: '📁',
    children: [
      {
        label: 'src/',
        icon: '📁',
        children: [
          {
            label: 'main/',
            icon: '📁',
            description: t('about.structure.mainProcess'),
            children: [
              { label: 'chat.ts', icon: '📄', description: t('about.structure.chatFile') },
              { label: 'database.ts', icon: '📄', description: t('about.structure.databaseFile') },
              { label: 'ipcHandlers.ts', icon: '📄', description: t('about.structure.ipcFile') },
              { label: 'lancedb.ts', icon: '📄', description: t('about.structure.lancedbFile') },
              { label: 'main.ts', icon: '📄', description: t('about.structure.mainFile') },
              { label: 'pdfUtils.ts', icon: '📄', description: t('about.structure.pdfFile') },
              { label: 'preload.ts', icon: '📄', description: t('about.structure.preloadFile') },
              { label: 'proof.ts', icon: '📄', description: t('about.structure.proofFile') },
              { label: 'wordProcess.ts', icon: '📄', description: t('about.structure.wordProcessFile') }
            ]
          },
          {
            label: 'renderer/',
            icon: '📁',
            description: t('about.structure.rendererDir'),
            children: [
              { label: 'router/', icon: '📁', description: t('about.structure.routerDir') },
              { label: 'stores/', icon: '📁', description: t('about.structure.storesDir') },
              { label: 'views/', icon: '📁', description: t('about.structure.viewsDir') },
              { label: 'App.vue', icon: '📄', description: t('about.structure.appVue') },
              { label: 'renderer.ts', icon: '📄', description: t('about.structure.rendererTs') }
            ]
          }
        ]
      },
      { label: 'assets/', icon: '📁', description: t('about.structure.assetsDir') },
      { label: 'out/', icon: '📁', description: t('about.structure.outDir') },
      { label: 'forge.config.ts', icon: '📄', description: t('about.structure.forgeConfig') }
    ]
  }
])

const defaultProps = {
  children: 'children',
  label: 'label'
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.about-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.logo-section {
  text-align: center;
  margin: 24px 0;
}

.logo {
  width: 120px;
  height: auto;
  margin-bottom: 16px;
}

.subtitle {
  font-size: 16px;
  color: #666;
}

.content-tabs :deep(.el-card__body) {
  padding: 20px;
}

.content-tabs h2 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

.content-tabs h3 {
  margin: 16px 0 8px;
  color: #444;
}

.content-tabs ul {
  padding-left: 20px;
  margin: 8px 0;
}

.content-tabs li {
  margin: 4px 0;
}

.structure-container {
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
}

.structure-tree {
  background-color: transparent;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.file-icon {
  margin-right: 8px;
  font-size: 14px;
}

.file-name {
  font-weight: 500;
  margin-right: 8px;
}

.file-description {
  color: #909399;
  font-size: 12px;
}
</style>
