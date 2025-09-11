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
/**
 * 调用 Gemini API 进行单次对话。
 *
 * @param systemPrompt - 给模型的系统指令。这是一个对象，包含role和parts。
 * @param userPrompt - 用户的提问。
 * @param apiKey - 你的 Google AI API 密钥。
 * @param modelName - 要使用的模型名称，例如 "gemini-1.5-flash"。
 * @returns A Promise that resolves to the model's text response.
 */
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

    return chatCompletion.choices[0].message.content
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

// 帮我写一个简单的函数来测试api的可用性，传入参数包括apiURL和apiKey，发送一句你好，如果正常回答则返回true，否则返回false
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
