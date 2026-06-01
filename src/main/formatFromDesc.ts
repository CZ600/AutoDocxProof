import { getModelResponse } from './chat'
import { ModelProvider } from '../shared/modelProviders'
import { STYLE_NAME_ALIASES } from '../shared/styleAliases'

/**
 * 将自然语言格式描述通过大模型转换为 StyleProfile 结构。
 * 输出的 profile 与 formatClone.ts 中 cloneFormatWithProfile 所需的结构一致。
 */

export interface FormatDescResult {
  profile: any
  tokenUsage: number
}

/** 目标文档样式条目 {name, type} */
export interface TargetStyleEntry {
  name: string
  type: string
}

/**
 * 将 LLM 生成的样式名模糊匹配到目标文档的真实样式名。
 * 匹配优先级：精确 > 忽略大小写 > 去空格 > 别名表 > 包含关系
 */
function resolveStyleName(llmName: string, targetType: string, targetEntries: TargetStyleEntry[]): string | null {
  const sameTypeEntries = targetEntries.filter(e => e.type === targetType)
  if (sameTypeEntries.length === 0) return null

  // 1. 精确匹配
  const exact = sameTypeEntries.find(e => e.name === llmName)
  if (exact) return exact.name

  // 2. 忽略大小写
  const lowerLlm = llmName.toLowerCase()
  const caseInsensitive = sameTypeEntries.find(e => e.name.toLowerCase() === lowerLlm)
  if (caseInsensitive) return caseInsensitive.name

  // 3. 去空格后匹配
  const noSpaceLlm = llmName.replace(/\s+/g, '')
  const noSpace = sameTypeEntries.find(e => e.name.replace(/\s+/g, '') === noSpaceLlm)
  if (noSpace) return noSpace.name

  // 4. 别名表匹配
  for (const [, aliases] of Object.entries(STYLE_NAME_ALIASES)) {
    const llmInAlias = aliases.some(a => a.toLowerCase() === lowerLlm || a.replace(/\s+/g, '') === noSpaceLlm)
    if (llmInAlias) {
      for (const alias of aliases) {
        const matched = sameTypeEntries.find(e =>
          e.name === alias || e.name.toLowerCase() === alias.toLowerCase()
        )
        if (matched) return matched.name
      }
    }
  }

  // 5. 包含关系（目标名包含 LLM 名，或 LLM 名包含目标名）
  const contains = sameTypeEntries.find(e =>
    e.name.toLowerCase().includes(lowerLlm) || lowerLlm.includes(e.name.toLowerCase())
  )
  if (contains) return contains.name

  return null
}

// ---------- Prompt ----------

const SYSTEM_PROMPT = `你是一个专业的 Word 文档格式参数提取专家。用户会给你一段关于文档格式的自然语言描述，你需要将其转换成结构化的 JSON 格式参数。

你需要输出的 JSON 结构如下：
{
  "defaults": {
    "paragraphStyle": { ... },
    "runStyle": { ... }
  },
  "styles": {
    "<styleId>": {
      "name": "<样式名称>",
      "type": "paragraph | character | table",
      "basedOn": "<基于的样式名>",
      "paragraphStyle": { ... },
      "runStyle": { ... }
    }
  }
}

段落样式(paragraphStyle)常用字段：
- alignment: 对齐方式，可选值 "left","center","right","both","distribute"
- spacing: 段落间距，对象 { before: "数值(twips)", after: "数值(twips)", line: "数值(twips)", lineRule: "auto | exact | atLeast" }
- outlineLevel: 大纲级别，字符串 "0"~"9"，"0"对应标题1，以此类推
- indent: 缩进，对象 { left: "数值(twips)", right: "数值(twips)", firstLine: "数值(twips)" }
- keepNext: 是否与下段同页，布尔值
- keepLines: 是否段中不分页，布尔值
- pageBreakBefore: 是否段前分页，布尔值
- widowControl: 是否寡孤行控制，布尔值

文本样式(runStyle)常用字段：
- fontSize: 字号，字符串，单位半磅(half-points)。如 "28" = 14pt = 四号，"24" = 12pt = 小四，"21" = 10.5pt = 五号，"18" = 9pt = 小五
- fontFamily: 字体，对象格式 { ascii: "字体名", eastAsia: "字体名", hAnsi: "字体名" }。如果用户只指定了一个字体（如"黑体"），则所有字段都设为相同值：{ ascii: "黑体", eastAsia: "黑体", hAnsi: "黑体" }。如果用户区分中英文字体（如"中文宋体，英文Times New Roman"），则 { ascii: "Times New Roman", eastAsia: "宋体", hAnsi: "Times New Roman" }
- color: 字体颜色，十六进制字符串如 "000000"
- bold: 是否加粗，布尔值
- italic: 是否斜体，布尔值
- underline: 下划线类型，字符串
- highlight: 高亮颜色，十六进制字符串

常见字号对应关系（中文）：
- 初号 = 84, 小初 = 72
- 一号 = 52, 小一 = 48
- 二号 = 44, 小二 = 36
- 三号 = 32, 小三 = 30
- 四号 = 28, 小四 = 24
- 五号 = 21, 小五 = 18

中英文样式名对照（常见别名）：
- 标题1 / Heading 1 / heading 1 / 标题 1 → 都指一级标题
- 标题2 / Heading 2 → 二级标题，以此类推到标题9
- 正文 / Normal → 正文段落
- 页眉 / Header → 页眉
- 页脚 / Footer → 页脚
- 副标题 / Subtitle → 副标题
- 脚注文本 / Footnote Text → 脚注
- 目录1 / TOC 1 → 目录一级
- 引用 / Quote → 引用块

重要规则：
1. 间距和缩进单位是 twips（1磅 = 20 twips，1厘米 ≈ 567 twips）。如果用户使用的是"磅"或"厘米"，请自行换算。
2. 行距 line 的值：如果 lineRule 是 "auto"，line 值为 240 的倍数（240 = 单倍行距，360 = 1.5倍，480 = 双倍）；如果 lineRule 是 "exact" 或 "atLeast"，line 值为 twips。
3. **name 字段必须与目标文档中的样式名称完全一致**（系统会提供目标文档的所有可用样式名列表）。如果你不确定用哪个，请从列表中选择最接近的。styleId 可以用任意唯一字符串（如 "s1","s2"）。
4. 只输出用户描述中提到的样式，不要自行编造。
5. 只输出 JSON，不要输出任何解释性文字。
6. 如果用户描述不够明确，请做合理推断。`

