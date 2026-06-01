import type { ParagraphType } from './smartFormatApply'
const { loadDocx } = require('docx-edit')

// ========== Types ==========

export interface ParagraphMetadata {
  index: number           // paragraph position (0-based)
  firstChars: string      // first 80 characters (for LLM, not full text)
  headingLevel: number | null  // from paragraph.getHeadingLevel()
  styleId: string         // from paragraph.getStyle().styleId
  text: string            // full paragraph text (for content immutability check)
  isBold: boolean         // first run is bold?
  sectionType: string | null  // heuristic pre-classification: 'abstract'|'keywords'|'toc'|'conclusion'|etc
}

interface SectionRange {
  start: number
  end: number
  sectionType: string
  headingLevel: number | null
}

// ========== Section Detection (replicated from smartFormatApply to avoid circular deps) ==========

/**
 * 从段落列表中构建节范围（以标题为边界）。
 * 识别"摘要"、"结论"等节。
 */
function buildSectionRanges(paragraphs: any[]): SectionRange[] {
  const boundaries: { index: number; text: string; level: number | null }[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    let level: number | null = null
    try { level = paragraphs[i].getHeadingLevel() } catch { /* ignore */ }
    const text = (paragraphs[i].getText() || '').trim()
    const isHeadingLike = level != null ||
      /^摘要|^abstract|^引言|^introduction|^结论|^conclusion|^参考文献|^references|^致谢|^acknowledgement|^附录|^appendix|^第[一二三四五六七八九十\d]+章|^第[一二三四五六七八九十\d]+[章节篇]/.test(text)

    if (isHeadingLike) {
      boundaries.push({ index: i, text, level })
    }
  }

  const ranges: SectionRange[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].index
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : paragraphs.length
    const headingText = boundaries[i].text.toLowerCase().replace(/\s+/g, '')

    let sectionType = 'body'
    if (headingText.includes('摘要') || headingText.includes('abstract')) {
      sectionType = 'abstract'
    } else if (headingText.startsWith('关键词') || headingText.startsWith('keywords')) {
      sectionType = 'keywords'
    } else if (headingText.startsWith('结论') || headingText.startsWith('conclusion')) {
      sectionType = 'conclusion'
    } else if (headingText.startsWith('参考文献') || headingText.startsWith('references') || headingText.startsWith('bibliography')) {
      sectionType = 'references'
    } else if (headingText.startsWith('致谢') || headingText.startsWith('acknowledgement')) {
      sectionType = 'acknowledgement'
    } else if (headingText.startsWith('附录') || headingText.startsWith('appendix')) {
      sectionType = 'appendix'
    }

    ranges.push({
      start,
      end,
      sectionType,
      headingLevel: boundaries[i].level,
    })
  }

  return ranges
}

/**
 * 检测单个段落是否匹配给定的 sectionType。
 * 使用任务定义的启发式规则。
 */
