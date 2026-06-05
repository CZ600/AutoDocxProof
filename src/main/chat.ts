// 导入自 '@google/generative-ai'
import {
  GoogleGenerativeAI,
  GenerationConfig,
  SafetySetting,
  HarmCategory,
  HarmBlockThreshold,
  Part
} from '@google/generative-ai'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { basename } from 'path'
import { ModelProvider, getProviderBaseURL } from '../shared/modelProviders'
/**
 * 调用 Gemini API 进行单次对话。
 *
 * @param systemPrompt - 给模型的系统指令。这是一个对象，包含role和parts。
 * @param userPrompt - 用户的提问。
 * @param apiKey -  Google AI API 密钥。
 * @param modelName - 要使用的模型名称，例如 "gemini-1.5-flash"。
 * @returns A Promise that resolves to the model's text response.
 */

// gemini接口的实现
// 但是实际上没有调用
export async function getGeminiResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  apiURL?: string
): Promise<{ result: string; total_tokens: number }> {
  if (!apiKey) {
    throw new Error('API key is missing. Please provide a valid API key.')
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)

    const model = genAI.getGenerativeModel(
      {
        model: modelName,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        }
      },
      apiURL ? { baseUrl: apiURL.trim().replace(/\/+$/, '') } : undefined
    )

    const generationConfig: GenerationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048
    }

    const safetySettings: SafetySetting[] = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ]

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig,
      safetySettings
    })

    const response = result.response

    if (response.promptFeedback?.blockReason) {
      throw new Error(`Request was blocked due to: ${response.promptFeedback.blockReason}`)
    }

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response candidates found.')
    }

    const text = response.candidates[0].content.parts.map(part => part.text).join('')
    const usageMetadata = response.usageMetadata as any
    const total_tokens = usageMetadata?.totalTokenCount
      ?? ((usageMetadata?.promptTokenCount || 0) + (usageMetadata?.candidatesTokenCount || 0))

    return { result: text, total_tokens }
  } catch (error) {
    console.error('An error occurred while calling the Gemini API:', error)
    if (error instanceof Error) {
      throw new Error(`Gemini API call failed: ${error.message}`)
    } else {
      throw new Error('An unknown error occurred during the Gemini API call.')
    }
  }
}
// openai的接口  带 null 安全

export async function OpenaiGen(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  apiURL: string
): Promise<{ result: string; total_tokens: number }> {
  if (!apiKey) {
    throw new Error('API key is missing. Please provide a valid API key.')
  }

  // 规范化 baseURL，确保以 /v1 结尾（OpenAI SDK 会在其后拼接 /chat/completions）
  const normalizedURL = apiURL.trim().replace(/\/+$/, '')
  const targetURL = `${normalizedURL}/chat/completions`
  console.log(`[OpenaiGen] calling: ${targetURL} | model: ${modelName}`)

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: apiURL
    })

    const chatCompletion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })

    // 添加健壮性检查
    if (
      !chatCompletion ||
      !chatCompletion.choices ||
      !Array.isArray(chatCompletion.choices) ||
      chatCompletion.choices.length === 0
    ) {
      console.error('Invalid API response:', chatCompletion)
      throw new Error('API返回了无效的响应格式，choices字段缺失或为空')
    }

    const result = chatCompletion.choices[0]?.message?.content ?? ''
    const total_tokens = chatCompletion.usage?.total_tokens ?? 0

    return { result, total_tokens }
  } catch (error) {
    console.error(`[OpenaiGen] API call failed → URL: ${targetURL}, model: ${modelName}`)
    console.error('An error occurred while calling the OpenAI-compatible API:', error)

    if (error instanceof Error) {
      // 如果是 404，提供更具体的排查建议
      const statusMatch = error.message.match(/(\d{3})/)
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0
      if (statusCode === 404) {
        // 检测可能的 provider 不匹配
        const lowerURL = targetURL.toLowerCase()
        let providerHint = ''
        if (lowerURL.includes('/anthropic')) {
          providerHint =
            `    5. ⚠️ URL 中包含 "/anthropic"，但当前使用通用 OpenAI 接口\n` +
            `       → 请检查 provider 设置，可能需要改为 "Anthropic (Claude)" 或 "模拟 Claude Code"\n` +
            `       → 同时确认模型名称应为 Claude 系列（如 claude-sonnet-4-5-20250929）\n`
        }
        throw new Error(
          `OpenAI API call failed: 404 Not Found\n` +
            `  → 请求地址: ${targetURL}\n` +
            `  → 模型名称: ${modelName}\n` +
            `  → 可能原因:\n` +
            `    1. API 地址错误，请检查 API 地址是否正确（需以 /v1 结尾）\n` +
            `    2. 模型名称 "${modelName}" 在该 API 中不可用\n` +
            `    3. API 密钥无效或已过期\n` +
            `    4. API 代理/转发服务不可用\n` +
            providerHint +
            `  → 建议: 在设置页面点击"测试连接"验证配置`
        )
      }
      throw new Error(`OpenAI API call failed: ${error.message}`)
    } else {
      throw new Error('An unknown error occurred during the OpenAI API call.')
    }
  }
}

