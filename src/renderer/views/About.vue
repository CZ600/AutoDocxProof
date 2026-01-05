<template>
    <div class="about-container">
        <el-page-header @back="goBack" content="AutoDocxProof 智能文档校对应用" />

        <div class="logo-section">
            <img src="../assets/logo.png" alt="Logo" class="logo" />
            <p class="subtitle">一款基于 Electron、Vue 3 和 TypeScript 构建的智能长文档校对桌面应用程序</p>
        </div>

        <el-tabs v-model="activeTab" type="card" class="content-tabs">
            <el-tab-pane label="项目简介" name="intro">
                <el-card>
                    <h2>📝 项目简介</h2>
                    <p>
                        AutoDocxProofread（智能校对）是一款专为长文档校对而设计的桌面应用程序。它能够帮助用户有效检测 Word
                        文档中的错别字、标点符号错误、语法问题和文本一致性问题，并提供修改建议。
                    </p>
                    <p>
                        针对大模型在处理长文档时存在的遗忘和幻觉问题，软件设计了专门的架构来增强校对的准确性，并能直接导出校对后的文档。并且软件采用了并行处理架构，显著提升大模型处理长文档的速度。新版本引入了本地知识库功能，支持RAG功能给模型校对参考。
                    </p>

                    <h3>核心功能与软件优势</h3>
                    <el-collapse v-model="activeCollapse" accordion>
                        <el-collapse-item title="多种校对模式" name="1">
                            <ul>
                                <li><strong>逐句精校</strong>：适合需要高精度校对的短文本</li>
                                <li><strong>逐段校正</strong>：适合长篇文献的校对</li>
                                <li><strong>全文润色</strong>：对整篇文档进行语言润色和优化</li>
                            </ul>
                        </el-collapse-item>
                        <el-collapse-item title="智能错误识别" name="2">
                            <ul>
                                <li>错别字检测</li>
                                <li>标点符号错误识别</li>
                                <li>语法问题检测</li>
                            </ul>
                        </el-collapse-item>
                        <el-collapse-item title="知识库系统" name="3">
                            <ul>
                                <li>创建和管理多个本地知识库</li>
                                <li>支持PDF、Word和TXT文档导入作为参考材料</li>
                                <li>基于向量数据库的RAG检索增强生成算法</li>
                            </ul>
                        </el-collapse-item>
                        <el-collapse-item title="更快的处理速度和用户友好的操作体验" name="4">
                            <ul>
                                <li>使用并行处理的方式优化处理效率，显著提升对于长文本的校对速度</li>
                                <li>清晰的错误展示和修改建议</li>
                                <li>一键应用修改建议</li>
                                <li>响应式设计，支持窗口缩放</li>
                            </ul>
                        </el-collapse-item>
                        <el-collapse-item title="便捷的 API 配置管理" name="5">
                            <ul>
                                <li>兼容 OpenAI 接口，支持多种大语言模型 API</li>
                                <li>灵活的 API 配置管理</li>
                            </ul>
                        </el-collapse-item>
                        <el-collapse-item title="清晰的历史记录管理" name="6">
                            <ul>
                                <li>清晰查看历史记录，包括时间、校对模型、校对文件路径和具体的结果</li>
                                <li>支持对结果的批量管理</li>
                            </ul>
                        </el-collapse-item>
                    </el-collapse>

                    <el-alert title="注意" type="warning" description="校对结果的准确度很大程度上取决于模型能力，软件无法保证校对结果的完全准确，还需要人工再次检验。"
                        show-icon :closable="false" style="margin-top: 16px;" />
                    <el-alert title="提示1" type="info" description="结果导出功能尚不完善，无法精准的将所有的结果应用到文档中，可能存在疏漏。" show-icon
                        :closable="false" style="margin-top: 8px;" />
                    <el-alert title="提示2" type="info" description="全文润色功能适合较短篇幅的文档。逐句校对对 token 的消耗很大。" show-icon
                        :closable="false" style="margin-top: 8px;" />
                </el-card>
            </el-tab-pane>

            <el-tab-pane label="技术栈" name="tech">
                <el-card>
                    <h2>🛠 技术栈</h2>
                    <el-descriptions :column="2" border>
                        <el-descriptions-item label="主框架">
                            <el-link href="https://www.electronjs.org/" target="_blank">Electron</el-link> +
                            <el-link href="https://vuejs.org/" target="_blank">Vue 3</el-link> +
                            <el-link href="https://www.typescriptlang.org/" target="_blank">TypeScript</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="UI 组件库">
                            <el-link href="https://element-plus.org/" target="_blank">Element Plus</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="构建工具">
                            <el-link href="https://vitejs.dev/" target="_blank">Vite</el-link> +
                            <el-link href="https://www.electronforge.io/" target="_blank">Electron Forge</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="文档处理">
                            <el-link href="https://github.com/mwilliamson/mammoth.js" target="_blank">Mammoth</el-link>
                            +
                            <el-link href="https://github.com/open-xml-templating/docxtemplater"
                                target="_blank">Docxtemplater</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="向量数据库">
                            <el-link href="https://lancedb.com/" target="_blank">LanceDB</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="代码规范">
                            <el-link href="https://eslint.org/" target="_blank">ESLint</el-link> +
                            <el-link href="https://prettier.io/" target="_blank">Prettier</el-link>
                        </el-descriptions-item>
                        <el-descriptions-item label="版本管理">
                            <el-link href="https://github.com/conventional-changelog/standard-version"
                                target="_blank">Standard Version</el-link>
                        </el-descriptions-item>
                    </el-descriptions>
                </el-card>
            </el-tab-pane>

            <el-tab-pane label="快速开始" name="start">
                <el-card>
                    <h2>🚀 快速开始</h2>
                    <h3>环境要求</h3>
                    <ul>
                        <li>Node.js >= 16.x</li>
                        <li>npm 或 yarn</li>
                    </ul>

                    <h3>安装依赖</h3>
                    <el-code-block lang="bash">npm install</el-code-block>

                    <h3>开发模式运行</h3>
                    <el-code-block lang="bash">npm run start</el-code-block>
                </el-card>
            </el-tab-pane>

            <el-tab-pane label="项目结构" name="structure">
                <el-card>
                    <h2>📦 项目结构</h2>
                    <div class="structure-container">
                        <el-tree :data="structureData" :props="defaultProps" default-expand-all show-line
                            class="structure-tree">
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

            <el-tab-pane label="使用指南" name="guide">
                <el-card>
                    <h2>🎯 使用指南</h2>
                    <el-steps direction="vertical" :active="3">
                        <el-step title="配置 API">
                            <template #description>
                                <ol>
                                    <li>点击导航栏中的"工作区"</li>
                                    <li>选择"API 设置"选项卡</li>
                                    <li>填写 API 地址、密钥和模型名称</li>
                                    <li>点击"测试连接"验证配置</li>
                                    <li>点击"保存配置"保存设置</li>
                                </ol>
                            </template>
                        </el-step>
                        <el-step title="创建知识库">
                            <template #description>
                                <ol>
                                    <li>点击导航栏中的"知识库"</li>
                                    <li>选择"Embedding模型"（需要选择专门的embedding模型）</li>
                                    <li>点击"添加知识库"按钮创建新知识库</li>
                                    <li>选择知识库后可添加PDF文件作为参考材料</li>
                                </ol>
                            </template>
                        </el-step>
                        <el-step title="文档校对">
                            <template #description>
                                <ol>
                                    <li>点击导航栏中的"工作区"</li>
                                    <li>选择"文档校对"选项卡</li>
                                    <li>点击"选择 DOCX 文件"按钮选择要校对的 Word 文档</li>
                                    <li>（可选）选择知识库以增强校对准确性</li>
                                    <li>选择合适的校对模式</li>
                                    <li>点击"开始校正"按钮开始校对过程</li>
                                    <li>在右侧栏查看校对结果和修改建议</li>
                                    <li>点击"应用修改"按钮接受建议的修改</li>
                                    <li>点击"导出结果"按钮保存修改后的文档</li>
                                </ol>
                            </template>
                        </el-step>
                    </el-steps>
                </el-card>
            </el-tab-pane>

            <el-tab-pane label="其他信息" name="other">
                <el-card>
                    <h2>🔧 开发计划</h2>
                    <ul>
                        <li>大语言模型的格式化输出转 Word 文档</li>
                        <li>增强用户界面交互体验</li>
                        <li>优化 .docx 文件的处理算法</li>
                    </ul>

                    <h2>📖 版本情况</h2>
                    <p>当前版本：v1.1.0</p>
                    <p>v1.1.0 版本的 .exe 包已经发布，可以在本项目页面上下载</p>
                    <el-link href="https://github.com/CZ600/AutoDocxProofread" target="_blank" type="primary">
                        项目地址：https://github.com/CZ600/AutoDocxProofread
                    </el-link>
                    <h2> 📖 致谢 </h2>
                    <p> 部分代码使用了night-peiqi的项目：</p>
                    <el-link href="https://github.com/night-peiqi/electron-vue3-typescript-template" target="_blank"
                        type="primary">
                        https://github.com/night-peiqi/electron-vue3-typescript-template
                    </el-link>
                    <h2>📄 许可证</h2>
                    <p>本项目采用 MIT 许可证 - 查看 <el-link href="/LICENSE" target="_blank">LICENSE</el-link> 文件了解详情</p>
                </el-card>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeTab = ref('intro');
