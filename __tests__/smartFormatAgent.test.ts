import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import { loadDocx } from 'docx-edit'
import {
  extractParagraphMetadata,
  ParagraphMetadata,
  parseFormatDescription,
  ParseFormatDescResult,
  mapRefProfileToRules,
  classifyParagraphsWithLLM,
  LLMClassificationResult,
} from '../src/main/smartFormatAgent'
import { ModelProvider } from '../src/shared/modelProviders'
import type { apiSettings } from '../src/main/database'
import { getModelResponse } from '../src/main/chat'

describe('extractParagraphMetadata', () => {
  const FIXTURE = path.resolve(__dirname, 'fixtures', 'minimal.docx')

  it('should return metadata array length equal to paragraph count', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    expect(Array.isArray(metadata)).toBe(true)
    expect(metadata.length).toBe(paragraphs.length)
  })

  it('should detect heading level for heading paragraph', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    // minimal.docx: first paragraph is Heading 1
    expect(metadata[0].headingLevel).not.toBeNull()
    expect(metadata[0].headingLevel).toBeGreaterThanOrEqual(1)
  })

  it('firstChars should never exceed 80 characters', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    for (const m of metadata) {
      expect(m.firstChars.length).toBeLessThanOrEqual(80)
      expect(m.firstChars).toBe(m.text.substring(0, 80))
    }
  })

  it('body text paragraph should get sectionType null', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    // minimal.docx has Heading 1 + 2 Normal paragraphs
    // Normal paragraphs should have sectionType null (body)
    for (let i = 1; i < metadata.length; i++) {
      expect(metadata[i].sectionType).toBeNull()
    }
  })

  it('each metadata entry should have all required fields', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    for (const m of metadata) {
      expect(m).toHaveProperty('index')
      expect(m).toHaveProperty('firstChars')
      expect(m).toHaveProperty('headingLevel')
      expect(m).toHaveProperty('styleId')
      expect(m).toHaveProperty('text')
      expect(m).toHaveProperty('isBold')
      expect(m).toHaveProperty('sectionType')

      expect(typeof m.index).toBe('number')
      expect(typeof m.firstChars).toBe('string')
      expect(typeof m.styleId).toBe('string')
      expect(typeof m.text).toBe('string')
      expect(typeof m.isBold).toBe('boolean')
    }
  })

  it('should handle empty paragraph gracefully', async () => {
    const doc = await loadDocx(FIXTURE)
    const body = doc.getBody()
    const paragraphs = body.getParagraphs()
    const metadata = extractParagraphMetadata(paragraphs)

    for (const m of metadata) {
      // text can be empty string if paragraph is empty
      expect(typeof m.text).toBe('string')
      // firstChars should always be a substring of text
      expect(m.text.startsWith(m.firstChars) || (m.text === '' && m.firstChars === '')).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
//  parseFormatDescription tests
// ═══════════════════════════════════════════════════════════════════

// Mock the chat module
vi.mock('../src/main/chat', () => ({
  getModelResponse: vi.fn(),
}))

const mockGetModelResponse = getModelResponse as ReturnType<typeof vi.fn>

const dummyApiConfig: apiSettings = {
  apiURL: 'https://api.example.com',
  apiKey: 'sk-test-key',
  modelName: 'test-model',
  provider: ModelProvider.OPENAI_COMPATIBLE,
}

// Valid JSON the LLM returns for "论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距"
const validLLMResponse = JSON.stringify({
  styleProfile: {
    styles: {
      'paper-title': {
        name: '论文题目',
        type: 'paragraph',
        paragraphStyle: { alignment: 'center' },
        runStyle: { fontFamily: '黑体', fontSize: '二号' },
      },
      'body': {
        name: '正文',
        type: 'paragraph',
        paragraphStyle: { spacing: { line: '360', lineRule: 'auto' } },
        runStyle: { fontFamily: '宋体', fontSize: '小四' },
      },
    },
  },
  paragraphRules: [
    {
      match: { paragraphType: 'paper-title' },
      format: {
        paragraphStyle: { alignment: 'center' },
        runStyle: { fontFamily: '黑体', fontSize: '二号' },
      },
      exclusive: true,
    },
    {
      match: { paragraphType: 'body' },
      format: {
        paragraphStyle: { spacing: { line: '360', lineRule: 'auto' } },
        runStyle: { fontFamily: '宋体', fontSize: '小四' },
      },
      exclusive: true,
    },
  ],
})

describe('parseFormatDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Test 1: valid description → valid SmartFormatSpec ----------
  it('should parse a valid Chinese format description into SmartFormatSpec with correct paragraphTypes', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: validLLMResponse,
      total_tokens: 150,
    })

    const result: ParseFormatDescResult = await parseFormatDescription(
      '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距',
      dummyApiConfig
    )

    // Token usage
    expect(result.tokenUsage).toBe(150)

    // styleProfile.styles
    expect(result.spec.styleProfile).toBeDefined()
    expect(result.spec.styleProfile!.styles).toBeDefined()

    const styles = result.spec.styleProfile!.styles!
    expect(styles['paper-title']).toBeDefined()
    expect(styles['paper-title'].name).toBe('论文题目')
    expect(styles['paper-title'].type).toBe('paragraph')
    expect(styles['body']).toBeDefined()
    expect(styles['body'].name).toBe('正文')

    // paragraphRules
    expect(result.spec.paragraphRules).toBeDefined()
    expect(result.spec.paragraphRules!.length).toBe(2)

    const titleRule = result.spec.paragraphRules!.find(
      r => r.match.paragraphType === 'paper-title'
    )
    expect(titleRule).toBeDefined()
    expect(titleRule!.exclusive).toBe(true)

    const bodyRule = result.spec.paragraphRules!.find(
      r => r.match.paragraphType === 'body'
    )
    expect(bodyRule).toBeDefined()
    expect(bodyRule!.exclusive).toBe(true)
  })

  // ---------- Test 2: font size normalization (Chinese names → half-points) ----------
  it('should normalize font size: "二号" → "44", "小四" → "24" via resolveFontSize', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: validLLMResponse,
      total_tokens: 100,
    })

    const result = await parseFormatDescription(
      '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距',
      dummyApiConfig
    )

    const styles = result.spec.styleProfile!.styles!

    // "二号" → "44"
    expect(styles['paper-title'].runStyle?.fontSize).toBe('44')
    // "小四" → "24"
    expect(styles['body'].runStyle?.fontSize).toBe('24')

    // paragraphRules also normalized
    const titleRule = result.spec.paragraphRules!.find(
      r => r.match.paragraphType === 'paper-title'
    )
    expect(titleRule!.format.runStyle?.fontSize).toBe('44')

    const bodyRule = result.spec.paragraphRules!.find(
      r => r.match.paragraphType === 'body'
    )
    expect(bodyRule!.format.runStyle?.fontSize).toBe('24')
  })

  // ---------- Test 2b: fontSize with "号" suffix ----------
  it('should normalize font sizes with "号" suffix (e.g. "小四号" → "24")', async () => {
    const jsonWithHao = JSON.stringify({
      styleProfile: {
        styles: {
          'body': {
            name: '正文',
            type: 'paragraph',
            runStyle: { fontFamily: '宋体', fontSize: '小四号' },
          },
        },
      },
      paragraphRules: [
        {
          match: { paragraphType: 'body' },
          format: { runStyle: { fontFamily: '宋体', fontSize: '小四号' } },
          exclusive: true,
        },
      ],
    })

    mockGetModelResponse.mockResolvedValue({ result: jsonWithHao, total_tokens: 50 })

    const result = await parseFormatDescription('正文 宋体 小四号', dummyApiConfig)

    expect(result.spec.styleProfile!.styles!['body'].runStyle?.fontSize).toBe('24')
    expect(result.spec.paragraphRules![0].format.runStyle?.fontSize).toBe('24')
  })

  // ---------- Test 2c: font family normalization via FONT_FAMILY_MAP ----------
  it('should normalize font families: 黑体→SimHei object, 宋体→SimSun object', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: validLLMResponse,
      total_tokens: 100,
    })

    const result = await parseFormatDescription(
      '论文题目 黑体 二号\n正文 宋体 小四',
      dummyApiConfig
    )

    const titleRun = result.spec.styleProfile!.styles!['paper-title'].runStyle!
    const bodyRun = result.spec.styleProfile!.styles!['body'].runStyle!

    expect(titleRun.fontFamily).toEqual({
      ascii: 'SimHei',
      eastAsia: '黑体',
      hAnsi: 'SimHei',
    })
    expect(bodyRun.fontFamily).toEqual({
      ascii: 'SimSun',
      eastAsia: '宋体',
      hAnsi: 'SimSun',
    })
  })

  // ---------- Test 2d: reverse lookup for English font name ----------
  it('should handle English font names via reverse lookup in FONT_FAMILY_MAP', async () => {
    const json = JSON.stringify({
      styleProfile: {
        styles: {
          'body': {
            name: '正文',
            type: 'paragraph',
            runStyle: { fontFamily: 'SimHei', fontSize: '四号' },
          },
        },
      },
      paragraphRules: [
        {
          match: { paragraphType: 'body' },
          format: { runStyle: { fontFamily: 'SimHei', fontSize: '四号' } },
          exclusive: true,
        },
      ],
    })

    mockGetModelResponse.mockResolvedValue({ result: json, total_tokens: 50 })
    const result = await parseFormatDescription('正文 SimHei', dummyApiConfig)

    expect(result.spec.styleProfile!.styles!['body'].runStyle?.fontFamily).toEqual({
      ascii: 'SimHei',
      eastAsia: '黑体',
      hAnsi: 'SimHei',
    })
  })

  // ---------- Test 2e: unknown font fallback ----------
  it('should fallback unknown font family to object with all fields set to the same name', async () => {
    const json = JSON.stringify({
      styleProfile: {
        styles: {
          'body': {
            name: '正文',
            type: 'paragraph',
            runStyle: { fontFamily: 'UnknownFont', fontSize: '五号' },
          },
        },
      },
      paragraphRules: [
        {
          match: { paragraphType: 'body' },
          format: { runStyle: { fontFamily: 'UnknownFont', fontSize: '五号' } },
          exclusive: true,
        },
      ],
    })

    mockGetModelResponse.mockResolvedValue({ result: json, total_tokens: 50 })
    const result = await parseFormatDescription('正文 UnknownFont', dummyApiConfig)

    expect(result.spec.styleProfile!.styles!['body'].runStyle?.fontFamily).toEqual({
      ascii: 'UnknownFont',
      eastAsia: 'UnknownFont',
      hAnsi: 'UnknownFont',
    })
  })

  // ---------- Test 3: invalid JSON response → error ----------
  it('should throw when LLM returns plain text (no JSON)', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: 'This is not JSON at all.',
      total_tokens: 10,
    })

    await expect(
      parseFormatDescription('论文题目 黑体', dummyApiConfig)
    ).rejects.toThrow('大模型未返回有效的格式参数 JSON')
  })

  // ---------- Test 3b: JSON inside markdown code block → extract successfully ----------
  it('should extract JSON from markdown code blocks', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: '```json\n' + validLLMResponse + '\n```',
      total_tokens: 150,
    })

    const result = await parseFormatDescription(
      '论文题目 黑体 二号 居中\n正文 宋体 小四号 1.5倍行距',
      dummyApiConfig
    )

    expect(result.tokenUsage).toBe(150)
    expect(result.spec.styleProfile!.styles!['paper-title']).toBeDefined()
  })

  // ---------- Test 3c: malformed JSON → error ----------
  it('should throw when JSON.parse fails on LLM response', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: '{ "styleProfile": { broken json here',
      total_tokens: 10,
    })

    await expect(
      parseFormatDescription('whatever', dummyApiConfig)
    ).rejects.toThrow('大模型返回的格式参数 JSON 解析失败')
  })

  // ---------- Test 3d: JSON array (not object) → error ----------
  it('should throw when LLM returns a JSON array instead of an object', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: '[]',
      total_tokens: 10,
    })

    await expect(
      parseFormatDescription('whatever', dummyApiConfig)
    ).rejects.toThrow('大模型未返回有效的格式参数 JSON')
  })

  // ---------- Test 4: empty description → error ----------
  it('should throw for empty description without calling LLM', async () => {
    await expect(
      parseFormatDescription('', dummyApiConfig)
    ).rejects.toThrow('格式描述不能为空')

    expect(mockGetModelResponse).not.toHaveBeenCalled()
  })

  // ---------- Test 4b: whitespace-only → error ----------
  it('should throw for whitespace-only description without calling LLM', async () => {
    await expect(
      parseFormatDescription('   \n\t  ', dummyApiConfig)
    ).rejects.toThrow('格式描述不能为空')

    expect(mockGetModelResponse).not.toHaveBeenCalled()
  })

  // ---------- Test 5: pageSettings preservation ----------
  it('should preserve pageSettings when LLM includes them', async () => {
    const json = JSON.stringify({
      styleProfile: {
        styles: {
          'body': {
            name: '正文',
            type: 'paragraph',
            runStyle: { fontFamily: '宋体', fontSize: '五号' },
          },
        },
      },
      paragraphRules: [
        {
          match: { paragraphType: 'body' },
          format: { runStyle: { fontFamily: '宋体', fontSize: '五号' } },
          exclusive: true,
        },
      ],
      pageSettings: {
        header: { text: '第一章 绪论' },
        pageNumbering: { position: 'bottom-center' },
      },
    })

    mockGetModelResponse.mockResolvedValue({ result: json, total_tokens: 80 })
    const result = await parseFormatDescription('页眉显示章标题，页码居中', dummyApiConfig)

    expect(result.spec.pageSettings).toBeDefined()
    expect(result.spec.pageSettings!.header?.text).toBe('第一章 绪论')
    expect(result.spec.pageSettings!.pageNumbering?.position).toBe('bottom-center')
  })

  // ---------- Test 6: verify LLM call arguments ----------
  it('should call getModelResponse with correct arguments', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: validLLMResponse,
      total_tokens: 100,
    })

    await parseFormatDescription('论文题目 黑体', dummyApiConfig)

    expect(mockGetModelResponse).toHaveBeenCalledTimes(1)
    const args = mockGetModelResponse.mock.calls[0]

    expect(args[0]).toBe(ModelProvider.OPENAI_COMPATIBLE)
    expect(args[1]).toContain('Word 文档格式参数提取专家')
    expect(args[2]).toContain('论文题目 黑体')
    expect(args[3]).toBe('sk-test-key')
    expect(args[4]).toBe('test-model')
    expect(args[5]).toBe('https://api.example.com')
  })
})