function paragraphMatchesSectionType(
  paragraph: any,
  sectionType: string,
  styleProfile: any,
  sectionRanges: SectionRange[],
  paraIndex: number
): boolean {
  const text = (paragraph.getText() || '').trim()
  const normalizedText = text.toLowerCase().replace(/\s+/g, '')
  const paraStyle = (() => {
    try { return paragraph.getStyle() || {} } catch { return {} }
  })()
  const styleId: string = (paraStyle.styleId || '').toString()

  switch (sectionType) {
    case 'abstract':
      if (text.includes('摘要') || /^abstract/i.test(normalizedText)) return true
      for (const range of sectionRanges) {
        if (range.sectionType === 'abstract' &&
            paraIndex >= range.start && paraIndex < range.end) {
          return true
        }
      }
      return false

    case 'keywords':
      return /^关键词|^keywords|^key\s*words/i.test(text)

    case 'toc':
      if (/^(TOC|toc)/i.test(styleId)) return true
      if (/^1\d$/.test(styleId)) return true
      return false

    case 'conclusion':
      return /^结论|^conclusion/i.test(text)

    case 'references':
      return /^参考文献|^references|^bibliography/i.test(text)

    case 'acknowledgement':
      return /^致谢|^acknowledgement/i.test(text)

    case 'appendix':
      return /^附录|^appendix/i.test(text)

    default:
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════
//  formatDescription → SmartFormatSpec (LLM-based parser)
// ═══════════════════════════════════════════════════════════════════

import { getModelResponse } from './chat'
import type { apiSettings } from './database'
import { SmartFormatSpec, ParagraphFormatRule, applySmartFormat, SmartFormatResult } from './smartFormatApply'
import { resolveFontSize, FONT_FAMILY_MAP } from '../shared/chineseFontSize'
import { extractFormatProfile } from './formatClone'

// ========== Types (parser) ==========

export interface ParseFormatDescResult {
  spec: SmartFormatSpec
  tokenUsage: number
}

// ========== System Prompt ==========

const FORMAT_PARSER_SYSTEM_PROMPT = `你是一个专业的 Word 文档格式参数提取专家。用户会给你一段关于文档格式的自然语言描述（通常为中文），你需要将其转换成结构化的 JSON 格式参数，用于后续的文档格式自动化应用。

你需要输出的 JSON 结构如下：

{
  "styleProfile": {
    "defaults": {
      "paragraphStyle": { ... },
      "runStyle": { ... }
    },
    "styles": {
      "<styleId>": {
        "name": "<用户描述中的样式名称>",
        "type": "paragraph",
        "paragraphStyle": { ... },
        "runStyle": { ... }
      }
    }
  },
  "paragraphRules": [
    {
      "match": { "paragraphType": "<ParagraphType 值>" },
      "format": {
        "paragraphStyle": { ... },
        "runStyle": { ... }
      },
      "exclusive": true
    }
  ],
  "pageSettings": {
    "header": { "text": "...", "runStyle": { ... }, "paragraphStyle": { ... } },
    "footer": { "text": "...", "runStyle": { ... }, "paragraphStyle": { ... } },
    "pageNumbering": {
      "position": "bottom-center | bottom-right | top-center | top-right",
      "runStyle": { ... }
    }
  }
}

【关键】paragraphType 可用值（必须从以下列表中精确选取）：
- paper-title         → 论文题目 / 文章标题
- chapter-title       → 章标题（如"第一章 绪论"）
- section-1-title     → 一级节标题（如"1.1"）
- section-2-title     → 二级节标题（如"1.1.1"）
- section-3-title     → 三级节标题（如"1.1.1.1"）
- item-title          → （1）条目标题
- body                → 正文段落
- abstract-cn-title   → 中文摘要标题
- abstract-cn-content → 中文摘要内容
- abstract-en-title   → 英文摘要标题
- abstract-en-content → 英文摘要内容
- keywords-cn-title   → 中文关键词标题
- keywords-cn-body    → 中文关键词内容
- keywords-en-title   → 英文关键词标题
- keywords-en-body    → 英文关键词内容
- conclusion-title    → 结论标题
- conclusion-content  → 结论内容
- references-title    → 参考文献标题
- references-content  → 参考文献条目
- toc-title           → 目录标题
- toc-chapter         → 目录中的章级条目
- toc-other           → 目录中的其他条目
- acknowledgement-title → 致谢标题
- appendix-title      → 附录标题

段落样式(paragraphStyle)常用字段（与 docx-edit 一致）：
- alignment: 对齐方式，可选 "left","center","right","both","distribute"
- spacing: 段落间距，对象 { before: "数值(twips)", after: "数值(twips)", line: "数值(twips)", lineRule: "auto | exact | atLeast" }
- outlineLevel: 大纲级别，数字 0~9（0=正文，1=标题1，以此类推）
- indent: 缩进，对象 { left: "数值(twips)", right: "数值(twips)", firstLine: "数值(twips)" }
- keepNext: 是否与下段同页，布尔值
- keepLines: 是否段中不分页，布尔值
- pageBreakBefore: 是否段前分页，布尔值
- widowControl: 是否寡孤行控制，布尔值

文本样式(runStyle)常用字段（字号和字体请用中文名称，后续会自动转换）：
- fontSize: 字号，用中文字号名（如"二号"、"小四"、"五号"）或 pt 值（如"14pt"）
- fontFamily: 字体名，用中文名称（如"黑体"、"宋体"、"楷体"、"仿宋"），不要输出对象格式
- color: 字体颜色，十六进制字符串如 "000000"
- bold: 是否加粗，布尔值
- italic: 是否斜体，布尔值
- underline: 下划线类型，字符串

常用字号中英文对照（供参考）：
- 初号=84, 小初=72, 一号=52, 小一=48
- 二号=44, 小二=36, 三号=32, 小三=30
- 四号=28, 小四=24, 五号=21, 小五=18

中文字体英文名对照（供参考）：
- 黑体 → SimHei, 宋体 → SimSun, 楷体 → KaiTi, 仿宋 → FangSong

行距换算规则：
- 单倍行距 → lineRule: "auto", line: "240"
- 1.5倍行距 → lineRule: "auto", line: "360"
- 双倍行距 → lineRule: "auto", line: "480"
- 固定行距（如"22磅"）→ lineRule: "exact", line: "440"（22×20）
- 间距单位 twips：1磅=20twips，1厘米≈567twips

示例：
用户描述：
"论文题目 黑体 二号 居中\\n正文 宋体 小四号 1.5倍行距"

应输出：
{
  "styleProfile": {
    "styles": {
      "paper-title": {
        "name": "论文题目",
        "type": "paragraph",
        "paragraphStyle": { "alignment": "center" },
        "runStyle": { "fontFamily": "黑体", "fontSize": "二号" }
      },
      "body": {
        "name": "正文",
        "type": "paragraph",
        "paragraphStyle": { "spacing": { "line": "360", "lineRule": "auto" } },
        "runStyle": { "fontFamily": "宋体", "fontSize": "小四" }
      }
    }
  },
  "paragraphRules": [
    {
      "match": { "paragraphType": "paper-title" },
      "format": {
        "paragraphStyle": { "alignment": "center" },
        "runStyle": { "fontFamily": "黑体", "fontSize": "二号" }
      },
      "exclusive": true
    },
    {
      "match": { "paragraphType": "body" },
      "format": {
        "paragraphStyle": { "spacing": { "line": "360", "lineRule": "auto" } },
        "runStyle": { "fontFamily": "宋体", "fontSize": "小四" }
      },
      "exclusive": true
    }
  ]
}

重要规则：
1. 只输出 JSON，不要输出任何解释性文字。
2. styleId 请使用 paragraphType 值（如 "paper-title"、"body"），保持与 paragraphRules.match.paragraphType 一致。
3. 用户提到的每种格式，既要放进 styleProfile.styles，也要在 paragraphRules 中创建对应的规则。
4. 如果用户描述中提到了页码/页眉/页脚，请填充 pageSettings 字段。
5. fontSize 请用中文字号名（如"小二"、"四号"），fontFamily 请用中文字体名（如"黑体"），不要自己转换——后续程序会自动处理。
6. 如果用户描述不够明确，请做合理推断。
7. 空的字段（如没有 defaults）可以省略不输出。`

// ========== JSON Extraction ==========

/**
 * 从可能包含 markdown 代码块的文本中提取 JSON 字符串。
 */
function extractFormatJSON(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return trimmed
  }

  // 尝试从 ```json ... ``` 中提取
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // 尝试找到第一个 { 到最后一个 }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1)
  }

  return null
}

// ========== Post-processing ==========

/**
 * 递归遍历所有 runStyle，对其中的 fontSize 和 fontFamily 做归一化处理。
 */
function normalizeRunStyle(runStyle: Record<string, any> | undefined): void {
  if (!runStyle) return

  // 1. 归一化 fontSize：中文字号名/pt → half-point 数值字符串
  if (typeof runStyle.fontSize === 'string') {
    runStyle.fontSize = resolveFontSize(runStyle.fontSize)
  }

  // 2. 归一化 fontFamily：中文字体名/英文名 → docx-edit 对象格式 { ascii, eastAsia, hAnsi }
  if (runStyle.fontFamily) {
    if (typeof runStyle.fontFamily === 'string') {
      const fontName = runStyle.fontFamily.trim()
      // 1) 精确匹配中文字体名（如"黑体"）
      const mapped = FONT_FAMILY_MAP[fontName]
      if (mapped) {
        runStyle.fontFamily = { ...mapped }
      } else {
        // 2) 反向匹配英文名（如"SimHei", "SimSun"）
        let found = false
        for (const mapping of Object.values(FONT_FAMILY_MAP)) {
          if (mapping.ascii === fontName || mapping.eastAsia === fontName) {
            runStyle.fontFamily = { ...mapping }
            found = true
            break
          }
        }
        if (!found) {
          // 3) 兜底：转成对象格式
          runStyle.fontFamily = {
            ascii: fontName,
            eastAsia: fontName,
            hAnsi: fontName,
          }
        }
      }
    } else if (typeof runStyle.fontFamily === 'object' && !Array.isArray(runStyle.fontFamily)) {
      // 已经是对象，补齐缺失字段
      const ff = runStyle.fontFamily
      if (!ff.ascii) ff.ascii = ff.eastAsia || ff.hAnsi || 'SimSun'
      if (!ff.eastAsia) ff.eastAsia = ff.ascii || ff.hAnsi || '宋体'
      if (!ff.hAnsi) ff.hAnsi = ff.ascii || ff.eastAsia || 'SimSun'
    }
  }
}

/**
 * 对 LLM 解析出的 SmartFormatSpec 做后处理：
 * - 归一化所有 runStyle 中的 fontSize
 * - 使用 FONT_FAMILY_MAP 校验/转换 fontFamily
 */
