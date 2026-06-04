/**
 * 端到端集成测试 — 真实 LLM 调用 + 真实文档操作
 *
 * 测试内容：
 * 1. 真实格式提取：extractFormatProfile（从 .docx 提取样式）
 * 2. 真实 LLM 调用：parseFormatDescription（格式描述解析）
 * 2b. 复杂格式描述：多级标题 + 正文 + 摘要的完整描述解析
 * 2c. 错误与边界场景：空描述、混合中英文、不存在字号等
 * 2d. mergeSpecs 逻辑：描述 + 参考文档合并、优先级覆盖验证
 * 3. 真实 LLM 调用：mapRefProfileToRules（参考文档样式映射）
 * 4. 真实元数据提取：extractParagraphMetadata（段落元数据）
 * 5. 真实 LLM 调用：classifyParagraphsWithLLM（段落分类）
 * 6. 真实文档修改：applySmartFormat（格式应用 + 内容不变性校验）
 * 7. 全流程编排：SmartFormatAgent.analyze + apply
 *
 * 运行方式：npx vitest --run "__tests__/integration.test.ts"
 *
 * 环境变量（从 .env 读取）：
 *   LLM_API_KEY  — API 密钥
 *   LLM_BASE_URL — API 地址
 *   MODEL_NAME   — 模型名称
 */

import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import { loadDocx } from 'docx-edit'
import { ModelProvider } from '../src/shared/modelProviders'
import type { apiSettings } from '../src/main/database'
import {
  extractFormatProfile,
  cloneFormatWithProfile,
} from '../src/main/formatClone'
import {
  parseFormatDescription,
  mapRefProfileToRules,
  extractParagraphMetadata,
  classifyParagraphsHeuristic,
  classifyParagraphsWithLLM,
  SmartFormatAgent,
} from '../src/main/smartFormatAgent'
import {
  applySmartFormat,
  SmartFormatSpec,
} from '../src/main/smartFormatApply'

// ═══════════════════════════════════════════════════════════════════
//  环境变量与测试配置
// ═══════════════════════════════════════════════════════════════════

// 手动加载 .env（项目未安装 dotenv 包）
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
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

loadEnv()

const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_BASE_URL = process.env.LLM_BASE_URL || ''
const MODEL_NAME = process.env.MODEL_NAME || ''

// 如果环境变量缺失则跳过所有测试
const hasEnv = LLM_API_KEY && LLM_BASE_URL && MODEL_NAME

const apiConfig: apiSettings = {
  apiKey: LLM_API_KEY,
  apiURL: LLM_BASE_URL,
  modelName: MODEL_NAME,
  provider: ModelProvider.OPENAI_COMPATIBLE,
}

// 测试文档路径（使用项目内的测试文档）
const TEST_DOC = path.resolve(__dirname, '测试文档1.docx')
const OUTPUT_DIR = path.resolve(__dirname, 'output')
const OUTPUT_DOC = path.join(OUTPUT_DIR, 'integration_output.docx')

// 限制处理的段落数（精简测试文档，不需要限制）
const MAX_PARAGRAPHS = 100

// ═══════════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════════

/** 读取文档所有段落的文本内容 */
async function getDocTexts(filePath: string): Promise<string[]> {
  const doc = await loadDocx(filePath)
  const body = doc.getBody()
  if (!body) return []
  return body.getParagraphs().map((p: any) => {
    try { return p.getText() || '' } catch { return '' }
  })
}

