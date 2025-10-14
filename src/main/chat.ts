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
import { basename } from 'path'
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
  modelName: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is missing. Please provide a valid API key.')
  }

  try {
    // 初始化时传入 API Key
    const genAI = new GoogleGenerativeAI(apiKey)

    // 获取模型，现在可以直接在 getGenerativeModel 中设置 system instruction
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: {
        role: 'system', // 或者 'model'，但通常对于指令是 'user'
        parts: [{ text: systemPrompt }]
      }
    })

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

    // generateContent 现在只需要传入用户的 prompt 即可
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

    // 从 candidates 中获取文本
    const text = response.candidates[0].content.parts.map(part => part.text).join('')
    return text
  } catch (error) {
    console.error('An error occurred while calling the Gemini API:', error)
    // 抛出更具体的错误信息
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
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is missing. Please provide a valid API key.')
  }

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

    return chatCompletion.choices[0].message.content ?? ''
  } catch (error) {
    console.error('An error occurred while calling the OpenAI-compatible API:', error)
    if (error instanceof Error) {
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
      messages: [{ role: 'user', content: '你好' }]
    })

    console.log('the result of connet test:', chatCompletion.choices[0].message.content)

    return true
  } catch (error) {
    console.error('An error occurred while calling the Gemini API:', error)
    return false
  }
}

// test modelname:doubao-embedding-text-240715
// test url: https://ark.cn-beijing.volces.com/api/v3/
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

  try {
    const response = await openai.embeddings.create({
      model: modelName,
      input: text
    })

    // 返回embedding结果
    if (typeof text === 'string') {
      return response.data[0].embedding
    }
    if (Array.isArray(text)) {
      return response.data.map(item => item.embedding)
    }

    return response.data[0].embedding
  } catch (error: any) {
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