// 测试api可用性
export async function testAPI(apiURL: string, apiKey: string, modelName: string): Promise<boolean> {
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: apiURL
    })

    const chatCompletion = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Hello' }]
    })

    // 检查响应有效性
    if (
      !chatCompletion ||
      !chatCompletion.choices ||
      !Array.isArray(chatCompletion.choices) ||
      chatCompletion.choices.length === 0
    ) {
      console.error('API test failed - invalid response:', chatCompletion)
      return false
    }

    console.log('the result of connet test:', chatCompletion.choices[0].message.content)

    return true
  } catch (error) {
    console.error('An error occurred while calling the Gemini API:', error)
    return false
  }
}

// test modelname:doubao-embedding-text-240715
// test url: https://ark.cn-beijing.volces.com/api/v3/
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function shouldRetryEmbedding(error: any): boolean {
  const status = error?.status ?? error?.response?.status
  if (status && [500, 502, 503, 504].includes(status)) return true

  const message = String(error?.message || '').toLowerCase()
  if (message.includes('please retry later')) return true
  if (message.includes('internal error')) return true
  if (message.includes('econnreset')) return true
  if (message.includes('timed out')) return true

  return false
}

export async function getEmbedding(text: string | string[], modelName: string, apiKey_input: string, apiURL: string) {
  // 参数有效性检查
  if (!text || (Array.isArray(text) && text.length === 0)) {
    throw new Error('Text parameter is required and cannot be empty')
  }

  if (!modelName) {
    throw new Error('Model name is required')
  }

  if (!apiKey_input) {
    throw new Error('API key is required')
  }

  if (!apiURL) {
    throw new Error('API URL is required')
  }

  // 对于数组类型，检查每个元素是否为字符串
  if (Array.isArray(text)) {
    for (let i = 0; i < text.length; i++) {
      if (typeof text[i] !== 'string') {
        throw new Error(`Element at index ${i} is not a string`)
      }
      if (text[i].trim() === '') {
        throw new Error(`Element at index ${i} is an empty string`)
      }
    }
  } else if (typeof text !== 'string') {
    throw new Error('Text parameter must be a string or an array of strings')
  } else if (text.trim() === '') {
    throw new Error('Text parameter cannot be an empty string')
  }

  const openai = new OpenAI({
    apiKey: apiKey_input,
    baseURL: apiURL
  })

  const maxAttempts = 5
  let lastError: any = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const requestInput = Array.isArray(text) ? text : [text]
      const response = await openai.embeddings.create({
        model: modelName,
        input: requestInput
      })

      // 检查响应有效性
      if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('嵌入API返回了无效的响应格式，data字段缺失或为空')
      }

      // 返回embedding结果
      if (typeof text === 'string') {
        return response.data[0].embedding
      }
      if (Array.isArray(text)) {
        return response.data.map(item => item.embedding)
      }

      return response.data[0].embedding
    } catch (error: any) {
      lastError = error
      if (attempt < maxAttempts && shouldRetryEmbedding(error)) {
        const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200)
        console.warn(
          `Embedding API failed (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms:`,
          error?.message || error
        )
        await sleep(backoffMs)
        continue
      }

      console.log('error getting embedding:', error)

      // 提供更详细的错误信息
      if (error.status === 404) {
        throw new Error(
          `嵌入API调用失败，状态码404: 请检查API地址(${apiURL})和模型名称(${modelName})是否正确，该模型可能不支持嵌入功能`
        )
      } else if (error.status === 401) {
        throw new Error(`嵌入API调用失败，认证错误: API密钥无效或权限不足`)
      } else if (error.status === 400) {
        throw new Error(`嵌入API调用失败，请求错误: ${error.message}`)
      } else {
        throw new Error(`嵌入API调用失败: ${error.message || '未知错误'}`)
      }
    }
  }

  throw lastError
}

// ====================== 1. Anthropic (Claude) ======================
/**
 * 调用 Anthropic Claude API 进行单次对话（使用官方 SDK）。
 */
/**
 * 规范化 Anthropic SDK 的 baseURL，避免重复版本路径。
 * Anthropic SDK 会在 baseURL 后自动追加 /v1/messages，
 * 因此如果用户提供的 URL 已包含 /v1，需要去除以避免 /v1/v1/messages。
 */
