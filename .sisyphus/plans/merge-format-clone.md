# 整合格式克隆三合一接口

## TL;DR

> 将 FormatClone.vue 的 3 个独立 Tab（参考文档克隆、从描述生成、智能格式化）合并为一个统一的单页面。用户可任选输入源（参考文档 + 描述文件/手打），一个按钮启动。仅参考文档时走原有简单流程，含描述时走 Agent 流程。结果统一展示为可编辑样式列表 + 微调面板。App.vue 的 provide/inject 状态移入组件内部。

## Context

### Original Request
用户希望将格式克隆的三个功能接口整合为一个：
1. 参考文档克隆格式
2. 选择描述文件来克隆格式
3. 打字输入格式调整

三个任选或两两组合或三者皆有。仅参考文档时不调 Agent，含有描述时调 Agent 分析。

### User Decisions
- 描述文件 = 选择 .txt 文件，读取内容填充 textarea
- UI 形态 = 单页面平铺
- 微调功能保留
- Agent 分析结果 → 可编辑样式列表（和参考文档克隆一样的微调面板）
- formatFromDesc.ts 废弃，前端不再调用
- App.vue provide 全部移入 FormatClone.vue 组件内部

### 现状架构

```
App.vue (provide 9 个 formatClone 状态/方法)
  ├── DocPreview.vue (inject → 开始克隆/导出按钮)
  └── FormatClone.vue (inject → 3 个 Tab 独立流程)
```

**DocPreview.vue 的依赖**：
- `formatCloneDoClone` → "开始克隆" 按钮
- `formatCloneDoExport` → "导出结果" 按钮
- `formatCloneCloning` / `formatCloneExporting` → loading 状态
- `formatCloneRefFilePath` / `formatCloneFormatItems` / `formatCloneTargetFilePath` → disabled 判断
- `formatCloneClonedFilePath` → disabled 判断

这些按钮在 DocPreview 顶部工具栏显示，用户点击后触发 App.vue 中的逻辑（IPC 调用 + 预览渲染）。

### 关键挑战
DocPreview.vue 中有"开始克隆"和"导出"按钮，它们通过 inject 使用 App.vue provide 的状态。
将状态移入 FormatClone 后，DocPreview 无法直接访问。需要新的通信机制。

## Design

### 方案：FormatClone 内部管理所有状态，通过事件向 DocPreview 传递操作

```
App.vue
  ├── DocPreview.vue
  │     └── "开始格式化" / "导出" 按钮 (inject 简化接口)
  └── FormatClone.vue
        └── 内部管理所有状态
        └── provide 简化接口给 DocPreview
```

**保留 provide/inject 机制，但简化接口**：
- App.vue 继续作为中间层 provide
- 但 FormatClone 通过 emit / provide 更新这些值
- DocPreview 只需 inject 几个简单值

**更优方案：FormatClone.vue 直接 provide 操作函数**：
FormatClone 在 setup 时将自身方法 provide 出去（或通过 App.vue 中转），
DocPreview inject 后调用。这样 FormatClone 拥有所有状态的控制权。

### 整合后的数据流

```
FormatClone.vue (统一入口)
  ├── refFilePath: ref('')         ← 参考文档路径
  ├── descText: ref('')            ← 描述文本（手动输入或文件导入）
  ├── formatItems: ref([])         ← 可编辑样式列表
  ├── defaults: ref(null)          ← 默认样式
  ├── clonedFilePath: ref('')      ← 输出路径
  ├── classification: ref(null)    ← Agent 段落分类结果 (Agent 路径才用)
  ├── spec: ref(null)              ← Agent SmartFormatSpec (Agent 路径才用)
  │
  ├── [开始格式化] 按钮
  │   │
  │   ├── 仅 refFilePath，无描述 → 简单流程
  │   │   extractFormatProfile(refFilePath) → styleProfile
  │   │   → cloneFormatWithProfile(profile, targetFilePath)
  │   │   → 渲染预览
  │   │
  │   └── 含描述（descText 非空）→ Agent 流程
  │       SmartFormatAgent.analyze({ description, refFilePath, targetFilePath, apiConfig })
  │       → spec + classification
  │       → 将 spec 转换为可编辑 formatItems + defaults
  │       → 展示微调面板
  │       → 用户微调后点"应用" → applySmartFormat()
  │       → 渲染预览
  │
  └── [导出结果] 按钮 → 保存文件
```

### Agent 结果 → 可编辑样式列表的转换

SmartFormatAgent.analyze() 返回：
- `spec: SmartFormatSpec` (包含 styleProfile.styles + paragraphRules + pageSettings)
- `classification: Map<number, ParagraphType>`

需要将 spec 转换为现有的 formatItems 格式：

