const { loadDocx } = require('docx-edit')
import { STYLE_NAME_ALIASES, styleNameMatches } from '../shared/styleAliases'

// ========== Types ==========

export interface SmartFormatSpec {
  /** Style-level definitions (applied to named styles in styles.xml via applyStyleProfile) */
  styleProfile?: {
    defaults?: {
      paragraphStyle?: Record<string, any>
      runStyle?: Record<string, any>
    }
    styles?: Record<string, {
      name: string
      type: string  // 'paragraph' | 'character'
      basedOn?: string
      paragraphStyle?: Record<string, any>
      runStyle?: Record<string, any>
    }>
  }

  /** Paragraph-level rules (applied directly to individual paragraphs that match) */
  paragraphRules?: ParagraphFormatRule[]

  /** Page-level settings (headers, footers, page numbering) */
  pageSettings?: {
    header?: {
      text?: string
      runStyle?: Record<string, any>
      paragraphStyle?: Record<string, any>
    }
    footer?: {
      text?: string
      runStyle?: Record<string, any>
      paragraphStyle?: Record<string, any>
    }
    pageNumbering?: {
      position: 'bottom-center' | 'bottom-right' | 'top-center' | 'top-right'
      runStyle?: Record<string, any>
    }
  }
}

export type ParagraphType =
  | 'paper-title'
  | 'chapter-title'
  | 'section-1-title'
  | 'section-2-title'
  | 'section-3-title'
  | 'item-title'
  | 'body'
  | 'abstract-cn-title'
  | 'abstract-cn-content'
  | 'abstract-en-title'
  | 'abstract-en-content'
  | 'keywords-cn-title'
  | 'keywords-cn-body'
  | 'keywords-en-title'
  | 'keywords-en-body'
  | 'conclusion-title'
  | 'conclusion-content'
  | 'references-title'
  | 'references-content'
  | 'toc-title'
  | 'toc-chapter'
  | 'toc-other'
  | 'acknowledgement-title'
  | 'appendix-title'

export interface ParagraphFormatRule {
  /** Matching criteria - at least one must be provided */
  match: {
    /** Match by heading level (1-9) */
    headingLevel?: number
    /** Match by content text pattern (regex or exact, case-insensitive) */
    textPattern?: string
    /** Match by current style name (fuzzy matching) */
    styleName?: string
    /** Match by section type */
    sectionType?: 'abstract' | 'keywords' | 'toc' | 'conclusion' | 'references' | 'acknowledgement' | 'appendix'
    /** Match by paragraph type classification (e.g. abstract-cn-title, body, etc.) */
    paragraphType?: ParagraphType
  }

  /** Format to apply */
  format: {
    /** Create/use a named style and apply it */
    styleName?: string
    /** OR apply inline paragraph formatting directly */
    paragraphStyle?: Record<string, any>
    /** OR apply inline run formatting to all runs */
    runStyle?: Record<string, any>
  }

  /** If true, stop processing more rules for this paragraph */
  exclusive?: boolean
}

export interface SmartFormatResult {
  success: boolean
  /** Number of styles applied via styleProfile */
  appliedStyles: number
  /** Number of paragraphs modified via paragraphRules */
  appliedParagraphs: number
  /** Error message if any */
  error?: string
}

/**
 * 独立的模糊样式名匹配工具函数，可被外部使用。
 * 判断给定的名称是否与目标名称匹配（使用与 styleNameMatches 相同的逻辑）。
 *
 * @param name - 要匹配的名称
 * @param targetName - 目标名称
 * @returns 是否匹配
 */
export function matchStyleName(name: string, targetName: string): boolean {
  return styleNameMatches(name, targetName)
}

/**
 * 获取段落的当前样式名。
 * 从段落的 styleId 在文档样式档案中查找对应的名称。
 */
function getParagraphStyleName(paragraph: any, styleProfile: any): string {
  try {
    const paraStyle = paragraph.getStyle()
    const styleId = paraStyle?.styleId
    if (styleId && styleProfile?.styles?.[styleId]) {
      return styleProfile.styles[styleId].name || ''
    }
  } catch {
    // getStyle() may throw for some paragraphs
  }
  return ''
}

/**
 * 在文档样式档案中按名称（模糊匹配）查找 styleId。
 */
function findStyleIdByName(name: string, styleProfile: any): string | null {
  if (!styleProfile?.styles) return null
  for (const [styleId, style] of Object.entries(styleProfile.styles)) {
    const s = style as any
    if (s.name && styleNameMatches(s.name, name)) {
      return styleId
    }
  }
  return null
}

// ========== Section Type Detection ==========

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
      // 段落文本包含 "摘要" 或 "Abstract"
      if (text.includes('摘要') || /^abstract/i.test(normalizedText)) return true
      // 或位于摘要节内（摘要标题之后，下一个标题之前）
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
      // styleId 以 "TOC" 或 "toc" 开头，或中文数字 "10"-"19"
      if (/^(TOC|toc)/i.test(styleId)) return true
      if (/^1\d$/.test(styleId)) return true
      // 检查 outlineLevel 是否在目录范围
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

