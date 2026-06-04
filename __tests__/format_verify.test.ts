/**
 * 格式变更正确性验证测试
 * 验证 applySmartFormat 后，输出文档的格式是否真的发生了变化
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import { loadDocx } from 'docx-edit'
import { ModelProvider } from '../src/shared/modelProviders'
import type { apiSettings } from '../src/main/database'
import { extractFormatProfile } from '../src/main/formatClone'
import {
  SmartFormatAgent,
} from '../src/main/smartFormatAgent'
import {
  applySmartFormat,
  SmartFormatSpec,
} from '../src/main/smartFormatApply'

// Load .env
function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_BASE_URL = process.env.LLM_BASE_URL || ''
const MODEL_NAME = process.env.MODEL_NAME || ''
const hasEnv = LLM_API_KEY && LLM_BASE_URL && MODEL_NAME

const apiConfig: apiSettings = {
  apiKey: LLM_API_KEY,
  apiURL: LLM_BASE_URL,
  modelName: MODEL_NAME,
  provider: ModelProvider.OPENAI_COMPATIBLE,
}

const TEST_DOC = path.resolve(__dirname, '测试文档1.docx')
const OUTPUT_DIR = path.resolve(__dirname, 'output')
const OUTPUT_DOC = path.join(OUTPUT_DIR, 'format_verify_output.docx')

const TIMEOUT = 180_000

// Helpers
function getRunStyle(paragraph: any): Record<string, any> {
  try {
    const runs = paragraph.getRuns()
    if (runs && runs.length > 0 && runs[0].getStyle) {
      return runs[0].getStyle() || {}
    }
  } catch { /* ignore */ }
  return {}
}

function getParaStyle(paragraph: any): Record<string, any> {
  try { return paragraph.getStyle() || {} } catch { return {} }
}