/**
 * 将格式描述文本交给大模型，返回 StyleProfile
 * @param targetStyleEntries 目标文档中已有的样式 {name, type} 列表
 */
export async function formatDescriptionToProfile(
  description: string,
  apiKey: string,
  modelName: string,
  apiURL: string,
  provider: ModelProvider,
  targetStyleEntries?: TargetStyleEntry[]
): Promise<FormatDescResult> {
  // 构造 user prompt，注入目标文档样式名列表
  let userPrompt = `请将以下格式描述转换为结构化的 JSON 格式参数：\n\n${description}`
  if (targetStyleEntries && targetStyleEntries.length > 0) {
    const styleList = targetStyleEntries
      .map(e => `  - name: "${e.name}"  type: "${e.type}"`)
      .join('\n')
    userPrompt += `\n\n【关键】目标文档中可用的样式列表如下，你输出的每个样式的 name 必须从下面精确选取（包括空格也要一致）：\n${styleList}`
  }

  const { result, total_tokens } = await getModelResponse(
    provider,
    SYSTEM_PROMPT,
    userPrompt,
    apiKey,
    modelName,
    apiURL
  )

  // 从 LLM 回复中提取 JSON
  const jsonStr = extractJSON(result)
  if (!jsonStr) {
    throw new Error('大模型未返回有效的格式参数 JSON')
  }

  let profile: any
  try {
    profile = JSON.parse(jsonStr)
  } catch {
    throw new Error('大模型返回的格式参数 JSON 解析失败')
  }

  // 基本校验
  if (!profile || typeof profile !== 'object') {
    throw new Error('大模型返回的格式参数结构不正确')
  }
  if (!profile.styles || typeof profile.styles !== 'object') {
    profile.styles = {}
  }
  if (!profile.defaults) {
    profile.defaults = {}
  }

  // 规范化：修正 LLM 可能输出的字段名/类型偏差
  normalizeStyleProperties(profile)

  // 确保每个 style 有 paragraphStyle 和 runStyle，并对 name 做模糊纠名
  if (targetStyleEntries && targetStyleEntries.length > 0) {
    for (const [, style] of Object.entries(profile.styles)) {
      const s = style as any
      if (!s.paragraphStyle) s.paragraphStyle = {}
      if (!s.runStyle) s.runStyle = {}

      // 模糊纠名：确保 name 与目标文档精确匹配
      if (s.name) {
        const resolved = resolveStyleName(s.name, s.type || 'paragraph', targetStyleEntries)
        if (resolved) {
          s.name = resolved
        }
      }
    }
  }

  return { profile, tokenUsage: total_tokens }
}

/**
 * 规范化 LLM 输出的样式属性，修正常见的字段名/类型偏差：
 * 1. fontFamily 为字符串 → 转换为 docx-edit 所需的对象格式 { ascii, eastAsia, hAnsi }
 * 2. justify → alignment（LLM 可能使用与 docx-edit 不一致的字段名）
 */
function normalizeStyleProperties(profile: any): void {
  const normalizeParagraphStyle = (ps: any) => {
    if (!ps) return
    // LLM 可能输出 justify 而非 alignment
    if (ps.justify !== undefined && ps.alignment === undefined) {
      ps.alignment = ps.justify
      delete ps.justify
    }
  }

  const normalizeRunStyle = (rs: any) => {
    if (!rs) return
    // LLM 可能输出 fontFamily 为字符串而非对象
    if (typeof rs.fontFamily === 'string' && rs.fontFamily.trim()) {
      const fontName = rs.fontFamily.trim()
      rs.fontFamily = {
        ascii: fontName,
        eastAsia: fontName,
        hAnsi: fontName,
        cs: fontName
      }
    }
  }

  // 规范化 defaults
  if (profile.defaults) {
    normalizeParagraphStyle(profile.defaults.paragraphStyle)
    normalizeRunStyle(profile.defaults.runStyle)
  }

  // 规范化各样式条目
  for (const [, style] of Object.entries(profile.styles || {})) {
    const s = style as any
    normalizeParagraphStyle(s.paragraphStyle)
    normalizeRunStyle(s.runStyle)
  }
}

/**
 * 从可能包含 markdown 代码块的文本中提取 JSON 字符串
 */
function extractJSON(text: string): string | null {
  // 尝试直接解析
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
