<template>
    <div class="about-container">
        <div class="header">
            <img src="../assets/logo.png" alt="Logo" class="logo" />
            <h1>AutoDocxProof 智能文档校对应用</h1>
            <p>一款基于 Electron、Vue 3 和 TypeScript 构建的智能文档校对桌面应用程序</p>
        </div>

        <section class="intro">
            <h2>📝 项目简介</h2>
            <p>
                AutoDocxProof（智能校对）是一款专为中文文档校对而设计的桌面应用程序。它能够帮助用户快速检测 Word
                文档中的错别字、标点符号错误、语法问题和文本一致性问题，并提供修改建议。应用采用现代化的技术栈构建，具有直观的用户界面和强大的校对功能。
            </p>
        </section>

        <section class="features">
            <h2>✨ 核心功能</h2>

            <h3>多种校对模式：</h3>
            <ul>
                <li>逐句精校：适合需要高精度校对的短文本</li>
                <li>逐段校正：适合长篇文献的校对</li>
                <li>全文润色：对整篇文档进行语言润色和优化</li>
            </ul>

            <h3>智能错误识别：</h3>
            <ul>
                <li>错别字检测</li>
                <li>标点符号错误识别</li>
                <li>语法问题检测</li>
                <li>文本一致性检查</li>
            </ul>

            <h3>友好的用户界面：</h3>
            <ul>
                <li>实时文档预览</li>
                <li>清晰的错误展示和修改建议</li>
                <li>一键应用修改建议</li>
            </ul>

            <h3>API 配置管理：</h3>
            <ul>
                <li>支持多种大语言模型 API</li>
                <li>灵活的 API 配置管理</li>
                <li>API 可用性测试</li>
            </ul>
        </section>

        <section class="showcase">
            <h2>🖼 使用展示</h2>

            <p>
                在选择需要校对的文档后，再选择校对模式，然后开始校对，软件会将校对的结果显示在右边栏，并在文本中高亮展示，以方便查看。然后可以选择是否接受这些修改，可以导出接受修改后的文档。
            </p>
            <img src="../assets/Proofreading.jpg" alt="校对界面" class="screenshot" />

            <p>
                本应用可以自行设置 API，兼容满足 OpenAI 规范的 API 接口，推荐使用非推理模型。
            </p>
            <img src="../assets/apiset.jpg" alt="API 设置界面" class="screenshot" />

            <p>本应用还可以浏览和管理校对记录。</p>
            <img src="../assets/history.jpg" alt="历史记录界面" class="screenshot" />
        </section>

        <section class="tech-stack">
            <h2>🛠 技术栈</h2>
            <ul>
                <li><strong>主框架</strong>：<a href="https://www.electronjs.org/" target="_blank">Electron</a> + <a
                        href="https://vuejs.org/" target="_blank">Vue 3</a> + <a href="https://www.typescriptlang.org/"
                        target="_blank">TypeScript</a></li>
                <li><strong>UI 组件库</strong>：<a href="https://element-plus.org/" target="_blank">Element Plus</a></li>
                <li><strong>构建工具</strong>：<a href="https://vitejs.dev/" target="_blank">Vite</a> + <a
                        href="https://www.electronforge.io/" target="_blank">Electron Forge</a></li>
                <li><strong>文档处理</strong>：<a href="https://github.com/mwilliamson/mammoth.js"
                        target="_blank">Mammoth</a> + <a href="https://github.com/open-xml-templating/docxtemplater"
                        target="_blank">Docxtemplater</a></li>
                <li><strong>数据库</strong>：<a href="https://www.sqlite.org/" target="_blank">SQLite</a></li>
                <li><strong>代码规范</strong>：<a href="https://eslint.org/" target="_blank">ESLint</a> + <a
                        href="https://prettier.io/" target="_blank">Prettier</a></li>
                <li><strong>版本管理</strong>：<a href="https://github.com/conventional-changelog/standard-version"
                        target="_blank">Standard Version</a></li>
            </ul>
        </section>

        <section class="quick-start">
            <h2>🚀 快速开始</h2>

            <h3>环境要求</h3>
            <ul>
                <li>Node.js >= 16.x</li>
                <li>npm 或 yarn</li>
            </ul>

            <h3>安装依赖</h3>
            <pre><code>npm install</code></pre>

            <h3>开发模式运行</h3>
            <pre><code>npm run start</code></pre>

            <h3>构建可执行文件（无需安装）</h3>
            <pre><code>npm run package</code></pre>

            <h3>制作安装包</h3>
            <pre><code>npm run make</code></pre>
            <p>根据不同操作系统生成相应的安装包，位于 <code>out/make</code> 目录中：</p>
            <ul>
                <li>Windows: <code>.exe</code> 或 <code>.msi</code> 安装包</li>
                <li>macOS: <code>.dmg</code> 或 <code>.pkg</code> 安装包</li>
                <li>Linux: <code>.deb</code> 或 <code>.rpm</code> 安装包</li>
            </ul>
        </section>

        <section class="project-structure">
            <h2>📦 项目结构</h2>
            <pre><code>.
