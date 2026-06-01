import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import { loadDocx } from 'docx-edit'
import {
  extractParagraphMetadata,
  ParagraphMetadata,
  parseFormatDescription,
  ParseFormatDescResult,
  mapRefProfileToRules,
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