// ═══════════════════════════════════════════════════════════════════
//  mapRefProfileToRules tests
// ═══════════════════════════════════════════════════════════════════

/** 模拟参考文档的 StyleProfile（extractFormatProfile 返回格式） */
const mockRefProfile = {
  defaults: {
    paragraphStyle: { spacing: { line: '360' } },
    runStyle: { fontSize: '24', fontFamily: { ascii: 'SimSun', eastAsia: '宋体', hAnsi: 'SimSun' } },
  },
  styles: {
    '1': {
      name: 'heading 1',
      type: 'paragraph',
      basedOn: 'normal',
      paragraphStyle: { alignment: 'center', outlineLevel: '1', spacing: { before: '240', after: '120' } },
      runStyle: { fontSize: '44', bold: true, fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } },
    },
    '2': {
      name: 'heading 2',
      type: 'paragraph',
      basedOn: 'heading 1',
      paragraphStyle: { alignment: 'left', outlineLevel: '2' },
      runStyle: { fontSize: '32', bold: true, fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } },
    },
    '3': {
      name: 'Normal',
      type: 'paragraph',
      paragraphStyle: { spacing: { line: '360', lineRule: 'auto' } },
      runStyle: { fontSize: '24', fontFamily: { ascii: 'SimSun', eastAsia: '宋体', hAnsi: 'SimSun' } },
    },
    '4': {
      name: '标题',
      type: 'paragraph',
      paragraphStyle: { alignment: 'center' },
      runStyle: { fontSize: '52', bold: true, fontFamily: { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' } },
    },
  },
}