function postProcessSpec(spec: SmartFormatSpec): void {
  // 处理 styleProfile.defaults
  if (spec.styleProfile?.defaults) {
    normalizeRunStyle(spec.styleProfile.defaults.runStyle)
  }

  // 处理 styleProfile.styles 中的每个条目
  if (spec.styleProfile?.styles) {
    for (const style of Object.values(spec.styleProfile.styles)) {
      normalizeRunStyle((style as any).runStyle)
    }
  }

  // 处理 paragraphRules 中每个规则的 format.runStyle
  if (spec.paragraphRules) {
    for (const rule of spec.paragraphRules) {
      normalizeRunStyle(rule.format?.runStyle)
    }
  }

  // 处理 pageSettings 中的 runStyle
  if (spec.pageSettings?.header) {
    normalizeRunStyle(spec.pageSettings.header.runStyle)
  }
  if (spec.pageSettings?.footer) {
    normalizeRunStyle(spec.pageSettings.footer.runStyle)
  }
  if (spec.pageSettings?.pageNumbering) {
    normalizeRunStyle(spec.pageSettings.pageNumbering.runStyle)
  }
}

// ========== Main Parser Export ==========

/**
 * 将自然语言格式描述通过大模型解析为 SmartFormatSpec 结构。
 *
 * 用户输入中文格式描述（如"论文题目 黑体 二号 居中\\n正文 宋体 小四号 1.5倍行距"），
 * 经由 LLM 解析为包含 styleProfile 和 paragraphRules 的结构化格式规范。
 *
 * @param description - 用户输入的自然语言格式描述
 * @param apiConfig  - API 配置（provider, apiKey, modelName, apiURL）
 * @returns 解析后的 SmartFormatSpec 和 token 用量
 * @throws 如果描述为空、LLM 返回无效 JSON 或解析失败
 */
export async function parseFormatDescription(
  description: string,
  apiConfig: apiSettings
): Promise<ParseFormatDescResult> {
  // 基本校验
  if (!description || !description.trim()) {
    throw new Error('格式描述不能为空')
  }

  // 调用 LLM
  const { result, total_tokens } = await getModelResponse(
    apiConfig.provider,
    FORMAT_PARSER_SYSTEM_PROMPT,
    `请将以下格式描述转换为结构化的 JSON 格式参数：\n\n${description}`,
    apiConfig.apiKey,
    apiConfig.modelName,
    apiConfig.apiURL
  )

  // 从 LLM 回复中提取 JSON
  const jsonStr = extractFormatJSON(result)
  if (!jsonStr) {
    throw new Error('大模型未返回有效的格式参数 JSON')
  }

  let raw: any
  try {
    raw = JSON.parse(jsonStr)
  } catch {
    throw new Error('大模型返回的格式参数 JSON 解析失败')
  }

  // 基本结构校验
  if (!raw || typeof raw !== 'object') {
    throw new Error('大模型返回的格式参数结构不正确')
  }

  // 构建 SmartFormatSpec
  const spec: SmartFormatSpec = {}

  // styleProfile
  if (raw.styleProfile && typeof raw.styleProfile === 'object') {
    spec.styleProfile = {}
    if (raw.styleProfile.defaults) {
      spec.styleProfile.defaults = raw.styleProfile.defaults
    }
    if (raw.styleProfile.styles && typeof raw.styleProfile.styles === 'object') {
      spec.styleProfile.styles = raw.styleProfile.styles
    }
  }

  // paragraphRules
  if (Array.isArray(raw.paragraphRules)) {
    spec.paragraphRules = raw.paragraphRules.filter(
      (r: any) => r && typeof r === 'object' && r.match && r.format
    )
  }

  // pageSettings
  if (raw.pageSettings && typeof raw.pageSettings === 'object') {
    spec.pageSettings = raw.pageSettings
  }

  // 后处理：归一化 fontSize/fontFamily
  postProcessSpec(spec)

  return { spec, tokenUsage: total_tokens }
}

// ═══════════════════════════════════════════════════════════════════
//  mapRefProfileToRules (reference doc profile → SmartFormatSpec)
// ═══════════════════════════════════════════════════════════════════

/** 已知的 ParagraphType 值集合，用于校验 LLM 输出 */
const VALID_PARAGRAPH_TYPES: Set<string> = new Set<ParagraphType>([
  'paper-title',
  'chapter-title',
  'section-1-title',
  'section-2-title',
  'section-3-title',
  'item-title',
  'body',
  'abstract-cn-title',
  'abstract-cn-content',
  'abstract-en-title',
  'abstract-en-content',
  'keywords-cn-title',
  'keywords-cn-body',
  'keywords-en-title',
  'keywords-en-body',
  'conclusion-title',
  'conclusion-content',
  'references-title',
  'references-content',
  'toc-title',
  'toc-chapter',
  'toc-other',
  'acknowledgement-title',
  'appendix-title',
])

// ========== Prompt ==========

const REF_MAPPING_SYSTEM_PROMPT = `你是一个专业的 Word 文档格式分析专家。你会收到一个参考文档的样式列表，包含每个样式的名称、类型（paragraph/character）以及该样式的格式属性（如字号、字体、是否加粗等）。

你需要根据样式的名称和属性推断每个样式对应的段落类型（paragraphType），输出 JSON 格式的映射关系。

## 段落类型说明

以下是所有可用的 paragraphType 值及其含义：

| paragraphType | 含义 | 典型样式名特征 |
|---|---|---|
| paper-title | 论文主标题 | 标题、Title、文档标题 |
| chapter-title | 章标题（一级标题） | 标题 1、Heading 1、第X章 |
| section-1-title | 一级节标题（二级标题） | 标题 2、Heading 2 |
| section-2-title | 二级节标题（三级标题） | 标题 3、Heading 3 |
| section-3-title | 三级节标题（四级标题） | 标题 4、Heading 4 |
| item-title | 更小的条目标题 | 标题 5-9、列表标题 |
| body | 正文 | 正文、Normal、普通段落 |
| abstract-cn-title | 中文摘要标题 | "摘要" |
| abstract-cn-content | 中文摘要内容 | 摘要的正文 |
| abstract-en-title | 英文摘要标题 | "Abstract" |
| abstract-en-content | 英文摘要内容 | Abstract 正文 |
| keywords-cn-title | 中文关键词标题 | "关键词" |
| keywords-cn-body | 中文关键词内容 | 关键词列表 |
| keywords-en-title | 英文关键词标题 | "Keywords" |
| keywords-en-body | 英文关键词内容 | Keywords 列表 |
| conclusion-title | 结论标题 | "结论"、"总结" |
| conclusion-content | 结论内容 | 结论正文 |
| references-title | 参考文献标题 | "参考文献"、"References" |
| references-content | 参考文献内容 | 参考文献列表 |
| toc-title | 目录标题 | "目录" |
| toc-chapter | 目录中的章标题项 | 目录中对应标题1的项 |
| toc-other | 目录中的其他项 | 目录中标题2及以下的项 |
| acknowledgement-title | 致谢标题 | "致谢"、"Acknowledgement" |
| appendix-title | 附录标题 | "附录"、"Appendix" |

## 推断规则

1. **优先根据样式名称推断**：
   - 包含 "标题"、"Heading"、"Title" 等关键词
   - 标题编号（如 "标题 1" 对应 chapter-title，"标题 2" 对应 section-1-title，以此类推）
   - "正文"、"Normal"、"Body" 等 → body

2. **样式名称不明确时，根据格式属性推断**：
   - 大字号（如 "28" 以上，即14pt以上）+ 加粗 + 居中 → 可能是 chapter-title 或 paper-title
   - 大字号 + 加粗 → 可能是某级标题
   - 普通字号 + 不加粗 → body

3. **如果无法确定**，标记为 "body"

## 输出格式

你必须严格输出以下 JSON 格式（不要输出其他内容）：

\`\`\`json
{
  "mappings": [
    { "styleId": "1", "paragraphType": "chapter-title" },
    { "styleId": "2", "paragraphType": "body" }
  ]
}
\`\`\`
`

