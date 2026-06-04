export enum ModelProvider {
  OPENAI_COMPATIBLE = 'openai_compatible',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  DOUBAO = 'doubao',
  QWEN = 'qwen',
  HUNYUAN = 'hunyuan',
  ERNIE = 'ernie',
  GLM = 'glm',
  MINIMAX = 'minimax',
  KIMI = 'kimi',
  CLAUDE_CODE = 'claude_code'
}

export interface ModelProviderConfig {
  id: ModelProvider
  name: string
  nameEn: string
  baseURL?: string
  defaultModel: string
  requiresBaseURL: boolean
  description?: string
  descriptionEn?: string
}

export const MODEL_PROVIDERS: Record<ModelProvider, ModelProviderConfig> = {
  [ModelProvider.OPENAI_COMPATIBLE]: {
    id: ModelProvider.OPENAI_COMPATIBLE,
    name: '通用接口 (OpenAI 兼容)',
    nameEn: 'Generic (OpenAI Compatible)',
    requiresBaseURL: true,
    defaultModel: 'gpt-4',
    description: '兼容 OpenAI API 规范的通用接口',
    descriptionEn: 'Generic API compatible with OpenAI specification'
  },
  [ModelProvider.ANTHROPIC]: {
    id: ModelProvider.ANTHROPIC,
    name: 'Anthropic (Claude)',
    nameEn: 'Anthropic (Claude)',
    requiresBaseURL: true,
    defaultModel: 'claude-3-5-sonnet-20241022',
    description: 'Anthropic Claude 系列模型（支持自定义 API 地址）',
    descriptionEn: 'Anthropic Claude series models (custom API endpoint supported)'
  },
  [ModelProvider.GEMINI]: {
    id: ModelProvider.GEMINI,
    name: 'Google Gemini',
    nameEn: 'Google Gemini',
    requiresBaseURL: false,
    defaultModel: 'gemini-1.5-flash',
    description: 'Google Gemini 系列模型',
    descriptionEn: 'Google Gemini series models'
  },
  [ModelProvider.DOUBAO]: {
    id: ModelProvider.DOUBAO,
    name: '字节火山方舟 (豆包)',
    nameEn: 'Volcano Ark (Doubao)',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    requiresBaseURL: false,
    defaultModel: 'doubao-pro-32k',
    description: '字节跳动火山方舟大模型平台',
    descriptionEn: 'ByteDance Volcano Ark model platform'
  },
  [ModelProvider.QWEN]: {
    id: ModelProvider.QWEN,
    name: '阿里云 (通义千问)',
    nameEn: 'Alibaba Cloud (Qwen)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresBaseURL: false,
    defaultModel: 'qwen-max',
    description: '阿里云百炼通义千问大模型',
    descriptionEn: 'Alibaba Cloud Bailian Qwen model'
  },
  [ModelProvider.HUNYUAN]: {
    id: ModelProvider.HUNYUAN,
    name: '腾讯云 (混元)',
    nameEn: 'Tencent Cloud (Hunyuan)',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    requiresBaseURL: false,
    defaultModel: 'hunyuan-pro',
    description: '腾讯云混元大模型',
    descriptionEn: 'Tencent Cloud Hunyuan model'
  },
  [ModelProvider.ERNIE]: {
    id: ModelProvider.ERNIE,
    name: '百度云 (文心一言)',
    nameEn: 'Baidu Cloud (ERNIE)',
    baseURL: 'https://qianfan.baidubce.com/v2',
    requiresBaseURL: false,
    defaultModel: 'ERNIE-4.0-8K',
    description: '百度千帆大模型平台',
    descriptionEn: 'Baidu Qianfan model platform'
  },
  [ModelProvider.GLM]: {
    id: ModelProvider.GLM,
    name: '智谱AI (ChatGLM)',
    nameEn: 'Zhipu AI (ChatGLM)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    requiresBaseURL: false,
    defaultModel: 'glm-4',
    description: '智谱AI GLM大模型',
    descriptionEn: 'Zhipu AI GLM model'
  },
  [ModelProvider.MINIMAX]: {
    id: ModelProvider.MINIMAX,
    name: 'Minimax',
    nameEn: 'Minimax',
    baseURL: 'https://api.minimax.io/v1',
    requiresBaseURL: false,
    defaultModel: 'MiniMax-M2.7',
    description: 'Minimax 大模型',
    descriptionEn: 'Minimax model'
  },
  [ModelProvider.KIMI]: {
    id: ModelProvider.KIMI,
    name: 'Moonshot AI (Kimi)',
    nameEn: 'Moonshot AI (Kimi)',
    baseURL: 'https://api.moonshot.cn/v1',
    requiresBaseURL: false,
    defaultModel: 'moonshot-v1-8k',
    description: 'Moonshot AI Kimi 大模型',
    descriptionEn: 'Moonshot AI Kimi model'
  },
  [ModelProvider.CLAUDE_CODE]: {
    id: ModelProvider.CLAUDE_CODE,
    name: '模拟 Claude Code',
    nameEn: 'Simulated Claude Code',
    requiresBaseURL: true,
    defaultModel: 'claude-sonnet-4-5-20250929',
    description: '使用 Anthropic Claude API 模拟 Claude Code 风格调用（支持思考模式，需填写 API 地址）',
    descriptionEn: 'Simulated Claude Code style via Anthropic Claude API (with thinking mode)'
  }
}

export function getProviderBaseURL(provider: ModelProvider): string | undefined {
  return MODEL_PROVIDERS[provider]?.baseURL
}

export function getProviderDefaultModel(provider: ModelProvider): string {
  return MODEL_PROVIDERS[provider]?.defaultModel || ''
}

export function requiresBaseURL(provider: ModelProvider): boolean {
  return MODEL_PROVIDERS[provider]?.requiresBaseURL ?? true
}
