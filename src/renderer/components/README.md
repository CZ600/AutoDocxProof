# API 设置组件结构说明

本目录包含从 APISet.vue 拆分出的各个子组件。

## 目录结构

```
components/
├── api/                           # API 设置相关组件
│   ├── ApiSelector.vue           # API 选择、添加、删除功能
│   ├── AddApiDialog.vue          # 添加新 API 对话框
│   ├── TokenStatistics.vue       # Token 使用量统计
│   ├── ConcurrencySettings.vue   # 并发设置
│   ├── RateLimitSettings.vue     # 请求频率限制设置
│   └── ProxySettings.vue         # 代理设置
└── prompt/                        # 提示词设置相关组件
    ├── PromptDisplay.vue         # 当前提示词展示
    └── PromptEditor.vue          # 提示词编辑
```

## 组件说明

### API 设置组件 (api/)

#### ApiSelector.vue
**功能：** API 选择、添加、删除
- 显示所有已配置的 API 列表
- 支持选择当前使用的 API
- 提供添加新 API 和删除 API 的入口
- 测试 API 连通性

**Props：**
- `selectform`: 当前选中的 API 表单数据
- `apiSettings`: API 设置列表

**Events：**
- `add-api`: 点击添加新 API 按钮
- `delete-api`: 删除指定 API
- `test-api`: 测试 API 连通性

#### AddApiDialog.vue
**功能：** 添加新 API 对话框
- 输入 API URL
- 输入 API Key
- 输入模型名称
- 表单验证和重置

**Props：**
- `visible`: 对话框显示状态

**Events：**
- `update:visible`: 更新对话框显示状态
- `submit`: 提交新 API 配置
- `reset`: 重置表单

#### TokenStatistics.vue
**功能：** Token 使用量统计
- 显示累计 Token 使用量
- 提供清空统计功能

**Props：**
- `totalTokens`: 累计 Token 数量

**Events：**
- `reset-tokens`: 清空 Token 统计

#### ConcurrencySettings.vue
**功能：** 并发设置
- 设置最大并发限制（1-100）
- 带输入框的滑块控制

**Props：**
- `parallelValue`: 并发数量

**Events：**
- `update:parallelValue`: 更新并发数量

#### RateLimitSettings.vue
**功能：** 请求频率限制设置
- 开启/关闭频率限制
- 设置每分钟请求数限制

**Props：**
- `openTimeLimit`: 是否开启限制
- `timeLimit`: 限制数量

**Events：**
- `toggle-limit`: 切换限制开关
- `update:timeLimit`: 更新限制数量

#### ProxySettings.vue
**功能：** 代理设置
- 启用/禁用代理
- 设置代理端口

**Props：**
- `proxyEnabled`: 是否启用代理
- `proxyPort`: 代理端口

**Events：**
- `update:proxyEnabled`: 更新代理启用状态
- `update:proxyPort`: 更新代理端口

### 提示词设置组件 (prompt/)

#### PromptDisplay.vue
**功能：** 当前提示词展示
- 显示当前使用的提示词内容
- 支持长文本滚动查看

**Props：**
- `promptContent`: 提示词内容

#### PromptEditor.vue
**功能：** 提示词编辑
- 输入新的提示词
- 修改提示词
- 恢复默认设置

**Props：**
- `newPrompt`: 新提示词内容

**Events：**
- `update:newPrompt`: 更新新提示词内容
- `update-prompt`: 提交修改
- `reset-prompt`: 恢复默认设置

## 使用方式

在 [APISet.vue](../views/APISet.vue) 中通过导入和组合这些组件来构建完整的 API 设置页面：

```vue
<script setup>
import ApiSelector from '../components/api/ApiSelector.vue'
import AddApiDialog from '../components/api/AddApiDialog.vue'
// ... 其他组件导入
</script>

<template>
  <ApiSelector
    :selectform="selectform"
    :apiSettings="apiSettings"
    @add-api="dialogVisible = true"
    @delete-api="deleteItem"
    @test-api="testAPI"
  />
  <!-- ... 其他组件使用 -->
</template>
```

## 优势

1. **模块化：** 每个组件职责单一，易于理解和维护
2. **可复用：** 组件可在其他页面中复用
3. **可测试：** 独立组件更容易进行单元测试
4. **可维护：** 修改某个功能只需关注对应组件
5. **清晰结构：** 按功能分类（api/prompt），目录结构清晰