// ========== Helpers ==========

/**
 * 从可能包含 markdown 代码块的文本中提取 JSON 字符串
 */
function extractRefMappingJSON(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return trimmed
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1)
  }
  return null
}

/** 格式化样式属性提示信息，帮助 LLM 推断 */
function formatRefStyleHints(style: any): string {
  const hints: string[] = []
  const props = style.paragraphStyle || {}
  const run = style.runStyle || {}

  if (run.fontSize) hints.push(`字号=${run.fontSize}`)
  if (run.bold) hints.push('加粗')
  if (run.italic) hints.push('斜体')
  if (props.alignment) hints.push(`对齐=${props.alignment}`)
  if (props.outlineLevel !== undefined) hints.push(`大纲级别=${props.outlineLevel}`)

  return hints.length > 0 ? ', 属性: ' + hints.join(', ') : ''
}

// ========== Main ==========

/**
 * 将参考文档的 StyleProfile 通过 LLM 映射为 SmartFormatSpec。
 *
 * 流程：
 * 1. 从 refProfile.styles 中提取样式名及关键属性
 * 2. 发送给 LLM，让 LLM 推断每个样式对应的 ParagraphType
 * 3. 校验 LLM 返回的 paragraphType，过滤无效值
 * 4. 为每个有效映射构建 styleProfile 条目 + paragraphRule
 *
 * @param refProfile - extractFormatProfile() 返回的 StyleProfile 对象
 * @param apiConfig - API 配置（provider, apiKey, modelName, apiURL）
 * @returns SmartFormatSpec，包含 styleProfile 和 paragraphRules
 * @throws 当 LLM 调用失败或返回无效数据时
 */
export async function mapRefProfileToRules(
  refProfile: any,
  apiConfig: apiSettings
): Promise<SmartFormatSpec> {
  const styles: Record<string, any> | undefined = refProfile?.styles

  // 无样式可映射时直接返回空结果
  if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
    return { styleProfile: { styles: {} }, paragraphRules: [] }
  }

  // 构建样式列表信息，用于 LLM 推断
  const styleEntries = Object.entries(styles).map(([id, style]: [string, any]) => {
    const name = style.name || id
    const type = style.type || 'paragraph'
    const hints = formatRefStyleHints(style)
    return `- styleId: "${id}", name: "${name}", type: "${type}"${hints}`
  })

  const userPrompt = `请分析以下参考文档的样式列表，为每个样式指定合适的 paragraphType：

参考文档样式列表：
${styleEntries.join('\n')}

请输出 mappings JSON。`

  // 调用 LLM
  let llmText: string
  try {
    const response = await getModelResponse(
      apiConfig.provider,
      REF_MAPPING_SYSTEM_PROMPT,
      userPrompt,
      apiConfig.apiKey,
      apiConfig.modelName,
      apiConfig.apiURL
    )
    llmText = response.result
  } catch (err: any) {
    throw new Error(`LLM 调用失败: ${err.message || err}`)
  }

  // 提取并解析 JSON
  const jsonStr = extractRefMappingJSON(llmText)
  if (!jsonStr) {
    throw new Error('大模型未返回有效的 mapping JSON')
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('大模型返回的 mapping JSON 解析失败')
  }

  if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
    throw new Error('大模型返回的 JSON 缺少 mappings 数组')
  }

  // 构建 SmartFormatSpec
  const styleProfileStyles: Record<string, any> = {}
  const paragraphRules: ParagraphFormatRule[] = []

  for (const mapping of parsed.mappings) {
    const { styleId, paragraphType } = mapping
    if (!styleId || !paragraphType) continue

    // 校验 paragraphType 是否有效，无效则跳过
    if (!VALID_PARAGRAPH_TYPES.has(paragraphType)) continue

    const refStyle = styles[styleId]
    if (!refStyle) continue

    // 构建 style 条目：用 paragraphType 作为 styleId，复制参考样式属性
    styleProfileStyles[paragraphType] = {
      name: refStyle.name || paragraphType,
      type: refStyle.type || 'paragraph',
      basedOn: refStyle.basedOn || undefined,
      paragraphStyle: refStyle.paragraphStyle || {},
      runStyle: refStyle.runStyle || {},
    }

    // 构建 paragraphRule
    paragraphRules.push({
      match: { paragraphType: paragraphType as ParagraphType },
      format: { styleName: paragraphType },
    })
  }

  return {
    styleProfile: {
      defaults: refProfile.defaults || undefined,
      styles: styleProfileStyles,
    },
    paragraphRules,
  }
}

// ═══════════════════════════════════════════════════════════════════
//  extractParagraphMetadata (paragraph classification)
// ═══════════════════════════════════════════════════════════════════

// ========== Main Function ==========

/**
 * 提取文档中所有段落的元数据，用于后续LLM分类。
 * 包括文本特征、样式特征、位置特征和节类型预分类。
 */