```typescript
function specToFormatItems(spec: SmartFormatSpec): FormatItem[] {
  const items: FormatItem[] = []

  // styleProfile.styles → formatItems
  if (spec.styleProfile?.styles) {
    for (const [id, style] of Object.entries(spec.styleProfile.styles)) {
      items.push({
        id,
        name: (style as any).name || id,
        type: (style as any).type || 'paragraph',
        paragraphStyle: (style as any).paragraphStyle || {},
        runStyle: (style as any).runStyle || {},
      })
    }
  }

  // paragraphRules 中的 inline format → 补充 formatItems
  if (spec.paragraphRules) {
    for (const rule of spec.paragraphRules) {
      const pType = rule.match?.paragraphType
      if (!pType) continue
      // 检查是否已有同 id 的条目
      if (!items.find(i => i.id === pType)) {
        items.push({
          id: pType,
          name: pType,
          type: 'paragraph',
          paragraphStyle: rule.format?.paragraphStyle || {},
          runStyle: rule.format?.runStyle || {},
        })
      }
    }
  }

  return items
}
```

### UI 结构（单页面平铺）

```
┌────────────────────────────────────────────────────┐
│  ← 返回           智能格式调整                       │
├────────────────────────────────────────────────────┤
│                                                    │
│  📄 参考文档（可选）                                  │
│  ┌──────────────────────────────────────┐          │
│  │ [选择参考文档]  paper.docx            │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  📝 格式描述（可选）                                  │
│  ┌──────────────────────────────────────┐          │
│  │ [选择描述文件]  format.txt            │          │
│  └──────────────────────────────────────┘          │
│  ┌──────────────────────────────────────┐          │
│  │ 论文题目 黑体 二号 居中                │          │
│  │ 正文 宋体 小四号 1.5倍行距            │          │
│  │ 摘要标题 黑体 三号 居中               │          │
│  │ ...                                  │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  ┌──────────────────────────────────────┐          │
│  │  [开始格式化]                         │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  ─── 分析结果 ──────────────────────────────       │
│                                                    │
│  格式样式列表 (可折叠/展开, 可编辑)                    │
│  ┌──────────────────────────────────────┐          │
│  │ ▼ 论文题目 (paper-title)             │          │
│  │   paragraphStyle: alignment=center   │          │
│  │   runStyle: fontFamily=黑体 fontSize=44│         │
│  ├──────────────────────────────────────┤          │
│  │ ▼ 正文 (body)                        │          │
│  │   paragraphStyle: spacing.line=360   │          │
│  │   runStyle: fontFamily=宋体 fontSize=24│         │
│  └──────────────────────────────────────┘          │
│                                                    │
│  默认样式 (可折叠/展开, 可编辑)                        │
│  ┌──────────────────────────────────────┐          │
│  │ ▼ defaults                           │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  [应用格式]  [导出结果]                               │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Work Objectives

### Core Objective
1. 合并 FormatClone.vue 的 3 Tab 为单页面
2. 将 App.vue 的 formatClone provide/inject 状态移入 FormatClone.vue
3. DocPreview.vue 的"开始克隆"/"导出"按钮改为调用 FormatClone provide 的方法
4. Agent 分析结果转换为可编辑 formatItems（保留微调面板）
5. 废弃 Tab2 (formatFromDesc.ts)，统一描述处理到 Agent

### Concrete Deliverables
- `src/renderer/views/FormatClone.vue` — 重写为单页面
- `src/renderer/App.vue` — 简化 formatClone provide（移除大部分逻辑）
- `src/renderer/components/DocPreview.vue` — 更新 inject 接口
- `src/main/ipcHandlers.ts` — 可能需要新增/修改统一 handler
- `src/main/preload.ts` — 可能需要调整 API

### Must NOT Have
- 不删除 formatFromDesc.ts 文件（仅前端不再调用）
- 不修改 smartFormatAgent.ts 核心逻辑
- 不修改 smartFormatApply.ts 核心逻辑
- 不改变 docx-edit 调用方式
- 不影响校对/降低AI率等其他功能
- 不删除 i18n 翻译 key

## Execution Strategy

### Wave 1: 后端适配 (2 tasks)
- T1: IPC handler 统一（如果需要）
- T2: preload API 统一（如果需要）

### Wave 2: 前端重构 (3 tasks)
- T3: FormatClone.vue 重写（核心）
- T4: App.vue provide 简化
- T5: DocPreview.vue inject 更新

### Wave 3: 验证 (1 task)
- T6: 测试所有输入组合（仅参考文档、仅描述、描述+参考文档、三者皆有）

### Dependency Matrix
T3 → T4 → T5 (串行，共享接口)
T1, T2 与 T3 并行

## Verification

- 仅参考文档：点击"开始格式化" → 走 extractFormatProfile + cloneFormatWithProfile → 显示可编辑样式列表 → 应用 → 预览正确
- 仅描述：点击"开始格式化" → 走 Agent analyze → spec 转换为 formatItems → 显示可编辑样式列表 → 应用 → 预览正确
- 描述+参考文档：Agent analyze 合并两个输入 → 同上
- 三者皆有（描述文件+手打+参考文档）：描述文件内容填充 textarea 后可继续编辑 → Agent analyze
- 微调面板正常工作：修改样式参数后应用 → 格式变化正确
- 导出正常工作
- 校对功能不受影响