function normalizeAnthropicBaseURL(apiURL: string): string {
  const trimmed = apiURL.trim().replace(/\/+$/, '')
  // 去除末尾的 /v1、/v2 等版本号，因为 SDK 会自动添加
  return trimmed.replace(/\/v\d+$/, '')
}

export async function getAnthropicResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  apiURL?: string
): Promise<{ result: string; total_tokens: number }> {
  if (!apiKey) throw new Error('API key is missing.')

  try {
    const options: any = { apiKey }
    if (apiURL) {
      options.baseURL = normalizeAnthropicBaseURL(apiURL)
      console.log(`[getAnthropicResponse] baseURL=${options.baseURL}, model=${modelName}`)
    }
    const anthropic = new Anthropic(options)

    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const result = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const total_tokens = message.usage?.input_tokens + (message.usage?.output_tokens || 0) || 0

    return { result, total_tokens }
  } catch (error) {
    console.error('Anthropic API call failed:', error)
    if (error instanceof Error) throw new Error(`Anthropic API call failed: ${error.message}`)
    throw new Error('An unknown error occurred during the Anthropic API call.')
  }
}

// ====================== 2. 字节火山方舟 (Doubao / Volcano Ark) ======================
/**
 * 调用字节火山方舟 Doubao 大模型接口（OpenAI 兼容）。
 */
export async function getDoubaoResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://ark.cn-beijing.volces.com/api/v3'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 3. 阿里云 (通义千问 Qwen) ======================
/**
 * 调用阿里云百炼通义千问接口（OpenAI 兼容）。
 */
export async function getQwenResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 4. 腾讯云 (混元 Hunyuan) ======================
/**
 * 调用腾讯云混元大模型接口（OpenAI 兼容）。
 */
export async function getHunyuanResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://api.hunyuan.cloud.tencent.com/v1'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 5. 百度云 (文心一言 ERNIE / 千帆) ======================
/**
 * 调用百度千帆大模型接口（OpenAI 兼容）。
 */
export async function getErnieResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://qianfan.baidubce.com/v2'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 6. GLM (智谱AI ChatGLM) ======================
/**
 * 调用智谱AI GLM 大模型接口（OpenAI 兼容）。
 */
export async function getGLMResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://open.bigmodel.cn/api/paas/v4'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 7. Minimax ======================
/**
 * 调用 Minimax 大模型接口（OpenAI 兼容）。
 */
export async function getMinimaxResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://api.minimax.io/v1'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 8. Kimi (Moonshot AI) ======================
/**
 * 调用 Kimi (Moonshot) 大模型接口（OpenAI 兼容）。
 */
export async function getKimiResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ result: string; total_tokens: number }> {
  const apiURL = 'https://api.moonshot.cn/v1'
  return OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, apiURL)
}

// ====================== 9. 模拟 Claude Code ======================
import { randomUUID } from 'crypto'

function createClaudeCodeClient(apiKey: string, apiURL?: string) {
  const sessionId = randomUUID()
  const options: any = {
    apiKey,
    defaultHeaders: {
      'x-app': 'cli',
      'User-Agent': 'claude-code/1.0.26',
      'X-Claude-Code-Session-Id': sessionId,
      'anthropic-client-type': 'cli'
    }
  }
  if (apiURL) {
    options.baseURL = normalizeAnthropicBaseURL(apiURL)
    console.log(`[createClaudeCodeClient] baseURL=${options.baseURL}`)
  }
  return { client: new Anthropic(options), sessionId }
}

const CLAUDE_CODE_TOOLS = [
  {
    name: 'BashTool',
    description: 'Executes a given bash command in the persistent shell session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        description: { type: 'string', description: 'Clear, concise description of what this command does' }
      },
      required: ['command'],
      additionalProperties: false
    },
    cache_control: { type: 'ephemeral' as const }
  },
  {
    name: 'FileReadTool',
    description: 'Reads a file or directory from the local filesystem.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'The absolute path to the file to read' }
      },
      required: ['file_path'],
      additionalProperties: false
    },
    cache_control: { type: 'ephemeral' as const }
  },
  {
    name: 'GlobTool',
    description: 'Fast file pattern matching tool that works with any codebase size.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'The glob pattern to match files against' }
      },
      required: ['pattern'],
      additionalProperties: false
    },
    cache_control: { type: 'ephemeral' as const }
  }
]