const activeCollapse = ref('1');

const structureData = [
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
                        description: '# 主进程代码',
                        children: [
                            { label: 'chat.ts', icon: '📄', description: '# AI 对话相关功能' },
                            { label: 'database.ts', icon: '📄', description: '# 数据库操作' },
                            { label: 'ipcHandlers.ts', icon: '📄', description: '# IPC 通信处理' },
                            { label: 'lancedb.ts', icon: '📄', description: '# 向量数据库操作' },
                            { label: 'main.ts', icon: '📄', description: '# 主进程入口' },
                            { label: 'pdfUtils.ts', icon: '📄', description: '# PDF文档处理' },
                            { label: 'preload.ts', icon: '📄', description: '# 预加载脚本' },
                            { label: 'proof.ts', icon: '📄', description: '# 文档校对核心逻辑' },
                            { label: 'wordProcess.ts', icon: '📄', description: '# Word 文档处理' }
                        ]
                    },
                    {
                        label: 'renderer/',
                        icon: '📁',
                        description: '# 渲染进程代码',
                        children: [
                            { label: 'router/', icon: '📁', description: '# 路由配置' },
                            { label: 'stores/', icon: '📁', description: '# Pinia存储目录' },
                            { label: 'views/', icon: '📁', description: '# 页面组件' },
                            { label: 'App.vue', icon: '📄', description: '# 根组件' },
                            { label: 'renderer.ts', icon: '📄', description: '# 渲染进程入口' }
                        ]
                    }
                ]
            },
            { label: 'assets/', icon: '📁', description: '# 静态资源' },
            { label: 'out/', icon: '📁', description: '# 构建输出目录' },
            { label: 'forge.config.ts', icon: '📄', description: '# Electron Forge 配置' }
        ]
    }
];

const defaultProps = {
    children: 'children',
    label: 'label'
};

const goBack = () => {
    router.back();
};
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