interface SectionRange {
  start: number
  end: number
  sectionType: string
  headingLevel: number | null
}

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
    // 也检测文本样式的标题（如"摘要"、"结论"等）
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
    } else if (headingText.startsWith('关键词') || headingText.startsWith('keywords') || headingText.startsWith('keywords')) {
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

// ========== Page Settings Helpers ==========

/**
 * 应用页面设置（页眉/页脚/页码）。
 * 通过虚拟树 API 修改 header/footer 内容。
 */
function applyPageSettings(doc: any, pageSettings: SmartFormatSpec['pageSettings']): void {
  if (!pageSettings) return

  const tree = doc.toComponentTree()

  // 处理页眉
  if (pageSettings.header) {
    const headerNode = tree.children.find((node: any) => node.type === 'header')
    if (headerNode && headerNode.children && headerNode.children.length > 0) {
      const firstPara = headerNode.children[0]
      if (pageSettings.header.text !== undefined) {
        firstPara.props.text = pageSettings.header.text
      }
      if (pageSettings.header.paragraphStyle) {
        firstPara.props.style = {
          ...(firstPara.props.style || {}),
          ...pageSettings.header.paragraphStyle,
        }
      }
      if (pageSettings.header.runStyle && firstPara.children && firstPara.children.length > 0) {
        for (const run of firstPara.children) {
          if (run.type === 'run') {
            run.props.style = {
              ...(run.props.style || {}),
              ...pageSettings.header.runStyle,
            }
          }
        }
      }
    }
  }

  // 处理页脚
  if (pageSettings.footer) {
    const footerNode = tree.children.find((node: any) => node.type === 'footer')
    if (footerNode && footerNode.children && footerNode.children.length > 0) {
      const firstPara = footerNode.children[0]
      if (pageSettings.footer.text !== undefined) {
        firstPara.props.text = pageSettings.footer.text
      }
      if (pageSettings.footer.paragraphStyle) {
        firstPara.props.style = {
          ...(firstPara.props.style || {}),
          ...pageSettings.footer.paragraphStyle,
        }
      }
      if (pageSettings.footer.runStyle && firstPara.children && firstPara.children.length > 0) {
        for (const run of firstPara.children) {
          if (run.type === 'run') {
            run.props.style = {
              ...(run.props.style || {}),
              ...pageSettings.footer.runStyle,
            }
          }
        }
      }
    }
  }

  // 处理页码
  if (pageSettings.pageNumbering) {
    const bodyNode = tree.children.find((node: any) => node.type === 'body')
    if (bodyNode && bodyNode.props) {
      // 在 body.props 中设置 sectPr 页码属性
      if (!bodyNode.props.sectPr) {
        bodyNode.props.sectPr = {}
      }
      const { position } = pageSettings.pageNumbering
      bodyNode.props.sectPr.pgNumType = {
        fmt: 'decimal',
      }
      // 根据位置判断对齐方式 (映射到页脚/页眉中的页码域)
      // 页码位置映射：bottom-* 在页脚，top-* 在页眉
      const alignment =
        position.endsWith('center') ? 'center' :
        position.endsWith('right') ? 'right' : 'center'

      // 在对应页眉/页脚中插入页码域
      const targetPartType = position.startsWith('top') ? 'header' : 'footer'
      const targetNode = tree.children.find((node: any) => node.type === targetPartType)
      if (targetNode && targetNode.children && targetNode.children.length > 0) {
        const firstPara = targetNode.children[0]
        // 设置段落对齐
        firstPara.props.style = {
          ...(firstPara.props.style || {}),
          alignment,
        }
        // 对 run 应用页码样式
        if (pageSettings.pageNumbering.runStyle && firstPara.children) {
          for (const run of firstPara.children) {
            if (run.type === 'run') {
              run.props.style = {
                ...(run.props.style || {}),
                ...pageSettings.pageNumbering.runStyle,
              }
            }
          }
        }
      }
    }
  }

  doc.patch(tree)
}

// ========== Rule Matching ==========

/**
 * 检查一个段落是否匹配给定的规则。
 */
export function paragraphMatchesRule(
  paragraph: any,
  rule: ParagraphFormatRule,
  styleProfile: any,
  sectionRanges: SectionRange[],
  paraIndex: number,
  paragraphTypeMap?: Map<number, string>
): boolean {
  const match = rule.match
  let hasCriteria = false

  // headingLevel 匹配
  if (match.headingLevel !== undefined) {
    hasCriteria = true
    let level: number | null = null
    try { level = paragraph.getHeadingLevel() } catch { /* ignore */ }
    if (level !== match.headingLevel) return false
  }

  // textPattern 匹配（不区分大小写的正则）
  if (match.textPattern) {
    hasCriteria = true
    const text = paragraph.getText() || ''
    try {
      const regex = new RegExp(match.textPattern, 'i')
      if (!regex.test(text)) return false
    } catch {
      // 非正则时尝试精确匹配（不区分大小写）
      if (!text.toLowerCase().includes(match.textPattern.toLowerCase())) return false
    }
  }

  // styleName 匹配（模糊匹配）
  if (match.styleName) {
    hasCriteria = true
    const paraStyleName = getParagraphStyleName(paragraph, styleProfile)
    if (!paraStyleName || !styleNameMatches(paraStyleName, match.styleName)) return false
  }

  // sectionType 匹配
  if (match.sectionType) {
    hasCriteria = true
    if (!paragraphMatchesSectionType(paragraph, match.sectionType, styleProfile, sectionRanges, paraIndex)) {
      return false
    }
  }

  // paragraphType 匹配（通过外部传入的分类映射表）
  if (match.paragraphType) {
    hasCriteria = true
    const actualType = paragraphTypeMap?.get(paraIndex)
    if (!actualType || actualType !== match.paragraphType) {
      return false
    }
  }

  // 至少需要一个匹配条件
  return hasCriteria
}

// ========== Main Export ==========

/**
 * Smart Format Application Engine
 *
 * 将结构化的格式规范（SmartFormatSpec）应用到目标文档。
 * 支持两层操作：
 * 1. 样式级：通过 applyStyleProfile 修改/创建样式定义
 * 2. 段落级：通过 ParagraphController API 直接对匹配的段落应用格式
 *
 * @param inputPath  目标文档路径
 * @param outputPath 输出文档路径
 * @param spec       格式规范
 * @returns 应用结果 { success, appliedStyles, appliedParagraphs, error? }
 */
export async function applySmartFormat(
  inputPath: string,
  outputPath: string,
  spec: SmartFormatSpec,
  paragraphTypeMap?: Map<number, string>
): Promise<SmartFormatResult> {
  let doc: any = null
  let appliedStyles = 0
  let appliedParagraphs = 0

  try {
    // 1. 加载文档
    doc = await loadDocx(inputPath)

    // 2. 应用样式级定义（styleProfile）
    if (spec.styleProfile) {
      const profile = spec.styleProfile
      doc.applyStyleProfile(profile)
      // 统计应用的样式数量
      const styleCount = Object.keys(profile.styles || {}).length
      appliedStyles = styleCount
    }

    // 3. 应用段落级规则（paragraphRules）
    if (spec.paragraphRules && spec.paragraphRules.length > 0) {
      const body = doc.getBody()
      if (!body) {
        throw new Error('文档没有正文部分')
      }

      const paragraphs = body.getParagraphs()
      if (paragraphs && paragraphs.length > 0) {
        const styleProfile = doc.getStyleProfile()
        const sectionRanges = buildSectionRanges(paragraphs)

        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i]

          for (const rule of spec.paragraphRules!) {
            // 检查是否匹配
            if (!paragraphMatchesRule(paragraph, rule, styleProfile, sectionRanges, i, paragraphTypeMap)) {
              continue
            }

            // 应用格式
            let applied = false

            // 方式1：通过 styleName 应用命名样式
            if (rule.format.styleName) {
              const targetStyleId = findStyleIdByName(rule.format.styleName, styleProfile)
              if (targetStyleId) {
                paragraph.patchStyle({ styleId: targetStyleId })
                applied = true
              } else {
                console.warn(
                  `[applySmartFormat] 未找到匹配的样式: "${rule.format.styleName}"，` +
                  `段落文本: "${(paragraph.getText() || '').slice(0, 50)}..."`
                )
              }
            }

            // 方式2：直接应用段落样式
            if (rule.format.paragraphStyle) {
              paragraph.patchStyle(rule.format.paragraphStyle)
              applied = true
            }

            // 方式3：应用 run 样式到段落内所有 run
            if (rule.format.runStyle) {
              try {
                const runs = paragraph.getRuns()
                if (runs && runs.length > 0) {
                  for (const run of runs) {
                    run.patchStyle(rule.format.runStyle)
                  }
                  applied = true
                }
              } catch {
                // getRuns() may fail for some paragraph types
              }
            }

            if (applied) {
              appliedParagraphs++
            }

            // 如果规则是 exclusive，跳过后续规则
            if (rule.exclusive) break
          }
        }
      }
    }

    // 4. 应用页面设置
    if (spec.pageSettings) {
      applyPageSettings(doc, spec.pageSettings)
    }

    // 5. 保存文档
    await doc.saveAs(outputPath)

    return {
      success: true,
      appliedStyles,
      appliedParagraphs,
    }
  } catch (err: any) {
    console.error('[applySmartFormat] 错误:', err)
    return {
      success: false,
      appliedStyles,
      appliedParagraphs,
      error: err.message || String(err),
    }
  }
}