├── src/
│   ├── main/              # 主进程代码
│   │   ├── chat.ts        # AI 对话相关功能
│   │   ├── database.ts    # 数据库操作
│   │   ├── ipcHandlers.ts # IPC 通信处理
│   │   ├── main.ts        # 主进程入口
│   │   ├── preload.ts     # 预加载脚本
│   │   ├── proof.ts       # 文档校对核心逻辑
│   │   └── wordProcess.ts # Word 文档处理
│   └── renderer/          # 渲染进程代码
│       ├── router/        # 路由配置
│       ├── views/         # 页面组件
│       ├── App.vue        # 根组件
│       └── renderer.ts    # 渲染进程入口
├── assets/                # 静态资源
├── out/                   # 构建输出目录
└── forge.config.ts        # Electron Forge 配置
</code></pre>
        </section>

        <section class="usage-guide">
            <h2>🎯 使用指南</h2>

            <h3>1. 配置 API</h3>
            <ol>
                <li>点击导航栏中的"工作区"</li>
                <li>选择"API 设置"选项卡</li>
                <li>填写 API 地址、密钥和模型名称</li>
                <li>点击"测试连接"验证配置</li>
                <li>点击"保存配置"保存设置</li>
            </ol>

            <h3>2. 文档校对</h3>
            <ol>
                <li>点击导航栏中的"工作区"</li>
                <li>选择"文档校对"选项卡</li>
                <li>点击"选择 DOCX 文件"按钮选择要校对的 Word 文档</li>
                <li>选择合适的校对模式：
                    <ul>
                        <li><strong>逐句精校</strong>：适合需要高精度校对的短文本</li>
                        <li><strong>逐段校正</strong>：适合长篇文献的校对</li>
                        <li><strong>全文润色</strong>：对整篇文档进行语言润色和优化</li>
                    </ul>
                </li>
                <li>点击"开始校正"按钮开始校对过程</li>
                <li>在右侧栏查看校对结果和修改建议</li>
                <li>点击"应用修改"按钮接受建议的修改</li>
                <li>点击"导出结果"按钮保存修改后的文档</li>
            </ol>
        </section>

        <section class="dev-guide">
            <h2>📖 开发指南</h2>

            <h3>代码提交规范</h3>
            <p>项目使用 <a href="https://github.com/commitizen/cz-cli" target="_blank">Commitizen</a> 和 <a
                    href="https://commitlint.js.org/" target="_blank">Commitlint</a> 规范提交信息：</p>
            <pre><code>npm run commit</code></pre>

            <h3>代码格式化</h3>
            <p>项目使用 ESLint 和 Prettier 保证代码风格统一：</p>
            <pre><code># 检查并自动修复代码格式问题
npm run lint:fix</code></pre>
        </section>

        <footer class="footer">
            <p>Made with ❤️ by night-peiqi</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
// 无需额外逻辑，纯静态展示页面
</script>

<style scoped>
.about-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
    line-height: 1.6;
    color: #333;
}

.header {
    text-align: center;
    margin-bottom: 2.5rem;
}

.logo {
    width: 120px;
    height: auto;
    margin-bottom: 1rem;
}

h1 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
}

h2 {
    font-size: 1.6rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3rem;
}

h3 {
    font-size: 1.25rem;
    margin-top: 1.2rem;
    margin-bottom: 0.6rem;
}

ul,
ol {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
}

li {
    margin-bottom: 0.3rem;
}

.screenshot {
    max-width: 100%;
    height: auto;
    margin: 1rem 0;
    border: 1px solid #ddd;
    border-radius: 4px;
}

pre {
    background-color: #f6f8fa;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
}

code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.95em;
}

a {
    color: #007acc;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

.footer {
    text-align: center;
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
    color: #666;
}
</style>