describe.skipIf(!hasEnv)('格式变更正确性验证', () => {
  beforeAll(() => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  })

  afterAll(() => {
    if (fs.existsSync(OUTPUT_DOC)) fs.unlinkSync(OUTPUT_DOC)
  })

  it('描述输入：正文应变为宋体小四号，首行缩进2字符', async () => {
    const description = '正文 宋体 小四号 首行缩进2字符 1.5倍行距'
    const agent = new SmartFormatAgent()
    const analyzeResult = await agent.analyze({
      description,
      targetFilePath: TEST_DOC,
      apiConfig,
    })

    // 打印 spec 中 body 的格式要求
    const bodyRule = (analyzeResult.spec.paragraphRules || []).find(
      (r: any) => r.match?.paragraphType === 'body'
    )
    console.log(`  body rule format: ${JSON.stringify(bodyRule?.format || {})}`)

    const applyResult = await agent.apply(
      TEST_DOC, OUTPUT_DOC, analyzeResult.spec, analyzeResult.classification
    )
    expect(applyResult.success).toBe(true)

    // 读取输出文档验证格式
    const outDoc = await loadDocx(OUTPUT_DOC)
    const outParas = outDoc.getBody().getParagraphs()

    let bodyTotal = 0
    let bodyFontSizeMatch = 0
    let bodyFontFamilyMatch = 0
    let bodyIndentMatch = 0

    for (let i = 0; i < outParas.length; i++) {
      const pType = analyzeResult.classification.get(i)
      if (pType !== 'body') continue
      bodyTotal++
      const runStyle = getRunStyle(outParas[i])
      const paraStyle = getParaStyle(outParas[i])
      if (runStyle.fontSize === '24') bodyFontSizeMatch++
      const ff = runStyle.fontFamily
      const fontName = typeof ff === 'string' ? ff : (ff?.eastAsia || ff?.ascii)
      if (fontName && (fontName.includes('SimSun') || fontName.includes('宋体'))) {
        bodyFontFamilyMatch++
      }
      // 验证首行缩进：indent.firstLine 应为正数（twips）
      const indent = paraStyle.indent
      if (indent && indent.firstLine && parseInt(indent.firstLine) > 0) {
        bodyIndentMatch++
      }
    }

    console.log(`  body段落: 共${bodyTotal}, 字号=24: ${bodyFontSizeMatch}, 字体含宋体: ${bodyFontFamilyMatch}, 有首行缩进: ${bodyIndentMatch}`)

    // 至少部分 body 段落的字号应该被改为 24
    expect(bodyFontSizeMatch).toBeGreaterThan(0)
    // 至少部分 body 段落的字体应该包含宋体
    expect(bodyFontFamilyMatch).toBeGreaterThan(0)
    // 至少部分 body 段落应有首行缩进
    expect(bodyIndentMatch).toBeGreaterThan(0)
  }, TIMEOUT)

  it('参考文档输入：格式应从参考文档复制到目标文档', async () => {
    const agent = new SmartFormatAgent()
    const analyzeResult = await agent.analyze({
      refFilePath: TEST_DOC,
      targetFilePath: TEST_DOC,
      apiConfig,
    })

    const applyResult = await agent.apply(
      TEST_DOC, OUTPUT_DOC, analyzeResult.spec, analyzeResult.classification
    )
    expect(applyResult.success).toBe(true)
    expect(applyResult.appliedParagraphs).toBeGreaterThan(0)

    // 验证输出文档的样式档案包含了参考文档的样式
    const outProfile = await extractFormatProfile(OUTPUT_DOC)
    const outStyles = Object.keys(outProfile.styles || {})
    console.log(`  输出文档样式数: ${outStyles.length}`)

    // 应该有样式被应用
    expect(outStyles.length).toBeGreaterThan(0)
  }, TIMEOUT)

  it('混合输入：描述应优先覆盖参考文档中 body 的格式', async () => {
    const agent = new SmartFormatAgent()
    const analyzeResult = await agent.analyze({
      description: '正文 楷体 小四号',
      refFilePath: TEST_DOC,
      targetFilePath: TEST_DOC,
      apiConfig,
    })

    // 检查 spec 中 body 规则的字体
    const bodyRule = (analyzeResult.spec.paragraphRules || []).find(
      (r: any) => r.match?.paragraphType === 'body'
    )
    console.log(`  body rule format: ${JSON.stringify(bodyRule?.format || {})}`)

    const applyResult = await agent.apply(
      TEST_DOC, OUTPUT_DOC, analyzeResult.spec, analyzeResult.classification
    )
    expect(applyResult.success).toBe(true)

    // 验证 body 段落字体
    const outDoc = await loadDocx(OUTPUT_DOC)
    const outParas = outDoc.getBody().getParagraphs()

    let bodyTotal = 0
    let bodyFontIsKaiTi = 0

    for (let i = 0; i < outParas.length; i++) {
      const pType = analyzeResult.classification.get(i)
      if (pType !== 'body') continue
      bodyTotal++
      const runStyle = getRunStyle(outParas[i])
      const ff = runStyle.fontFamily
      const fontName = typeof ff === 'string' ? ff : (ff?.eastAsia || ff?.ascii)
      if (fontName && (fontName.includes('KaiTi') || fontName.includes('楷体'))) {
        bodyFontIsKaiTi++
      }
    }

    console.log(`  body段落: 共${bodyTotal}, 字体含楷体: ${bodyFontIsKaiTi}`)

    // 至少部分 body 段落应该是楷体（描述指定的）
    expect(bodyFontIsKaiTi).toBeGreaterThan(0)
  }, TIMEOUT)

  it('手工构造 spec：字号、字体和首行缩进应直接应用到段落', async () => {
    const doc = await loadDocx(TEST_DOC)
    const body = doc.getBody()
    const paras = body.getParagraphs()

    // 构造 spec：body 段落用黑体三号（32半磅），首行缩进480twips（约2字符）
    const spec: SmartFormatSpec = {
      styleProfile: {
        styles: {
          'test-body': {
            name: 'Test Body',
            type: 'paragraph',
            paragraphStyle: { indent: { firstLine: '480' } },
            runStyle: { fontSize: '32', fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } },
          },
        },
      },
      paragraphRules: [
        {
          match: { paragraphType: 'body' },
          format: {
            paragraphStyle: { indent: { firstLine: '480' } },
            runStyle: { fontSize: '32', fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } },
          },
          exclusive: true,
        },
      ],
    }

    // 全部标为 body
    const typeMap = new Map<number, string>()
    for (let i = 0; i < paras.length; i++) typeMap.set(i, 'body')

    const result = await applySmartFormat(TEST_DOC, OUTPUT_DOC, spec, typeMap)
    expect(result.success).toBe(true)
    expect(result.appliedParagraphs).toBeGreaterThan(0)

    // 验证输出
    const outDoc = await loadDocx(OUTPUT_DOC)
    const outParas = outDoc.getBody().getParagraphs()

    let fontSize32Count = 0
    let fontHeiTiCount = 0
    let indentFirstLineCount = 0

    for (let i = 0; i < outParas.length; i++) {
      const runStyle = getRunStyle(outParas[i])
      const paraStyle = getParaStyle(outParas[i])
      if (runStyle.fontSize === '32') fontSize32Count++
      const ff = runStyle.fontFamily
      const fontName = typeof ff === 'string' ? ff : (ff?.eastAsia || ff?.ascii)
      if (fontName && (fontName.includes('SimHei') || fontName.includes('黑体'))) {
        fontHeiTiCount++
      }
      // 验证首行缩进
      const indent = paraStyle.indent
      if (indent && indent.firstLine && parseInt(indent.firstLine) > 0) {
        indentFirstLineCount++
      }
    }

    console.log(`  字号=32: ${fontSize32Count}/${outParas.length}, 字体含黑体: ${fontHeiTiCount}/${outParas.length}, 有首行缩进: ${indentFirstLineCount}/${outParas.length}`)

    // 关键断言：格式应该被正确应用
    expect(fontSize32Count).toBeGreaterThan(0)
    expect(fontHeiTiCount).toBeGreaterThan(0)
    // 首行缩进应该被应用
    expect(indentFirstLineCount).toBeGreaterThan(0)
  }, TIMEOUT)
})