export function extractParagraphMetadata(paragraphs: any[], styleProfile?: any): ParagraphMetadata[] {
  const sectionRanges = buildSectionRanges(paragraphs)
  const relevantTypes = ['abstract', 'keywords', 'toc', 'conclusion', 'references', 'acknowledgement', 'appendix']

  return paragraphs.map((paragraph, index) => {
    // --- text ---
    const text = (() => {
      try { return paragraph.getText() || '' } catch { return '' }
    })()

    // --- firstChars (truncated to 80 for LLM) ---
    const firstChars = text.substring(0, 80)

    // --- headingLevel ---
    const headingLevel = (() => {
      try { return paragraph.getHeadingLevel() } catch { return null }
    })()

    // --- styleId ---
    const styleId = (() => {
      try {
        const style = paragraph.getStyle()
        return style ? (style.styleId || '') : ''
      } catch { return '' }
    })()

    // --- isBold (first run) ---
    const isBold = (() => {
      try {
        const runs = paragraph.getRuns()
        if (runs && runs.length > 0) {
          const runStyle = runs[0].getStyle ? runs[0].getStyle() : {}
          return !!(runStyle && runStyle.bold)
        }
      } catch { /* ignore */ }
      return false
    })()

    // --- sectionType (heuristic pre-classification) ---
    let sectionType: string | null = null

    // 1) Try specific type matching via paragraphMatchesSectionType
    for (const st of relevantTypes) {
      if (paragraphMatchesSectionType(paragraph, st, styleProfile, sectionRanges, index)) {
        sectionType = st
        break
      }
    }

    // 2) Fall back to range-based detection
    if (sectionType === null) {
      for (const range of sectionRanges) {
        if (index >= range.start && index < range.end) {
          if (range.sectionType !== 'body') {
            sectionType = range.sectionType
          }
          break
        }
      }
    }

    return {
      index,
      firstChars,
      headingLevel,
      styleId,
      text,
      isBold,
      sectionType,
    }
  })
}

// ========== Character Detection Helpers ==========

const CHINESE_RE = /[\u4e00-\u9fff]/

function hasChinese(text: string): boolean {
  return CHINESE_RE.test(text)
}

function isPrimarilyLatin(text: string): boolean {
  if (hasChinese(text)) return false
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length === 0) return false
  const latinCount = (cleaned.match(/[A-Za-z]/g) || []).length
  return latinCount / cleaned.length > 0.5
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, '')
}

const SECTION_HEADING_RE =
  /^摘要|^abstract|^引言|^introduction|^结论|^conclusion|^参考文献|^references|^致谢|^acknowledgement|^附录|^appendix|^第[一二三四五六七八九十\d]+章|^第[一二三四五六七八九十\d]+[章节篇]/

function matchesSectionHeading(text: string): boolean {
  return SECTION_HEADING_RE.test(normalizeText(text))
}

// ========== Classification ==========

/**
 * 使用纯启发式规则将每个段落分类为 ParagraphType。
 * 不调用任何 LLM。按优先级匹配（第一个匹配的规则胜出）。
 *
 * @param metadata - 段落元数据数组
 * @returns 段落索引到 ParagraphType 的映射
 */
export function classifyParagraphsHeuristic(
  metadata: ParagraphMetadata[]
): Map<number, ParagraphType> {
  const result = new Map<number, ParagraphType>()

  // Track position context within the current section
  let keywordsCnTitleSeen = -1
  let keywordsEnTitleSeen = -1
  let currentSection = ''

  for (const para of metadata) {
    const text = para.text.trim()
    const n = normalizeText(text)
    const sectionType = para.sectionType || ''

    // Reset position context on section change
    if (sectionType !== currentSection) {
      currentSection = sectionType
      keywordsCnTitleSeen = -1
      keywordsEnTitleSeen = -1
    }

    const isKnownSection =
      sectionType === 'abstract' ||
      sectionType === 'keywords' ||
      sectionType === 'conclusion' ||
      sectionType === 'references' ||
      sectionType === 'toc' ||
      sectionType === 'acknowledgement' ||
      sectionType === 'appendix'

    let type: ParagraphType | null = null

    // --- Rule 1: paper-title ---
    // paragraph index 0, headingLevel null or 0,
    // short text (<50 chars), not matching section heading patterns
    if (
      para.index === 0 &&
      (para.headingLevel == null || para.headingLevel === 0) &&
      text.length < 50 &&
      text.length > 0 &&
      !matchesSectionHeading(text)
    ) {
      type = 'paper-title'
    }

    // --- Rule 2: abstract-cn-title ---
    // Exact match "摘要" or "摘 要"
    if (!type && /^摘\s*要$/.test(text)) {
      type = 'abstract-cn-title'
    }

    // --- Rule 3: abstract-cn-content ---
    // sectionType === 'abstract' AND has Chinese AND NOT abstract-cn-title
    if (!type && sectionType === 'abstract' && hasChinese(text)) {
      type = 'abstract-cn-content'
    }

    // --- Rule 4: abstract-en-title ---
    // Exact match "abstract" (case-insensitive)
    if (!type && /^abstract$/i.test(text)) {
      type = 'abstract-en-title'
    }

    // --- Rule 5: abstract-en-content ---
    // sectionType === 'abstract' AND primarily Latin AND NOT abstract-en-title
    if (!type && sectionType === 'abstract' && isPrimarilyLatin(text)) {
      type = 'abstract-en-content'
    }

    // --- Rule 6: keywords-cn-title ---
    // Text starts with "关键词"
    if (!type && /^关键词/.test(n)) {
      type = 'keywords-cn-title'
    }

    // --- Rule 7: keywords-cn-body ---
    // After keywords-cn-title in the same section, contains Chinese
    if (
      !type &&
      keywordsCnTitleSeen >= 0 &&
      sectionType === 'keywords' &&
      hasChinese(text)
    ) {
      type = 'keywords-cn-body'
    }

    // --- Rule 8: keywords-en-title ---
    // Text matches "key words" or "keywords" (case-insensitive)
    if (!type && /^key\s*words/i.test(n)) {
      type = 'keywords-en-title'
    }

    // --- Rule 9: keywords-en-body ---
    // After keywords-en-title in the same section, primarily Latin
    if (
      !type &&
      keywordsEnTitleSeen >= 0 &&
      sectionType === 'keywords' &&
      isPrimarilyLatin(text)
    ) {
      type = 'keywords-en-body'
    }

    // --- Rule 10: conclusion-title ---
    // Exact match "结论" or "conclusion", OR sectionType 'conclusion' with headingLevel >= 1
    if (
      !type &&
      (/^结\s*论$|^conclusion$/i.test(text) ||
        (sectionType === 'conclusion' && para.headingLevel != null && para.headingLevel >= 1))
    ) {
      type = 'conclusion-title'
    }

    // --- Rule 11: conclusion-content ---
    // sectionType === 'conclusion' AND NOT conclusion-title
    if (!type && sectionType === 'conclusion') {
      type = 'conclusion-content'
    }

    // --- Rule 12: references-title ---
    // Exact match OR sectionType 'references' with headingLevel >= 1
    if (
      !type &&
      (/^参考文献$|^references$/i.test(text) ||
        (sectionType === 'references' && para.headingLevel != null && para.headingLevel >= 1))
    ) {
      type = 'references-title'
    }

    // --- Rule 13: references-content ---
    // sectionType === 'references' AND NOT references-title
    if (!type && sectionType === 'references') {
      type = 'references-content'
    }

    // --- Rule 14: toc-title ---
    // Exact match "目录" or "目 录"
    if (!type && /^目\s*录$/.test(text)) {
      type = 'toc-title'
    }

    // --- Rule 15: toc-chapter ---
    // sectionType === 'toc' AND (headingLevel >= 1 OR text references chapters)
    if (
      !type &&
      sectionType === 'toc' &&
      ((para.headingLevel != null && para.headingLevel >= 1) || /第[一二三四五六七八九十\d]+章/.test(n))
    ) {
      type = 'toc-chapter'
    }

    // --- Rule 16: toc-other ---
    // sectionType === 'toc' AND NOT toc-chapter AND NOT toc-title
    if (!type && sectionType === 'toc') {
      type = 'toc-other'
    }

    // --- Rule 17: acknowledgement-title ---
    // Exact match "致谢" or "acknowledgement"
    if (!type && /^致\s*谢$|^acknowledgement$/i.test(text)) {
      type = 'acknowledgement-title'
    }

    // --- Rule 18: appendix-title ---
    // Text starts with "附录" or "appendix"
    if (!type && /^附\s*录|^appendix/i.test(n)) {
      type = 'appendix-title'
    }

    // --- Rule 19: chapter-title ---
    // headingLevel === 1 OR text matches "第X章"
    // Only when NOT in a known section (conclusion/references/toc handled above)
    if (!type && (para.headingLevel === 1 || /^第[一二三四五六七八九十\d]+章/.test(n))) {
      type = 'chapter-title'
    }

    // --- Rule 20: section-1-title ---
    // headingLevel === 2 (only when NOT in a known section)
    if (!type && para.headingLevel === 2 && !isKnownSection) {
      type = 'section-1-title'
    }

    // --- Rule 21: section-2-title ---
    // headingLevel === 3 (only when NOT in a known section)
    if (!type && para.headingLevel === 3 && !isKnownSection) {
      type = 'section-2-title'
    }

    // --- Rule 22: section-3-title ---
    // headingLevel === 4 (only when NOT in a known section)
    if (!type && para.headingLevel === 4 && !isKnownSection) {
      type = 'section-3-title'
    }

    // --- Rule 23: item-title ---
    // Text matches enumeration pattern AND isBold
    if (
      !type &&
      /^（[一二三四五六七八九十\d]+）|^\([一二三四五六七八九十\d]+\)|^[一二三四五六七八九十\d]+[、．.]/.test(n) &&
      para.isBold
    ) {
      type = 'item-title'
    }

    // --- Rule 24: body (default fallback - MUST be last) ---
    if (!type) {
      type = 'body'
    }

    result.set(para.index, type)

    // Update position tracking for next paragraphs
    if (type === 'keywords-cn-title') {
      keywordsCnTitleSeen = para.index
    }
    if (type === 'keywords-en-title') {
      keywordsEnTitleSeen = para.index
    }
  }

  return result
}

