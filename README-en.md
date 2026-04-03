# AutoDocxProofread - Smart Document Proofreading Assistant

<p align="right">
  <a href="README.md">中文</a>
</p>

<p align="center">
  <img src="src/renderer/assets/logo.png" alt="Logo" width="120" />
</p>

<p align="center">
  A smart desktop application for long document proofreading built with Electron, Vue 3, and TypeScript
</p>

## 📝 Project Introduction

AutoDocxProofread is a desktop application designed specifically for long document proofreading. It helps users effectively detect typos, punctuation errors, grammar issues, and text consistency problems in Word documents, while providing modification suggestions.

To address the forgetting and hallucination issues that large models experience when processing long documents, the software is designed with a specialized architecture to enhance proofreading accuracy and can export the proofread and modified documents with one click. The software also employs a parallel processing architecture that significantly improves the speed of processing long documents with large models. Additionally, a local knowledge base feature is introduced, supporting RAG functionality to provide reference material for model proofreading.

### Changelog

- v1.1.7
  - Refactored pages for better user experience
  - Bilingual support for Chinese and English
- v1.1.6
  - Added progress bar for real-time proofreading status
  - Optimized API settings functionality
  - Optimized prompt settings for clarity and convenience
  - Clicking on proofreading results allows direct navigation
- v1.1.5
  - Optimized user experience for file export functionality
  - Optimized file export logic for more accurate error replacement
- v1.1.4
  - Added proxy functionality
- v1.1.3
  - Added request rate limiting, optimized support for third-party API relays
  - Optimized dark mode display
  - Added token usage statistics
  - Optimized interface effects and interaction logic
- v1.1.2
  - Fixed bug in full-text polishing mode where proofreading wouldn't work without RAG
  - Added day/night mode toggle
  - Adjustable model concurrency limits to accommodate different API providers' requirements
- v1.1.1
  - Fixed RAG functionality availability bug
- v1.1.0
  - Refactored interface and optimized usage logic
  - Improved software usability

### Core Features and Advantages

- **Multiple Proofreading Modes**:
  - Sentence-by-sentence proofreading: Suitable for short texts requiring high-precision proofreading
  - Paragraph-by-paragraph correction: Suitable for proofreading long documents
  - Full-text polishing: Language polishing and optimization for the entire document

- **Intelligent Error Recognition**:
  - Typo detection
  - Punctuation error recognition
  - Grammar issue detection

- **Knowledge Base System**:
  - Create and manage multiple local knowledge bases
  - Support importing PDF, Word, and txt documents as reference materials
  - RAG (Retrieval-Augmented Generation) algorithm based on vector database

- **Faster Processing Speed and User-Friendly Experience**:
  - Optimized processing efficiency using parallel processing, significantly improving proofreading speed for long texts
  - Clear error display and modification suggestions
  - One-click application of modification suggestions, one-click export of modified documents
  - Adjustable correction parameters to adapt to different task scenarios

- **Convenient API Configuration Management**:
  - Compatible with OpenAI interfaces, supporting various large language model APIs
  - Flexible API configuration management
  - Support for setting concurrency count and request speed

- **Clear History Management**:
  - Clearly view historical records including time, proofreading model, proofread file path, and specific results
  - Support for batch management of results

### Usage Demonstration

Users need to first select a large model in the settings page before starting proofreading. On the document proofreading page, first select the document to proofread, then choose the proofreading mode, select a knowledge base (optional), and start proofreading. The software will display the proofreading results in the right sidebar and highlight them in the text for easy viewing. You can then choose whether to accept these modifications and export the document with accepted changes:

![Document Proofreading Page](assets/新首页.png)

This application allows custom API settings, compatible with APIs meeting OpenAI specifications. Non-reasoning models are recommended, and you can limit concurrent request count and request rate:

![Settings Interface](assets/设置页面.png)

You can set proofreading error types, strictness level, and text background, or set custom prompts:

![Prompt Settings](assets/提示词设置.png)

This application also allows browsing and managing proofreading history:

![History Interface](assets/历史记录.png)

Dark Mode:
![Dark Mode](assets/深色模式.png)

> Note: The accuracy of proofreading results depends largely on the model's capabilities. The software cannot guarantee complete accuracy of proofreading results, and manual verification is still required.
> Tip: The result export function may have omissions; manual verification is recommended.
> Tip: Full-text polishing is suitable for shorter documents. Sentence-by-sentence proofreading consumes a lot of tokens.

## 🛠 Technology Stack

- **Main Framework**: [Electron](https://www.electronjs.org/) + [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **UI Component Library**: [Element Plus](https://element-plus.org/)
- **Build Tools**: [Vite](https://vitejs.dev/) + [Electron Forge](https://www.electronforge.io/)
- **Document Processing**: [Mammoth](https://github.com/mwilliamson/mammoth.js) + [Docxtemplater](https://github.com/open-xml-templating/docxtemplater)
- **Vector Database**: [LanceDB](https://lancedb.com/)
- **Code Standards**: [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)
- **Version Management**: [Standard Version](https://github.com/conventional-changelog/standard-version)

## 🚀 Quick Start

### Requirements

- Node.js >= 16.x
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run start
```

## 🎯 Usage Guide

### 1. Configure API

First-time use requires configuring a supported large language model API:

1. Click "Workspace" in the navigation bar
2. Select the "API Settings" tab
3. Fill in the API address, key, and model name
4. Click "Test Connection" to verify the configuration
5. Click "Save Configuration" to save settings

### 2. Create Knowledge Base

1. Click "Knowledge Base" in the navigation bar
2. Select "Embedding Model" (requires selecting a dedicated embedding model)
3. Click "Add Knowledge Base" button to create a new knowledge base
4. After selecting a knowledge base, you can add PDF files as reference materials

### 3. Document Proofreading

1. Click "Workspace" in the navigation bar
2. Select the "Document Proofreading" tab
3. Click "Select DOCX File" button to choose the Word document to proofread
4. (Optional) Select a knowledge base to enhance proofreading accuracy
5. Choose an appropriate proofreading mode:
   - **Sentence-by-sentence Proofreading**: Suitable for short texts requiring high-precision proofreading
   - **Paragraph-by-paragraph Correction**: Suitable for proofreading long documents
   - **Full-text Polishing**: Language polishing and optimization for the entire document
6. Click "Start Correction" button to begin the proofreading process
7. View proofreading results and modification suggestions in the right sidebar
8. Click "Apply Changes" button to accept suggested modifications
9. Click "Export Result" button to save the modified document

### 4. Correction Parameter Settings

1. Click prompt settings in the "Feature Settings" page to select different correction parameters such as text background, correction strictness, and correction error types
2. You can also use your own prompts; when using your own prompts, the original prompts will be disabled. It is recommended to modify based on the original prompts, otherwise it may affect the software's display effect
3. Click "Restore Default Configuration" to reset the above settings

## 🔧 Development Plan

- [ ] Word document format proofreading
- [ ] Enhance user interface interaction experience (ongoing)
- [x] Optimize .docx file processing algorithm

## 📄 License

This project uses the MIT License - see the [LICENSE](LICENSE) file for details

## 🌺 Acknowledgments

Some code uses night-peiqi's https://github.com/night-peiqi/electron-vue3-typescript-template