describe('mapRefProfileToRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Test 1: valid profile → valid SmartFormatSpec ----------
  it('should map valid profile styles to paragraph types and produce SmartFormatSpec', async () => {
    const llmMappingResponse = JSON.stringify({
      mappings: [
        { styleId: '1', paragraphType: 'chapter-title' },
        { styleId: '2', paragraphType: 'section-1-title' },
        { styleId: '3', paragraphType: 'body' },
        { styleId: '4', paragraphType: 'paper-title' },
      ],
    })

    mockGetModelResponse.mockResolvedValue({
      result: llmMappingResponse,
      total_tokens: 50,
    })

    const result = await mapRefProfileToRules(mockRefProfile, dummyApiConfig)

    // 验证 styleProfile
    expect(result.styleProfile).toBeDefined()
    expect(result.styleProfile!.defaults).toBeDefined()
    expect(result.styleProfile!.styles).toBeDefined()

    const styles = result.styleProfile!.styles!
    expect(Object.keys(styles)).toHaveLength(4)

    // 验证 chapter-title 样式属性
    expect(styles['chapter-title']).toBeDefined()
    expect(styles['chapter-title'].name).toBe('heading 1')
    expect(styles['chapter-title'].runStyle.fontSize).toBe('44')

    // 验证 body 样式属性
    expect(styles['body']).toBeDefined()
    expect(styles['body'].name).toBe('Normal')
    expect(styles['body'].runStyle.fontSize).toBe('24')

    // 验证 paragraphRules
    expect(result.paragraphRules).toBeDefined()
    expect(result.paragraphRules!.length).toBe(4)

    const ruleTypes = result.paragraphRules!.map((r) => r.match.paragraphType)
    expect(ruleTypes).toContain('chapter-title')
    expect(ruleTypes).toContain('section-1-title')
    expect(ruleTypes).toContain('body')
    expect(ruleTypes).toContain('paper-title')

    // 验证每个 rule 有正确的 format
    const bodyRule = result.paragraphRules!.find((r) => r.match.paragraphType === 'body')
    expect(bodyRule).toBeDefined()
    expect(bodyRule!.format.styleName).toBe('body')
  })

  // ---------- Test 2: LLM returns unknown paragraphType → gracefully skipped ----------
  it('should skip mappings with unknown paragraphType values', async () => {
    const llmResponseWithUnknown = JSON.stringify({
      mappings: [
        { styleId: '1', paragraphType: 'chapter-title' },           // valid
        { styleId: '2', paragraphType: 'ghost-title' },             // unknown → skip
        { styleId: '3', paragraphType: 'body' },                    // valid
        { styleId: '4', paragraphType: 'nonexistent-type' },        // unknown → skip
      ],
    })

    mockGetModelResponse.mockResolvedValue({
      result: llmResponseWithUnknown,
      total_tokens: 50,
    })

    const result = await mapRefProfileToRules(mockRefProfile, dummyApiConfig)

    // 只应有 2 个有效映射
    const styles = result.styleProfile!.styles!
    expect(Object.keys(styles)).toHaveLength(2)
    expect(styles['chapter-title']).toBeDefined()
    expect(styles['body']).toBeDefined()
    expect(styles['ghost-title']).toBeUndefined()
    expect(styles['nonexistent-type']).toBeUndefined()

    expect(result.paragraphRules!.length).toBe(2)
  })

  // ---------- Test 3: empty profile → empty SmartFormatSpec ----------
  it('should return empty SmartFormatSpec for empty or missing styles', async () => {
    const result1 = await mapRefProfileToRules({ styles: {} }, dummyApiConfig)
    expect(result1.styleProfile!.styles).toEqual({})
    expect(result1.paragraphRules).toEqual([])

    const result2 = await mapRefProfileToRules({}, dummyApiConfig)
    expect(result2.styleProfile!.styles).toEqual({})
    expect(result2.paragraphRules).toEqual([])

    const result3 = await mapRefProfileToRules(null, dummyApiConfig)
    expect(result3.styleProfile!.styles).toEqual({})
    expect(result3.paragraphRules).toEqual([])

    // 确保没有调用 LLM
    expect(mockGetModelResponse).not.toHaveBeenCalled()
  })

  // ---------- Test 4: LLM failure → throws descriptive error ----------
  it('should throw descriptive error when LLM call fails', async () => {
    mockGetModelResponse.mockRejectedValue(new Error('Network timeout'))

    await expect(
      mapRefProfileToRules(mockRefProfile, dummyApiConfig)
    ).rejects.toThrow('LLM 调用失败: Network timeout')
  })

  // ---------- Test 5: LLM returns invalid JSON → throws error ----------
  it('should throw error when LLM returns non-JSON output', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: '这是一段无效的回复，没有 JSON',
      total_tokens: 10,
    })

    await expect(
      mapRefProfileToRules(mockRefProfile, dummyApiConfig)
    ).rejects.toThrow('大模型未返回有效的 mapping JSON')
  })

  // ---------- Test 6: LLM returns JSON missing mappings array → throws error ----------
  it('should throw error when LLM response JSON lacks mappings array', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: JSON.stringify({ notMappings: [] }),
      total_tokens: 10,
    })

    await expect(
      mapRefProfileToRules(mockRefProfile, dummyApiConfig)
    ).rejects.toThrow('大模型返回的 JSON 缺少 mappings 数组')
  })

  // ---------- Test 7: LLM called with correct parameters ----------
  it('should call getModelResponse with correct parameters', async () => {
    const llmResponse = JSON.stringify({
      mappings: [
        { styleId: '1', paragraphType: 'chapter-title' },
        { styleId: '3', paragraphType: 'body' },
      ],
    })

    mockGetModelResponse.mockResolvedValue({
      result: llmResponse,
      total_tokens: 30,
    })

    await mapRefProfileToRules(mockRefProfile, dummyApiConfig)

    expect(mockGetModelResponse).toHaveBeenCalledTimes(1)
    const args = mockGetModelResponse.mock.calls[0]

    expect(args[0]).toBe(ModelProvider.OPENAI_COMPATIBLE)
    expect(args[1]).toContain('Word 文档格式分析专家')
    expect(args[2]).toContain('heading 1')
    expect(args[2]).toContain('Normal')
    expect(args[2]).toContain('标题')
    expect(args[3]).toBe('sk-test-key')
    expect(args[4]).toBe('test-model')
    expect(args[5]).toBe('https://api.example.com')
  })

  // ---------- Test 8: LLM returns empty mappings array → valid empty result ----------
  it('should return empty SmartFormatSpec when LLM returns empty mappings', async () => {
    mockGetModelResponse.mockResolvedValue({
      result: JSON.stringify({ mappings: [] }),
      total_tokens: 10,
    })

    const result = await mapRefProfileToRules(mockRefProfile, dummyApiConfig)

    expect(result.styleProfile!.styles).toEqual({})
    expect(result.paragraphRules).toEqual([])
  })

  // ---------- Test 9: styleId not found in profile → skipped ----------
  it('should skip mappings where styleId does not exist in profile', async () => {
    const llmResponse = JSON.stringify({
      mappings: [
        { styleId: '1', paragraphType: 'chapter-title' },   // exists
        { styleId: '999', paragraphType: 'body' },           // does NOT exist → skip
        { styleId: '3', paragraphType: 'body' },             // exists
      ],
    })

    mockGetModelResponse.mockResolvedValue({
      result: llmResponse,
      total_tokens: 30,
    })

    const result = await mapRefProfileToRules(mockRefProfile, dummyApiConfig)

    expect(Object.keys(result.styleProfile!.styles!)).toHaveLength(2)
    expect(result.paragraphRules!.length).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════
//  classifyParagraphsWithLLM tests
// ═══════════════════════════════════════════════════════════════════

/** 生成指定数量的模拟段落元数据 */
function makeMetadata(count: number): ParagraphMetadata[] {
  const result: ParagraphMetadata[] = []
  for (let i = 0; i < count; i++) {
    result.push({
      index: i,
      firstChars: `Paragraph ${i} text content here for testing purposes.`,
      headingLevel: i === 0 ? 1 : i === 2 ? 2 : null,
      styleId: i === 0 ? 'heading1' : 'Normal',
      text: `Paragraph ${i} full text content here for testing purposes with more characters.`,
      isBold: i === 0,
      sectionType: null,
    })
  }
  return result
}

/** 生成模拟的启发式分类结果 */
function makeHeuristicResult(count: number): Map<number, ParagraphType> {
  const result = new Map<number, ParagraphType>()
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      result.set(i, 'chapter-title')
    } else if (i === 2) {
      result.set(i, 'section-1-title')
    } else {
      result.set(i, 'body')
    }
  }
  return result
}