// ═══════════════════════════════════════════════════════════════════
//  classifyParagraphsWithLLM (LLM-enhanced paragraph classification)
// ═══════════════════════════════════════════════════════════════════

// ========== Types ==========

export interface LLMClassificationResult {
  classifications: Map<number, ParagraphType>
  fallbackMode: boolean
  tokenUsage: number
}

interface LLMBatchItem {
  index: number
  firstChars: string
  headingLevel: number | null
  styleId: string
  isBold: boolean
  sectionType: string | null
  context: {
    prevTypes: (string | null)[]
    nextFirstChars: string[]
  }
}

interface LLMClassificationResponse {
  classifications: Array<{
    index: number
    type: string
    confidence: number
  }>
}

// ========== System Prompt ==========

const CLASSIFY_SYSTEM_PROMPT = `你是一个专业的 Word 文档段落分类专家。你会收到一批段落的元数据信息，需要根据每个段落的特征和上下文，将其分类为合适的段落类型（ParagraphType）。

## 可用段落类型说明

| paragraphType | 含义 | 典型特征 |
|---|---|---|
| paper-title | 论文主标题 | 文档开头、短文本、非标题样式 |
| chapter-title | 章标题 | headingLevel=1 或文本以"第X章"开头 |
| section-1-title | 一级节标题 | headingLevel=2 |
| section-2-title | 二级节标题 | headingLevel=3 |
| section-3-title | 三级节标题 | headingLevel=4 |
| item-title | 条目标题 | 枚举格式如"（一）"且加粗 |
| body | 正文 | 普通段落，非标题、非特殊类型 |
| abstract-cn-title | 中文摘要标题 | 文本为"摘要" |
| abstract-cn-content | 中文摘要内容 | sectionType=abstract 且含中文 |
| abstract-en-title | 英文摘要标题 | 文本为"Abstract" |
| abstract-en-content | 英文摘要内容 | sectionType=abstract 且主要拉丁字母 |
| keywords-cn-title | 中文关键词标题 | 以"关键词"开头 |
| keywords-cn-body | 中文关键词内容 | 在"关键词"标题之后，含中文 |
| keywords-en-title | 英文关键词标题 | 以"Keywords"或"Key words"开头 |
| keywords-en-body | 英文关键词内容 | 在英文关键词标题之后，主要拉丁字母 |
| conclusion-title | 结论标题 | 文本为"结论"或"Conclusion"，或 sectionType=conclusion 且为标题 |
| conclusion-content | 结论内容 | sectionType=conclusion 且非标题 |
| references-title | 参考文献标题 | 文本为"参考文献"或"References" |
| references-content | 参考文献条目 | sectionType=references 且非标题 |
| toc-title | 目录标题 | 文本为"目录" |
| toc-chapter | 目录章标题项 | sectionType=toc 且 headingLevel>=1 |
| toc-other | 目录其他项 | sectionType=toc 且非标题、非章级 |
| acknowledgement-title | 致谢标题 | 文本为"致谢"或"Acknowledgement" |
| appendix-title | 附录标题 | 以"附录"或"Appendix"开头 |

## 输入格式

你将收到一个 JSON 数组，每个元素包含一个段落的元数据：
{
  "index": 段落位置 (0-based),
  "firstChars": 段落前80个字符,
  "headingLevel": Word 标题级别 (1-9, null=非标题),
  "styleId": Word 样式 ID,
  "isBold": 是否加粗,
  "sectionType": 启发式预分类 (abstract|keywords|toc|conclusion|references|acknowledgement|appendix|null),
  "context": {
    "prevTypes": [前两个段落的启发式分类类型, 可能为 null],
    "nextFirstChars": [后两个段落的前80字符, 可能为空字符串]
  }
}

## 任务

对每个段落进行分类，输出以下 JSON 格式：

{
  "classifications": [
    { "index": 0, "type": "paper-title", "confidence": 0.95 },
    { "index": 1, "type": "body", "confidence": 0.85 }
  ]
}

## 规则

1. confidence 取值范围 0.0~1.0，表示你对分类的置信度
2. 如果段落特征非常明确（如 headingLevel=1），confidence 应接近 1.0
3. 如果特征模糊（普通正文），confidence 可以较低（如 0.5~0.7）
4. 如果完全无法判断，标记为 "body" 并给 confidence 0.3~0.5
5. 只输出 JSON，不要输出解释文字
6. 必须对输入中的每个段落都给出分类`