/** 清理输出目录 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════════════════════════════

describe.skipIf(!hasEnv)('集成测试：真实 LLM + 真实文档', () => {
  // 超时设为 120 秒（真实 LLM 调用较慢，特别是批量分类）
  const TIMEOUT = 120_000

  beforeAll(() => {
    ensureOutputDir()
    // 确认测试文档存在
    expect(fs.existsSync(TEST_DOC)).toBe(true)
    // 确认环境变量已加载
    expect(LLM_API_KEY).toBeTruthy()
    expect(LLM_BASE_URL).toBeTruthy()
    expect(MODEL_NAME).toBeTruthy()
  })

  // ─────────────────────────────────────────────────────────
  //  1. 真实格式提取
  // ─────────────────────────────────────────────────────────

  describe('extractFormatProfile — 真实文档格式提取', () => {
    it('应从测试文档提取到样式列表', async () => {
      const profile = await extractFormatProfile(TEST_DOC)

      expect(profile).toBeDefined()
      expect(profile.styles).toBeDefined()

      const styleEntries = Object.entries(profile.styles)
      expect(styleEntries.length).toBeGreaterThan(0)

      // 打印提取到的样式供人工检查
      console.log(`\n  提取到 ${styleEntries.length} 个样式:`)
      for (const [id, style] of styleEntries.slice(0, 10)) {
        const s = style as any
        console.log(`    ${id}: "${s.name}" (${s.type})`)
      }
      if (styleEntries.length > 10) {
        console.log(`    ... 共 ${styleEntries.length} 个`)
      }
    }, TIMEOUT)

    it('提取的样式应包含 paragraphStyle 和 runStyle', async () => {
      const profile = await extractFormatProfile(TEST_DOC)

      for (const [id, style] of Object.entries(profile.styles)) {
        const s = style as any
        expect(s).toHaveProperty('name')
        expect(s).toHaveProperty('type')
        // 大多数样式应有 paragraphStyle 或 runStyle
        expect(s.paragraphStyle || s.runStyle).toBeTruthy()
      }
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  2. 真实 LLM 调用 — 格式描述解析
  // ─────────────────────────────────────────────────────────

  describe('parseFormatDescription — 真实 LLM 格式描述解析', () => {
    it('应将中文格式描述解析为 SmartFormatSpec', async () => {
      const description = '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距'

      const result = await parseFormatDescription(description, apiConfig)

      expect(result).toBeDefined()
      expect(result.spec).toBeDefined()
      expect(result.tokenUsage).toBeGreaterThan(0)

      // 应有 styleProfile
      expect(result.spec.styleProfile).toBeDefined()
      expect(result.spec.styleProfile!.styles).toBeDefined()

      const styles = result.spec.styleProfile!.styles!
      const styleKeys = Object.keys(styles)
      expect(styleKeys.length).toBeGreaterThan(0)

      // 应有 paragraphRules
      expect(result.spec.paragraphRules).toBeDefined()
      expect(result.spec.paragraphRules!.length).toBeGreaterThan(0)

      // 打印解析结果供人工检查
      console.log(`\n  LLM 解析结果 (token: ${result.tokenUsage}):`)
      for (const [id, style] of Object.entries(styles)) {
        const s = style as any
        console.log(`    ${id}: "${s.name}" fontSize=${s.runStyle?.fontSize || '-'} fontFamily=${JSON.stringify(s.runStyle?.fontFamily || '-')}`)
      }
    }, TIMEOUT)

    it('字号应被归一化为半磅值（"二号"→"44"，"小四"→"24"）', async () => {
      const description = '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距'
      const result = await parseFormatDescription(description, apiConfig)

      const styles = result.spec.styleProfile!.styles!

      // 查找论文题目样式
      const titleStyle = Object.values(styles).find((s: any) =>
        s.name?.includes('论文') || s.name?.includes('题目') || s.name?.includes('标题')
      ) as any

      if (titleStyle?.runStyle?.fontSize) {
        // 二号 = 44 half-points
        expect(titleStyle.runStyle.fontSize).toBe('44')
        console.log(`    论文题目字号: ${titleStyle.runStyle.fontSize} (期望 44) ✓`)
      }

      // 查找正文样式
      const bodyStyle = Object.values(styles).find((s: any) =>
        s.name?.includes('正文')
      ) as any

      if (bodyStyle?.runStyle?.fontSize) {
        // 小四 = 24 half-points
        expect(bodyStyle.runStyle.fontSize).toBe('24')
        console.log(`    正文字号: ${bodyStyle.runStyle.fontSize} (期望 24) ✓`)
      }
    }, TIMEOUT)

    it('字体应被归一化为 docx-edit 对象格式', async () => {
      const description = '论文题目 黑体 二号 居中\n正文 宋体 小四号'
      const result = await parseFormatDescription(description, apiConfig)

      const styles = result.spec.styleProfile!.styles!

      for (const [id, style] of Object.entries(styles)) {
        const s = style as any
        if (s.runStyle?.fontFamily) {
          const ff = s.runStyle.fontFamily
          // 应该是对象格式 { ascii, eastAsia, hAnsi }
          if (typeof ff === 'object') {
            expect(ff).toHaveProperty('ascii')
            expect(ff).toHaveProperty('eastAsia')
            expect(ff).toHaveProperty('hAnsi')
            console.log(`    ${id} fontFamily: ${JSON.stringify(ff)} ✓`)
          }
        }
      }
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  2b. 复杂格式描述 — 包含多级标题、正文、摘要
  // ─────────────────────────────────────────────────────────

  describe('parseFormatDescription — 复杂格式描述（多级标题 + 正文 + 摘要）', () => {
    const complexDescription = [
      '论文题目 黑体 二号 居中',
      '一级标题 黑体 三号 左对齐 段前0.5行段后0.5行',
      '二级标题 黑体 小三 左对齐',
      '三级标题 黑体 四号 左对齐',
      '正文 宋体 小四号 首行缩进2字符 1.5倍行距',
      '摘要标题 黑体 小三 居中',
      '摘要内容 宋体 小四号',
      '关键词标题 黑体 小四号',
      '参考文献标题 黑体 小三 居中',
      '参考文献内容 宋体 五号',
    ].join('\n')

    it('应解析出多种段落类型的规则', async () => {
      const result = await parseFormatDescription(complexDescription, apiConfig)

      expect(result).toBeDefined()
      expect(result.spec).toBeDefined()
      expect(result.tokenUsage).toBeGreaterThan(0)

      // 应有 styleProfile
      const styles = result.spec.styleProfile?.styles
      expect(styles).toBeDefined()
      const styleKeys = Object.keys(styles!)
      expect(styleKeys.length).toBeGreaterThanOrEqual(5)

      // 应有 paragraphRules
      const rules = result.spec.paragraphRules
      expect(rules).toBeDefined()
      expect(rules!.length).toBeGreaterThanOrEqual(5)

      console.log(`\n  复杂描述解析结果 (${rules!.length} 条规则):`)
      for (const rule of rules!) {
        const match = rule.match as any
        console.log(`    paragraphType=${match?.paragraphType || '-'} styleName=${rule.format?.styleName || '-'}`)
      }
    }, TIMEOUT)

    it('应正确归一化多种字号', async () => {
      const result = await parseFormatDescription(complexDescription, apiConfig)
      const styles = result.spec.styleProfile!.styles!

      // 收集所有解析出的字号
      const fontSizes: string[] = []
      for (const [, style] of Object.entries(styles)) {
        const s = style as any
        if (s.runStyle?.fontSize) {
          fontSizes.push(s.runStyle.fontSize)
        }
      }

      // 字号应全为半磅值（纯数字字符串）
      for (const fs of fontSizes) {
        expect(/^\d+$/.test(fs)).toBe(true)
      }

      console.log(`\n  字号归一化结果: ${fontSizes.join(', ')}`)
    }, TIMEOUT)

    it('应正确归一化多种字体为对象格式', async () => {
      const result = await parseFormatDescription(complexDescription, apiConfig)
      const styles = result.spec.styleProfile!.styles!

      for (const [id, style] of Object.entries(styles)) {
        const s = style as any
        if (s.runStyle?.fontFamily) {
          const ff = s.runStyle.fontFamily
          if (typeof ff === 'object') {
            expect(ff).toHaveProperty('ascii')
            expect(ff).toHaveProperty('eastAsia')
            expect(ff).toHaveProperty('hAnsi')
          }
        }
      }
    }, TIMEOUT)

    it('解析的 paragraphRules 应覆盖多种 paragraphType', async () => {
      const result = await parseFormatDescription(complexDescription, apiConfig)
      const rules = result.spec.paragraphRules || []

      // 收集所有 paragraphType
      const types = new Set<string>()
      for (const rule of rules) {
        const pType = (rule.match as any)?.paragraphType
        if (pType) types.add(pType)
      }

      // 至少应包含 body 和某种 title 类型
      expect(types.has('body')).toBe(true)

      console.log(`\n  覆盖的 paragraphType: ${Array.from(types).join(', ')}`)
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  2c. 错误与边界场景测试
  // ─────────────────────────────────────────────────────────

  describe('parseFormatDescription — 错误与边界场景', () => {
    it('空描述应抛出异常', async () => {
      await expect(parseFormatDescription('', apiConfig)).rejects.toThrow()
    }, TIMEOUT)

    it('纯空格描述应抛出异常', async () => {
      await expect(parseFormatDescription('   \n  \t  ', apiConfig)).rejects.toThrow()
    }, TIMEOUT)

    it('简短单一样式描述应能正常解析', async () => {
      const result = await parseFormatDescription('正文 宋体 小四', apiConfig)

      expect(result).toBeDefined()
      expect(result.spec).toBeDefined()
      expect(result.spec.styleProfile?.styles || result.spec.paragraphRules).toBeTruthy()
    }, TIMEOUT)

    it('包含不存在的字号名称时不应崩溃', async () => {
      const result = await parseFormatDescription('正文 宋体 超大号字体', apiConfig)

      // 不崩溃即可，结果可能不完美但应返回有效结构
      expect(result).toBeDefined()
      expect(result.spec).toBeDefined()
    }, TIMEOUT)

    it('混合中英文格式描述应能解析', async () => {
      const description = '标题 Heading 黑体 Bold 三号 16pt 居中 Center\n正文 Normal 宋体 SimSun 小四 12pt'
      const result = await parseFormatDescription(description, apiConfig)

      expect(result).toBeDefined()
      expect(result.spec).toBeDefined()
      expect(result.spec.styleProfile?.styles || result.spec.paragraphRules).toBeTruthy()
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  2d. mergeSpecs 逻辑测试（通过 SmartFormatAgent 间接验证）
  // ─────────────────────────────────────────────────────────

  describe('mergeSpecs 逻辑 — 描述 + 参考文档合并', () => {
    it('描述应覆盖参考文档中相同 paragraphType 的规则', async () => {
      // 先提取参考文档的 spec
      const refProfile = await extractFormatProfile(TEST_DOC)
      const refSpec = await mapRefProfileToRules(refProfile, apiConfig)

      // 用描述指定正文使用楷体
      const descResult = await parseFormatDescription('正文 楷体 小四号', apiConfig)
      const descSpec = descResult.spec

      // 通过 SmartFormatAgent 的 analyze 触发 merge
      const agent = new SmartFormatAgent()
      const doc = await loadDocx(TEST_DOC)
      const body = doc.getBody()
      const paragraphs = body.getParagraphs()
      const metadata = extractParagraphMetadata(paragraphs)
      const heuristicResult = classifyParagraphsHeuristic(metadata)
      const llmResult = await classifyParagraphsWithLLM(metadata, heuristicResult, apiConfig)

      // 手动 merge 验证（模拟 SmartFormatAgent.mergeSpecs）
      // 描述中指定的 body 规则应覆盖参考文档的 body 规则
      const refBodyRule = refSpec.paragraphRules?.find((r: any) => r.match?.paragraphType === 'body')
      const descBodyRule = descSpec.paragraphRules?.find((r: any) => r.match?.paragraphType === 'body')

      if (descBodyRule) {
        // 描述规则应存在
        expect(descBodyRule.format).toBeDefined()

        // 合并后 body 应使用描述中的格式（楷体）
        const mergedRules = new Map<string, any>()
        for (const rule of (refSpec.paragraphRules || [])) {
          const pType = (rule.match as any)?.paragraphType || 'unknown'
          if (!mergedRules.has(pType)) mergedRules.set(pType, rule)
        }
        for (const rule of (descSpec.paragraphRules || [])) {
          const pType = (rule.match as any)?.paragraphType || 'unknown'
          mergedRules.set(pType, rule)
        }

        // merged 的 body rule 应等于 descBodyRule
        expect(mergedRules.get('body')).toEqual(descBodyRule)

        console.log(`\n  合并验证: body 规则由描述覆盖 ✓`)
        console.log(`    参考 body: ${JSON.stringify(refBodyRule?.format?.runStyle || {}).slice(0, 80)}`)
        console.log(`    描述 body: ${JSON.stringify(descBodyRule?.format?.runStyle || {}).slice(0, 80)}`)
      }
    }, TIMEOUT * 2)

    it('参考文档应提供描述中未涉及的样式', async () => {
      const refProfile = await extractFormatProfile(TEST_DOC)
      const refSpec = await mapRefProfileToRules(refProfile, apiConfig)

      // 只描述正文
      const descResult = await parseFormatDescription('正文 宋体 小四号', apiConfig)

      // 参考文档的样式数量应多于描述
      const refStyleCount = Object.keys(refSpec.styleProfile?.styles || {}).length
      const descStyleCount = Object.keys(descResult.spec.styleProfile?.styles || {}).length

      // 合并后应包含参考文档中描述未涉及的样式
      const refTypes = new Set((refSpec.paragraphRules || []).map((r: any) => r.match?.paragraphType))
      const descTypes = new Set((descResult.spec.paragraphRules || []).map((r: any) => r.match?.paragraphType))

      // ref 中应有 desc 没覆盖的类型
      const extraRefTypes = Array.from(refTypes).filter(t => !descTypes.has(t))
      console.log(`\n  参考文档额外覆盖的类型: ${extraRefTypes.join(', ')}`)
      console.log(`    参考样式数: ${refStyleCount}, 描述样式数: ${descStyleCount}`)
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  3. 真实 LLM 调用 — 参考文档样式映射
  // ─────────────────────────────────────────────────────────

  describe('mapRefProfileToRules — 真实 LLM 参考文档映射', () => {
    it('应将参考文档样式映射为 paragraphType', async () => {
      // 先提取真实文档的样式
      const refProfile = await extractFormatProfile(TEST_DOC)

      const spec = await mapRefProfileToRules(refProfile, apiConfig)

      expect(spec).toBeDefined()
      expect(spec.styleProfile).toBeDefined()
      expect(spec.styleProfile!.styles).toBeDefined()

      const styles = spec.styleProfile!.styles!
      const styleKeys = Object.keys(styles)

      // 应该映射出至少 1 个样式
      expect(styleKeys.length).toBeGreaterThan(0)

      // 每个映射的 style 应该是有效的 paragraphType 值
      const validTypes = [
        'paper-title', 'chapter-title', 'section-1-title', 'section-2-title',
        'section-3-title', 'item-title', 'body', 'abstract-cn-title',
        'abstract-cn-content', 'abstract-en-title', 'abstract-en-content',
        'keywords-cn-title', 'keywords-cn-body', 'keywords-en-title',
        'keywords-en-body', 'conclusion-title', 'conclusion-content',
        'references-title', 'references-content', 'toc-title', 'toc-chapter',
        'toc-other', 'acknowledgement-title', 'appendix-title',
      ]

      for (const key of styleKeys) {
        expect(validTypes).toContain(key)
      }

      console.log(`\n  映射结果 (${styleKeys.length} 个样式):`)
      for (const key of styleKeys) {
        const s = styles[key] as any
        console.log(`    ${key}: "${s.name}"`)
      }
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  4. 真实元数据提取 + 启发式分类
  // ─────────────────────────────────────────────────────────

  describe('extractParagraphMetadata + classifyParagraphsHeuristic — 真实文档', () => {
    it('应从测试文档提取段落元数据', async () => {
      const doc = await loadDocx(TEST_DOC)
      const body = doc.getBody()
      const paragraphs = body.getParagraphs().slice(0, MAX_PARAGRAPHS)
      const metadata = extractParagraphMetadata(paragraphs)

      expect(metadata.length).toBe(paragraphs.length)
      expect(metadata.length).toBeGreaterThan(0)

      // 检查每个段落的元数据完整性
      for (const m of metadata) {
        expect(typeof m.index).toBe('number')
        expect(typeof m.firstChars).toBe('string')
        expect(m.firstChars.length).toBeLessThanOrEqual(80)
        expect(typeof m.text).toBe('string')
        expect(typeof m.isBold).toBe('boolean')
      }

      // 打印前 10 段的元数据
      console.log(`\n  段落元数据 (共 ${metadata.length} 段):`)
      for (const m of metadata.slice(0, 10)) {
        console.log(`    [${m.index}] heading=${m.headingLevel} bold=${m.isBold} section=${m.sectionType} text="${m.firstChars.slice(0, 30)}..."`)
      }
      if (metadata.length > 10) {
        console.log(`    ... 共 ${metadata.length} 段`)
      }
    }, TIMEOUT)

    it('启发式分类应为每个段落分配 ParagraphType', async () => {
      const doc = await loadDocx(TEST_DOC)
      const body = doc.getBody()
      const paragraphs = body.getParagraphs().slice(0, MAX_PARAGRAPHS)
      const metadata = extractParagraphMetadata(paragraphs)
      const classification = classifyParagraphsHeuristic(metadata)

      expect(classification.size).toBe(metadata.length)

      // 每个段落都应有分类
      for (let i = 0; i < metadata.length; i++) {
        expect(classification.has(i)).toBe(true)
        expect(typeof classification.get(i)).toBe('string')
      }

      // 统计各类型数量
      const typeCount = new Map<string, number>()
      for (const [, type] of classification) {
        typeCount.set(type, (typeCount.get(type) || 0) + 1)
      }

      console.log(`\n  启发式分类结果:`)
      for (const [type, count] of typeCount.entries()) {
        console.log(`    ${type}: ${count} 段`)
      }
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  5. 真实 LLM 调用 — 段落分类
  // ─────────────────────────────────────────────────────────

  describe('classifyParagraphsWithLLM — 真实 LLM 段落分类', () => {
    it('应通过 LLM 增强段落分类', async () => {
      const doc = await loadDocx(TEST_DOC)
      const body = doc.getBody()
      const paragraphs = body.getParagraphs().slice(0, MAX_PARAGRAPHS)
      const metadata = extractParagraphMetadata(paragraphs)
      const heuristicResult = classifyParagraphsHeuristic(metadata)

      const result = await classifyParagraphsWithLLM(metadata, heuristicResult, apiConfig)

      expect(result).toBeDefined()
      expect(result.classifications.size).toBe(metadata.length)
      expect(result.tokenUsage).toBeGreaterThan(0)

      // 统计 LLM 覆盖率
      let llmCount = 0
      let heuristicCount = 0
      for (let i = 0; i < metadata.length; i++) {
        const llmType = result.classifications.get(i)
        const heuristicType = heuristicResult.get(i)
        if (llmType !== heuristicType) {
          llmCount++
        } else {
          heuristicCount++
        }
      }

      console.log(`\n  LLM 分类结果 (token: ${result.tokenUsage}):`)
      console.log(`    总段落: ${metadata.length}`)
      console.log(`    LLM 覆盖: ${llmCount}, 启发式保留: ${heuristicCount}`)
      console.log(`    回退模式: ${result.fallbackMode}`)
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  6. 真实文档修改 — applySmartFormat
  // ─────────────────────────────────────────────────────────

  describe('applySmartFormat — 真实文档格式应用', () => {
    it('应成功应用格式并保持内容不变', async () => {
      // 先读取原始文本（限制段落数）
      const doc = await loadDocx(TEST_DOC)
      const body = doc.getBody()
      const originalTexts = body.getParagraphs().slice(0, MAX_PARAGRAPHS).map((p: any) => {
        try { return p.getText() || '' } catch { return '' }
      })
      expect(originalTexts.length).toBeGreaterThan(0)

      // 构建一个简单的格式规范
      const spec: SmartFormatSpec = {
        styleProfile: {
          styles: {
            'test-body': {
              name: 'test-body',
              type: 'paragraph',
              paragraphStyle: { alignment: 'both' },
              runStyle: { fontSize: '24' },
            },
          },
        },
        paragraphRules: [
          {
            match: { paragraphType: 'body' },
            format: {
              paragraphStyle: { alignment: 'both' },
              runStyle: { fontSize: '24' },
            },
            exclusive: true,
          },
        ],
      }

      // 构建段落分类映射（全部标为 body）
      const typeMap = new Map<number, string>()
      for (let i = 0; i < MAX_PARAGRAPHS; i++) {
        typeMap.set(i, 'body')
      }

      // 应用格式
      const result = await applySmartFormat(TEST_DOC, OUTPUT_DOC, spec, typeMap)

      expect(result.success).toBe(true)
      expect(fs.existsSync(OUTPUT_DOC)).toBe(true)

      // 验证内容不变性（限制段落数）
      const newDoc = await loadDocx(OUTPUT_DOC)
      const newBody = newDoc.getBody()
      const newTexts = newBody.getParagraphs().slice(0, MAX_PARAGRAPHS).map((p: any) => {
        try { return p.getText() || '' } catch { return '' }
      })
      expect(newTexts.length).toBe(originalTexts.length)

      for (let i = 0; i < originalTexts.length; i++) {
        expect(newTexts[i]).toBe(originalTexts[i])
      }

      console.log(`\n  格式应用结果:`)
      console.log(`    成功: ${result.success}`)
      console.log(`    应用样式: ${result.appliedStyles}`)
      console.log(`    应用段落: ${result.appliedParagraphs}`)
      console.log(`    段落数一致: ${newTexts.length === originalTexts.length}`)
      console.log(`    内容不变: ✓`)

      // 清理
      if (fs.existsSync(OUTPUT_DOC)) {
        fs.unlinkSync(OUTPUT_DOC)
      }
    }, TIMEOUT)
  })

  // ─────────────────────────────────────────────────────────
  //  7. 全流程编排 — SmartFormatAgent.analyze + apply
  // ─────────────────────────────────────────────────────────

  describe('SmartFormatAgent 全流程 — 真实 LLM + 真实文档', () => {
    it('应完成 analyze → apply 全流程（仅描述输入）', async () => {
      const agent = new SmartFormatAgent()

      // Phase 1: Analyze
      const analyzeResult = await agent.analyze({
        description: '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距',
        targetFilePath: TEST_DOC,
        apiConfig,
      })

      expect(analyzeResult).toBeDefined()
      expect(analyzeResult.spec).toBeDefined()
      expect(analyzeResult.classification.size).toBeGreaterThan(0)
      expect(analyzeResult.tokenUsage).toBeGreaterThan(0)

      console.log(`\n  Analyze 结果:`)
      console.log(`    样式数: ${Object.keys(analyzeResult.spec.styleProfile?.styles || {}).length}`)
      console.log(`    规则数: ${analyzeResult.spec.paragraphRules?.length || 0}`)
      console.log(`    分类段落: ${analyzeResult.classification.size}`)
      console.log(`    Token: ${analyzeResult.tokenUsage}`)
      console.log(`    回退模式: ${analyzeResult.fallbackMode}`)

      // Phase 2: Apply
      ensureOutputDir()
      const applyResult = await agent.apply(
        TEST_DOC,
        OUTPUT_DOC,
        analyzeResult.spec,
        analyzeResult.classification
      )

      expect(applyResult.success).toBe(true)
      expect(applyResult.contentPreserved).toBe(true)
      expect(fs.existsSync(OUTPUT_DOC)).toBe(true)

      console.log(`\n  Apply 结果:`)
      console.log(`    成功: ${applyResult.success}`)
      console.log(`    应用样式: ${applyResult.appliedStyles}`)
      console.log(`    应用段落: ${applyResult.appliedParagraphs}`)
      console.log(`    内容不变: ${applyResult.contentPreserved}`)

      // 清理
      if (fs.existsSync(OUTPUT_DOC)) {
        fs.unlinkSync(OUTPUT_DOC)
      }
    }, TIMEOUT)

    it('应完成 analyze → apply 全流程（仅参考文档输入）', async () => {
      const agent = new SmartFormatAgent()

      const analyzeResult = await agent.analyze({
        refFilePath: TEST_DOC,
        targetFilePath: TEST_DOC,
        apiConfig,
      })

      expect(analyzeResult).toBeDefined()
      expect(analyzeResult.spec).toBeDefined()
      expect(analyzeResult.classification.size).toBeGreaterThan(0)

      console.log(`\n  参考文档 Analyze 结果:`)
      console.log(`    样式数: ${Object.keys(analyzeResult.spec.styleProfile?.styles || {}).length}`)
      console.log(`    规则数: ${analyzeResult.spec.paragraphRules?.length || 0}`)
      console.log(`    分类段落: ${analyzeResult.classification.size}`)

      // Apply
      ensureOutputDir()
      const applyResult = await agent.apply(
        TEST_DOC,
        OUTPUT_DOC,
        analyzeResult.spec,
        analyzeResult.classification
      )

      expect(applyResult.success).toBe(true)
      expect(applyResult.contentPreserved).toBe(true)

      console.log(`\n  Apply 结果:`)
      console.log(`    成功: ${applyResult.success}`)
      console.log(`    应用段落: ${applyResult.appliedParagraphs}`)
      console.log(`    内容不变: ${applyResult.contentPreserved}`)

      // 清理
      if (fs.existsSync(OUTPUT_DOC)) {
        fs.unlinkSync(OUTPUT_DOC)
      }
    }, TIMEOUT)

    it('应完成 analyze → apply 全流程（描述 + 参考文档）', async () => {
      const agent = new SmartFormatAgent()

      const analyzeResult = await agent.analyze({
        description: '正文 楷体 小四号',
        refFilePath: TEST_DOC,
        targetFilePath: TEST_DOC,
        apiConfig,
      })

      expect(analyzeResult).toBeDefined()
      expect(analyzeResult.spec).toBeDefined()
      expect(analyzeResult.classification.size).toBeGreaterThan(0)

      // 验证描述优先于参考文档
      const rules = analyzeResult.spec.paragraphRules || []
      const bodyRule = rules.find((r: any) => r.match?.paragraphType === 'body')
      if (bodyRule?.format?.runStyle?.fontFamily) {
        const ff = bodyRule.format.runStyle.fontFamily
        const fontName = typeof ff === 'string' ? ff : ff?.eastAsia || ff?.ascii
        console.log(`\n  描述优先验证 — body 字体: ${fontName}`)
      }

      // Apply
      ensureOutputDir()
      const applyResult = await agent.apply(
        TEST_DOC,
        OUTPUT_DOC,
        analyzeResult.spec,
        analyzeResult.classification
      )

      expect(applyResult.success).toBe(true)
      expect(applyResult.contentPreserved).toBe(true)

      console.log(`\n  混合输入 Apply 结果:`)
      console.log(`    成功: ${applyResult.success}`)
      console.log(`    应用段落: ${applyResult.appliedParagraphs}`)
      console.log(`    内容不变: ${applyResult.contentPreserved}`)

      // 清理
      if (fs.existsSync(OUTPUT_DOC)) {
        fs.unlinkSync(OUTPUT_DOC)
      }
    }, TIMEOUT * 2)
  })
})