export async function getClaudeCodeResponse(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  apiURL?: string
): Promise<{ result: string; total_tokens: number }> {
  if (!apiKey) throw new Error('API key is missing.')

  try {
    const { client, sessionId } = createClaudeCodeClient(apiKey, apiURL)
    const clientRequestId = randomUUID()

    const params: any = {
      model: modelName,
      max_tokens: 16000,
      stream: true,
      betas: ['claude-code-20250219', 'interleaved-thinking-2025-05-14', 'prompt-caching-scope-2026-01-05'],
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userPrompt }]
        }
      ],
      metadata: {
        user_id: JSON.stringify({
          device_id: 'auto-docx-proofread',
          account_uuid: '',
          session_id: sessionId
        })
      },
      tools: CLAUDE_CODE_TOOLS,
      _requestHeaders: {
        'x-client-request-id': clientRequestId
      }
    }

    const stream = (await client.beta.messages.create(params as any)) as unknown as AsyncIterable<any>

    let fullText = ''
    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream as AsyncIterable<any>) {
      switch (event.type) {
        case 'message_start':
          inputTokens = event.message?.usage?.input_tokens || 0
          break
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta') {
            fullText += event.delta.text
          }
          break
        case 'message_delta':
          outputTokens = event.usage?.output_tokens || 0
          break
      }
    }

    return { result: fullText.trim(), total_tokens: inputTokens + outputTokens }
  } catch (error) {
    console.error('Claude Code API call failed:', error)
    if (error instanceof Error) throw new Error(`Claude Code API call failed: ${error.message}`)
    throw new Error('An unknown error occurred during the Claude Code API call.')
  }
}

// ====================== 统一调用接口 ======================
/**
 * 根据模型提供商调用对应的 API
 */
export async function getModelResponse(
  provider: ModelProvider,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  customBaseURL?: string
): Promise<{ result: string; total_tokens: number }> {
  switch (provider) {
    case ModelProvider.ANTHROPIC:
      return await getAnthropicResponse(systemPrompt, userPrompt, apiKey, modelName, customBaseURL)

    case ModelProvider.GEMINI:
      return await getGeminiResponse(systemPrompt, userPrompt, apiKey, modelName, customBaseURL)

    case ModelProvider.DOUBAO:
      return await getDoubaoResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.QWEN:
      return await getQwenResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.HUNYUAN:
      return await getHunyuanResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.ERNIE:
      return await getErnieResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.GLM:
      return await getGLMResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.MINIMAX:
      return await getMinimaxResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.KIMI:
      return await getKimiResponse(systemPrompt, userPrompt, apiKey, modelName)

    case ModelProvider.CLAUDE_CODE:
      return await getClaudeCodeResponse(systemPrompt, userPrompt, apiKey, modelName, customBaseURL)

    case ModelProvider.OPENAI_COMPATIBLE:
    default:
      if (!customBaseURL) {
        throw new Error('Custom base URL is required for OpenAI compatible provider')
      }
      return await OpenaiGen(systemPrompt, userPrompt, apiKey, modelName, customBaseURL)
  }
}

// ====================== 统一测试接口 ======================
/**
 * 测试 API 连接（支持所有提供商）
 */
export async function testAPIWithProvider(
  provider: ModelProvider,
  apiURL: string,
  apiKey: string,
  modelName: string
): Promise<boolean> {
  try {
    if (provider === ModelProvider.ANTHROPIC) {
      const options: any = { apiKey }
      if (apiURL) options.baseURL = normalizeAnthropicBaseURL(apiURL)
      const anthropic = new Anthropic(options)
      const message = await anthropic.messages.create({
        model: modelName,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }]
      })
      return !!message.content
    }

    if (provider === ModelProvider.CLAUDE_CODE) {
      const { client, sessionId } = createClaudeCodeClient(apiKey, apiURL)
      const testParams: any = {
        model: modelName,
        max_tokens: 100,
        stream: true,
        betas: ['claude-code-20250219', 'interleaved-thinking-2025-05-14', 'prompt-caching-scope-2026-01-05'],
        system: [{ type: 'text', text: 'You are a helpful assistant.', cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        metadata: {
          user_id: JSON.stringify({ device_id: 'auto-docx-proofread', account_uuid: '', session_id: sessionId })
        },
        tools: CLAUDE_CODE_TOOLS,
        _requestHeaders: { 'x-client-request-id': randomUUID() }
      }
      const stream = (await client.beta.messages.create(testParams)) as unknown as AsyncIterable<any>
      for await (const _event of stream) {
        break
      }
      return true
    }

    if (provider === ModelProvider.GEMINI) {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(
        { model: modelName },
        apiURL ? { baseUrl: apiURL.trim().replace(/\/+$/, '') } : undefined
      )
      const result = await model.generateContent('Hello')
      return !!result.response
    }

    const baseURL = getProviderBaseURL(provider) || apiURL
    return await testAPI(baseURL, apiKey, modelName)
  } catch (error) {
    console.error('API test failed for provider:', provider, error)
    return false
  }
}