// ========== Constants ==========

const BATCH_SIZE = 25
const CONFIDENCE_THRESHOLD = 0.7

// ========== Helpers ==========

/**
 * 从 LLM 回复中提取分类 JSON 字符串
 */
function extractClassifyJSON(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return trimmed
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1)
  }
  return null
}

/**
 * 为批量段落添加上下文信息
 */
function buildBatchItems(
  metadata: ParagraphMetadata[],
  heuristicResult: Map<number, ParagraphType>,
  batchIndices: number[]
): LLMBatchItem[] {
  return batchIndices.map((idx) => {
    const para = metadata[idx]

    const prevTypes: (string | null)[] = []
    for (let offset = 2; offset >= 1; offset--) {
      const prevIdx = idx - offset
      if (prevIdx >= 0) {
        prevTypes.push(heuristicResult.get(prevIdx) || null)
      } else {
        prevTypes.push(null)
      }
    }

    const nextFirstChars: string[] = []
    for (let offset = 1; offset <= 2; offset++) {
      const nextIdx = idx + offset
      if (nextIdx < metadata.length) {
        nextFirstChars.push(metadata[nextIdx].firstChars)
      } else {
        nextFirstChars.push('')
      }
    }

    return {
      index: para.index,
      firstChars: para.firstChars,
      headingLevel: para.headingLevel,
      styleId: para.styleId,
      isBold: para.isBold,
      sectionType: para.sectionType,
      context: {
        prevTypes,
        nextFirstChars,
      },
    }
  })
}

/**
 * 处理单个 batch 的 LLM 调用和结果解析
 */
async function processBatch(
  batchItems: LLMBatchItem[],
  apiConfig: apiSettings
): Promise<{ classifications: Map<number, { type: ParagraphType; confidence: number }>; tokens: number }> {
  const userMessage = JSON.stringify(batchItems)

  const { result, total_tokens } = await getModelResponse(
    apiConfig.provider,
    CLASSIFY_SYSTEM_PROMPT,
    userMessage,
    apiConfig.apiKey,
    apiConfig.modelName,
    apiConfig.apiURL
  )

  // 提取 JSON
  const jsonStr = extractClassifyJSON(result)
  if (!jsonStr) {
    throw new Error('LLM 未返回有效的分类 JSON')
  }

  let parsed: LLMClassificationResponse
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('LLM 返回的分类 JSON 解析失败')
  }

  if (!parsed.classifications || !Array.isArray(parsed.classifications)) {
    throw new Error('LLM 返回的 JSON 缺少 classifications 数组')
  }

  // 校验并构建结果
  const classifications = new Map<number, { type: ParagraphType; confidence: number }>()
  for (const item of parsed.classifications) {
    const { index, type, confidence } = item

    // 跳过无效类型
    if (!type || !VALID_PARAGRAPH_TYPES.has(type)) continue

    // 跳过无效索引
    if (typeof index !== 'number' || index < 0) continue

    const conf = typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.5

    classifications.set(index, {
      type: type as ParagraphType,
      confidence: conf,
    })
  }

  return { classifications, tokens: total_tokens }
}

/**
 * 合并 LLM 结果和启发式结果
 */
function mergeResults(
  heuristicResult: Map<number, ParagraphType>,
  llmResults: Map<number, { type: ParagraphType; confidence: number }>,
  metadataCount: number
): Map<number, ParagraphType> {
  const merged = new Map<number, ParagraphType>()

  for (let i = 0; i < metadataCount; i++) {
    const llmEntry = llmResults.get(i)

    if (llmEntry && llmEntry.confidence >= CONFIDENCE_THRESHOLD) {
      // LLM 高置信度 → 使用 LLM 分类
      merged.set(i, llmEntry.type)
    } else if (heuristicResult.has(i)) {
      // 启发式有分类 → 使用启发式
      merged.set(i, heuristicResult.get(i)!)
    } else {
      // 兜底 → body
      merged.set(i, 'body')
    }
  }

  return merged
}

// ========== Main Function ==========

/**
 * 使用 LLM 增强段落分类精度。
 *
 * 将段落元数据分批（每批25个）发送给 LLM，LLM 为每个段落
 * 返回分类类型和置信度。高置信度（>=0.7）使用 LLM 结果，
 * 低置信度或无结果时回退到启发式分类。
 *
 * @param metadata - 段落元数据数组
 * @param heuristicResult - 启发式分类结果
 * @param apiConfig - API 配置
 * @returns LLMClassificationResult，包含合并后的分类、回退标志和 token 用量
 */