/** 生成 LLM 返回的分类 JSON（全部高置信度） */
function makeHighConfidenceResponse(indices: number[]): string {
  const classifications = indices.map((i) => ({
    index: i,
    type: i === 0 ? 'chapter-title' : i === 2 ? 'section-1-title' : 'body',
    confidence: 0.9,
  }))
  return JSON.stringify({ classifications })
}

describe('classifyParagraphsWithLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Test 1: batch splitting ──
  it('should split 50 paragraphs into 2 batches of 25', async () => {
    const metadata = makeMetadata(50)
    const heuristic = makeHeuristicResult(50)

    // Batch 1 (indices 0-24)
    mockGetModelResponse.mockResolvedValueOnce({
      result: makeHighConfidenceResponse(
        Array.from({ length: 25 }, (_, i) => i)
      ),
      total_tokens: 200,
    })
    // Batch 2 (indices 25-49)
    mockGetModelResponse.mockResolvedValueOnce({
      result: makeHighConfidenceResponse(
        Array.from({ length: 25 }, (_, i) => i + 25)
      ),
      total_tokens: 200,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(false)
    expect(result.tokenUsage).toBe(400)
    expect(result.classifications.size).toBe(50)
    expect(mockGetModelResponse).toHaveBeenCalledTimes(2)
  })

  // ── Test 2: empty metadata ──
  it('should return empty result for empty metadata without LLM calls', async () => {
    const result = await classifyParagraphsWithLLM([], new Map(), dummyApiConfig)

    expect(result.classifications.size).toBe(0)
    expect(result.fallbackMode).toBe(false)
    expect(result.tokenUsage).toBe(0)
    expect(mockGetModelResponse).not.toHaveBeenCalled()
  })

  // ── Test 3: high confidence LLM results used ──
  it('should use LLM classification when confidence >= 0.7', async () => {
    const metadata = makeMetadata(5)
    const heuristic = makeHeuristicResult(5)

    // LLM classifies index 1 as 'abstract-cn-content' with high confidence
    mockGetModelResponse.mockResolvedValueOnce({
      result: JSON.stringify({
        classifications: [
          { index: 0, type: 'chapter-title', confidence: 0.95 },
          { index: 1, type: 'abstract-cn-content', confidence: 0.85 },
          { index: 2, type: 'section-1-title', confidence: 0.9 },
          { index: 3, type: 'keywords-cn-body', confidence: 0.8 },
          { index: 4, type: 'conclusion-content', confidence: 0.75 },
        ],
      }),
      total_tokens: 100,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(false)
    // All LLM results have high confidence → all should be LLM types
    expect(result.classifications.get(0)).toBe('chapter-title')
    expect(result.classifications.get(1)).toBe('abstract-cn-content')
    expect(result.classifications.get(2)).toBe('section-1-title')
    expect(result.classifications.get(3)).toBe('keywords-cn-body')
    expect(result.classifications.get(4)).toBe('conclusion-content')
  })

  // ── Test 4: low confidence LLM → heuristic used ──
  it('should fall back to heuristic when LLM confidence < 0.7', async () => {
    const metadata = makeMetadata(3)
    const heuristic = makeHeuristicResult(3)
    // heuristic: 0=chapter-title, 2=section-1-title

    mockGetModelResponse.mockResolvedValueOnce({
      result: JSON.stringify({
        classifications: [
          { index: 0, type: 'body', confidence: 0.5 },
          { index: 1, type: 'abstract-en-content', confidence: 0.3 },
          { index: 2, type: 'toc-chapter', confidence: 0.6 },
        ],
      }),
      total_tokens: 50,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(false)
    // All LLM confidences < 0.7 → all should use heuristic
    expect(result.classifications.get(0)).toBe('chapter-title')
    expect(result.classifications.get(1)).toBe('body')
    expect(result.classifications.get(2)).toBe('section-1-title')
  })

  // ── Test 5: mixed confidence → hybrid merge ──
  it('should use LLM for high confidence and heuristic for low confidence', async () => {
    const metadata = makeMetadata(4)
    const heuristic = makeHeuristicResult(4)
    // heuristic: 0=chapter-title, 2=section-1-title, 1=body, 3=body

    mockGetModelResponse.mockResolvedValueOnce({
      result: JSON.stringify({
        classifications: [
          { index: 0, type: 'paper-title', confidence: 0.9 },    // high → LLM
          { index: 1, type: 'abstract-cn-title', confidence: 0.4 }, // low → heuristic
          { index: 2, type: 'toc-chapter', confidence: 0.5 },       // low → heuristic
          { index: 3, type: 'references-content', confidence: 0.8 }, // high → LLM
        ],
      }),
      total_tokens: 80,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.classifications.get(0)).toBe('paper-title')       // LLM (0.9)
    expect(result.classifications.get(1)).toBe('body')             // heuristic (body)
    expect(result.classifications.get(2)).toBe('section-1-title')  // heuristic
    expect(result.classifications.get(3)).toBe('references-content') // LLM (0.8)
  })

  // ── Test 6: LLM network error → fallback ──
  it('should fallback to heuristic entirely on LLM network error', async () => {
    const metadata = makeMetadata(10)
    const heuristic = makeHeuristicResult(10)

    mockGetModelResponse.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(true)
    expect(result.classifications).toBe(heuristic) // same Map reference
    expect(result.classifications.size).toBe(10)
    // Should still have heuristic types
    expect(result.classifications.get(0)).toBe('chapter-title')
    expect(result.classifications.get(1)).toBe('body')
  })

  // ── Test 7: LLM returns invalid JSON → fallback ──
  it('should fallback to heuristic when LLM returns plain text', async () => {
    const metadata = makeMetadata(5)
    const heuristic = makeHeuristicResult(5)

    mockGetModelResponse.mockResolvedValueOnce({
      result: 'This is not JSON, just plain text response.',
      total_tokens: 10,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(true)
    expect(result.classifications.size).toBe(5)
    expect(result.classifications.get(0)).toBe('chapter-title')
    expect(result.classifications.get(2)).toBe('section-1-title')
  })

  // ── Test 8: LLM returns unknown paragraphType → filtered, valid ones used ──
  it('should skip unknown paragraphType from LLM and use heuristic for those', async () => {
    const metadata = makeMetadata(3)
    const heuristic = makeHeuristicResult(3)
    // heuristic: 0=chapter-title, 2=section-1-title, 1=body

    mockGetModelResponse.mockResolvedValueOnce({
      result: JSON.stringify({
        classifications: [
          { index: 0, type: 'ghost-type', confidence: 0.9 },    // unknown → skipped
          { index: 1, type: 'abstract-cn-title', confidence: 0.8 }, // valid, high → LLM
          { index: 2, type: 'invalid-type', confidence: 0.95 },  // unknown → skipped
        ],
      }),
      total_tokens: 40,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    // index 0: LLM type invalid → heuristic chapter-title
    expect(result.classifications.get(0)).toBe('chapter-title')
    // index 1: LLM valid high confidence → abstract-cn-title
    expect(result.classifications.get(1)).toBe('abstract-cn-title')
    // index 2: LLM type invalid → heuristic section-1-title
    expect(result.classifications.get(2)).toBe('section-1-title')
  })

  // ── Test 9: LLM returns JSON inside markdown code block → extract and use ──
  it('should extract JSON from markdown code block response', async () => {
    const metadata = makeMetadata(2)
    const heuristic = makeHeuristicResult(2)

    const jsonContent = JSON.stringify({
      classifications: [
        { index: 0, type: 'paper-title', confidence: 0.95 },
        { index: 1, type: 'abstract-en-title', confidence: 0.9 },
      ],
    })

    mockGetModelResponse.mockResolvedValueOnce({
      result: '```json\n' + jsonContent + '\n```',
      total_tokens: 60,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(false)
    expect(result.classifications.get(0)).toBe('paper-title')
    expect(result.classifications.get(1)).toBe('abstract-en-title')
  })

  // ── Test 10: partial batch failure → full fallback ──
  it('should fallback entirely if any one of multiple batches fails', async () => {
    const metadata = makeMetadata(50)
    const heuristic = makeHeuristicResult(50)

    // Batch 1 succeeds
    mockGetModelResponse.mockResolvedValueOnce({
      result: makeHighConfidenceResponse(
        Array.from({ length: 25 }, (_, i) => i)
      ),
      total_tokens: 200,
    })
    // Batch 2 fails
    mockGetModelResponse.mockRejectedValueOnce(new Error('API rate limit'))

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(true)
    expect(result.classifications).toBe(heuristic)
    // Token usage from successful batch still counted
    expect(result.tokenUsage).toBe(200)
  })

  // ── Test 11: no LLM entries for some indices → merge falls back to heuristic ──
  it('should fall back to heuristic for indices not covered by LLM', async () => {
    const metadata = makeMetadata(5)
    const heuristic = makeHeuristicResult(5)

    // LLM only returns 2 out of 5 paragraphs
    mockGetModelResponse.mockResolvedValueOnce({
      result: JSON.stringify({
        classifications: [
          { index: 0, type: 'paper-title', confidence: 0.95 },
          { index: 3, type: 'conclusion-title', confidence: 0.9 },
        ],
      }),
      total_tokens: 50,
    })

    const result = await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(result.fallbackMode).toBe(false)
    expect(result.classifications.get(0)).toBe('paper-title')       // LLM high
    expect(result.classifications.get(1)).toBe('body')             // heuristic
    expect(result.classifications.get(2)).toBe('section-1-title')  // heuristic
    expect(result.classifications.get(3)).toBe('conclusion-title') // LLM high
    expect(result.classifications.get(4)).toBe('body')             // heuristic
  })

  // ── Test 12: context includes prevTypes from heuristic and nextFirstChars from metadata ──
  it('should send context with prevTypes from heuristic and nextFirstChars from metadata', async () => {
    const metadata = makeMetadata(5)
    const heuristic = makeHeuristicResult(5)

    mockGetModelResponse.mockResolvedValueOnce({
      result: makeHighConfidenceResponse([0, 1, 2, 3, 4]),
      total_tokens: 100,
    })

    await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    const userMessage = JSON.parse(mockGetModelResponse.mock.calls[0][2])

    // Check paragraph at index 2
    const para2 = userMessage.find((p: any) => p.index === 2)
    expect(para2.context.prevTypes).toEqual(['chapter-title', 'body'])
    expect(para2.context.nextFirstChars.length).toBe(2)

    // Check paragraph at index 0 (no prev)
    const para0 = userMessage.find((p: any) => p.index === 0)
    expect(para0.context.prevTypes).toEqual([null, null])

    // Check paragraph at index 4 (no next)
    const para4 = userMessage.find((p: any) => p.index === 4)
    expect(para4.context.nextFirstChars).toEqual(['', ''])
  })

  // ── Test 13: verify LLM call arguments ──
  it('should call getModelResponse with correct arguments', async () => {
    const metadata = makeMetadata(3)
    const heuristic = makeHeuristicResult(3)

    mockGetModelResponse.mockResolvedValueOnce({
      result: makeHighConfidenceResponse([0, 1, 2]),
      total_tokens: 30,
    })

    await classifyParagraphsWithLLM(metadata, heuristic, dummyApiConfig)

    expect(mockGetModelResponse).toHaveBeenCalledTimes(1)
    const args = mockGetModelResponse.mock.calls[0]

    expect(args[0]).toBe(ModelProvider.OPENAI_COMPATIBLE)
    expect(args[1]).toContain('Word 文档段落分类专家')
    expect(args[2]).toContain('Paragraph 0')
    expect(args[3]).toBe('sk-test-key')
    expect(args[4]).toBe('test-model')
    expect(args[5]).toBe('https://api.example.com')
  })

  // ── Test 14: null metadata safety ──
  it('should handle null metadata gracefully', async () => {
    const result = await classifyParagraphsWithLLM(
      null as any,
      new Map(),
      dummyApiConfig
    )

    expect(result.classifications.size).toBe(0)
    expect(result.fallbackMode).toBe(false)
    expect(result.tokenUsage).toBe(0)
    expect(mockGetModelResponse).not.toHaveBeenCalled()
  })
})