export async function classifyParagraphsWithLLM(
  metadata: ParagraphMetadata[],
  heuristicResult: Map<number, ParagraphType>,
  apiConfig: apiSettings
): Promise<LLMClassificationResult> {
  // 空元数据 → 空结果
  if (!metadata || metadata.length === 0) {
    return {
      classifications: new Map(),
      fallbackMode: false,
      tokenUsage: 0,
    }
  }

  // 分批次
  const batches: number[][] = []
  for (let i = 0; i < metadata.length; i += BATCH_SIZE) {
    const batchIndices: number[] = []
    for (let j = i; j < Math.min(i + BATCH_SIZE, metadata.length); j++) {
      batchIndices.push(j)
    }
    batches.push(batchIndices)
  }

  let totalTokens = 0

  // 并行处理所有 batch
  const batchResults = await Promise.allSettled(
    batches.map((batchIndices) =>
      processBatch(
        buildBatchItems(metadata, heuristicResult, batchIndices),
        apiConfig
      )
    )
  )

  // 检查是否有失败的 batch
  const hasFailure = batchResults.some((r) => r.status === 'rejected')

  if (hasFailure) {
    // 任意 batch 失败 → 完全回退到启发式
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        totalTokens += r.value.tokens
      } else {
        console.warn('LLM 段落分类失败，回退到启发式:', r.reason)
      }
    }

    return {
      classifications: heuristicResult,
      fallbackMode: true,
      tokenUsage: totalTokens,
    }
  }

  // 所有 batch 成功 → 收集 LLM 结果
  const llmResults = new Map<number, { type: ParagraphType; confidence: number }>()
  for (const r of batchResults) {
    if (r.status === 'fulfilled') {
      totalTokens += r.value.tokens
      for (const [idx, entry] of r.value.classifications) {
        llmResults.set(idx, entry)
      }
    }
  }

  // 合并结果
  const merged = mergeResults(heuristicResult, llmResults, metadata.length)

  return {
    classifications: merged,
    fallbackMode: false,
    tokenUsage: totalTokens,
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SmartFormatAgent — 全流程编排
// ═══════════════════════════════════════════════════════════════════

export interface AnalyzeResult {
  spec: SmartFormatSpec
  classification: Map<number, ParagraphType>
  tokenUsage: number
  fallbackMode: boolean
}

export interface ApplyResult extends SmartFormatResult {
  contentPreserved: boolean
}

/**
 * SmartFormatAgent 编排 Analyze → Apply 完整流水线。
 *
 * Phase 1 (analyze): 自然语言描述 / 参考文档 → SmartFormatSpec + 段落分类
 * Phase 2 (apply):   将 spec + 分类确定性应用到目标文档
 *
 * Content immutability: apply 阶段不修改段落文本内容，仅修改格式。
 */
export class SmartFormatAgent {
  /**
   * Phase 1: Analyze — produce SmartFormatSpec + paragraph classification
   */
  async analyze(input: {
    description?: string
    refFilePath?: string
    targetFilePath: string
    apiConfig: apiSettings
  }): Promise<AnalyzeResult> {
    let specFromDesc: SmartFormatSpec | null = null
    let specFromRef: SmartFormatSpec | null = null
    let tokenUsage = 0

    // ── 1. Parse description ──
    if (input.description && input.description.trim()) {
      const descResult: ParseFormatDescResult = await parseFormatDescription(
        input.description,
        input.apiConfig
      )
      specFromDesc = descResult.spec
      tokenUsage += descResult.tokenUsage
    }

    // ── 2. Map ref doc profile ──
    if (input.refFilePath) {
      const refProfile = await extractFormatProfile(input.refFilePath)
      specFromRef = await mapRefProfileToRules(refProfile, input.apiConfig)
      // mapRefProfileToRules 内部也调用 LLM，但返回的 SmartFormatSpec 不含 token 信息
      // 这里保守估算 token 用量
      tokenUsage += 50
    }

    // ── 3. Merge specs (ref as base, desc wins on conflicts) ──
    const mergedSpec = this.mergeSpecs(specFromRef, specFromDesc)

    // ── 4. Load target document, extract paragraphs ──
    const doc = await loadDocx(input.targetFilePath)
    const body = doc.getBody()
    if (!body) {
      throw new Error('目标文档没有正文部分')
    }
    const paragraphs = body.getParagraphs()

    // ── 5. Extract paragraph metadata ──
    const metadata = extractParagraphMetadata(paragraphs)

    // ── 6. Heuristic classification ──
    const heuristicResult = classifyParagraphsHeuristic(metadata)

    // ── 7. LLM classification (enhance heuristic) ──
    const llmResult: LLMClassificationResult = await classifyParagraphsWithLLM(
      metadata,
      heuristicResult,
      input.apiConfig
    )
    tokenUsage += llmResult.tokenUsage

    return {
      spec: mergedSpec,
      classification: llmResult.classifications,
      tokenUsage,
      fallbackMode: llmResult.fallbackMode,
    }
  }

  /**
   * Phase 2: Apply — deterministic formatting
   */
  async apply(
    inputPath: string,
    outputPath: string,
    spec: SmartFormatSpec,
    classification: Map<number, ParagraphType>
  ): Promise<ApplyResult> {
    // ── 1. Load target document, capture original texts ──
    const doc = await loadDocx(inputPath)
    const body = doc.getBody()
    if (!body) {
      throw new Error('文档没有正文部分')
    }
    const paragraphs = body.getParagraphs()
    const originalTexts: string[] = paragraphs.map((p: any) => {
      try { return p.getText() || '' } catch { return '' }
    })

    // ── 2. Convert classification Map<number, ParagraphType> → Map<number, string> ──
    const paragraphTypeMap = new Map<number, string>()
    for (const [idx, pType] of classification) {
      paragraphTypeMap.set(idx, pType)
    }

    // ── 3. Apply formatting ──
    const result: SmartFormatResult = await applySmartFormat(
      inputPath,
      outputPath,
      spec,
      paragraphTypeMap
    )

    // ── 4. Content immutability check ──
    let contentPreserved = false
    if (result.success) {
      try {
        const newDoc = await loadDocx(outputPath)
        const newBody = newDoc.getBody()
        const newParagraphs = newBody ? newBody.getParagraphs() : []
        const newTexts: string[] = newParagraphs.map((p: any) => {
          try { return p.getText() || '' } catch { return '' }
        })

        contentPreserved =
          originalTexts.length === newTexts.length &&
          originalTexts.every((t, i) => t === newTexts[i])
      } catch {
        contentPreserved = false
      }
    }

    return {
      ...result,
      contentPreserved,
    }
  }

  /**
   * Merge two SmartFormatSpec objects.
   * Uses ref spec as base; desc spec overrides conflicting entries.
   */
  private mergeSpecs(
    refSpec: SmartFormatSpec | null,
    descSpec: SmartFormatSpec | null
  ): SmartFormatSpec {
    if (!refSpec && !descSpec) {
      return { styleProfile: { styles: {} }, paragraphRules: [] }
    }
    if (!refSpec) return descSpec!
    if (!descSpec) return refSpec

    // Merge paragraphRules: desc wins for same paragraphType in match
    const ruleMap = new Map<string, any>()
    const refRules = refSpec.paragraphRules || []
    const descRules = descSpec.paragraphRules || []

    for (const rule of refRules) {
      const pType = rule.match?.paragraphType || 'unknown'
      if (!ruleMap.has(pType)) {
        ruleMap.set(pType, rule)
      }
    }
    for (const rule of descRules) {
      const pType = rule.match?.paragraphType || 'unknown'
      ruleMap.set(pType, rule) // overwrite ref rule
    }
    const mergedRules = Array.from(ruleMap.values())

    // Merge styleProfile: desc styles win for same key
    const refStyles = refSpec.styleProfile?.styles || {}
    const descStyles = descSpec.styleProfile?.styles || {}
    const mergedStyles: Record<string, any> = { ...refStyles }
    for (const [key, style] of Object.entries(descStyles)) {
      mergedStyles[key] = style // overwrite ref style
    }

    const refDefaults = refSpec.styleProfile?.defaults || {}
    const descDefaults = descSpec.styleProfile?.defaults || {}
    const mergedDefaults: any = { ...refDefaults }
    if (descDefaults.paragraphStyle || descDefaults.runStyle) {
      mergedDefaults.paragraphStyle = {
        ...(refDefaults.paragraphStyle || {}),
        ...(descDefaults.paragraphStyle || {}),
      }
      mergedDefaults.runStyle = {
        ...(refDefaults.runStyle || {}),
        ...(descDefaults.runStyle || {}),
      }
    }

    // Merge pageSettings: desc wins
    const mergedPageSettings =
      descSpec.pageSettings || refSpec.pageSettings

    return {
      styleProfile: {
        ...(Object.keys(mergedDefaults).length > 0 ? { defaults: mergedDefaults } : {}),
        styles: mergedStyles,
      },
      paragraphRules: mergedRules,
      ...(mergedPageSettings ? { pageSettings: mergedPageSettings } : {}),
    }
  }
}
