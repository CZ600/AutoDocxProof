const { loadDocx } = require('docx-edit')

interface Replacement {
  original: string
  suggested: string
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 脚注占位符匹配：docx-edit 的 getText() 会将脚注引用输出为 [[FOOTNOTE_REF:id]]
// 在 run 级别的 collectTextSegments 中不会包含脚注引用节点，因此 fullText 不含这些占位符
// 需要在匹配前从 searchText 中 strip 掉
const FOOTNOTE_PLACEHOLDER_RE = /\[\[FOOTNOTE_REF:\d+\]\]/g

function stripFootnotePlaceholders(text: string): string {
  return text.replace(FOOTNOTE_PLACEHOLDER_RE, '')
}

function replaceFirstWhitespaceInsensitive(
  text: string,
  searchValue: string,
  replacement: string
): { count: number; text: string } {
  const normalizedSearch = searchValue.trim()
  if (!normalizedSearch) {
    return { count: 0, text }
  }

  const pattern = escapeRegExp(normalizedSearch).replace(/\s+/g, '\\s+')
  const regex = new RegExp(pattern)

  if (!regex.test(text)) {
    return { count: 0, text }
  }

  return {
    count: 1,
    text: text.replace(regex, replacement)
  }
}

// ====== Run 级别文本替换（保留上下角标格式） ======

/**
 * 检查段落是否需要使用 run 级别替换（而非 paragraph.props.text 整段替换）。
 *
 * 必须走 run 级别的情况：
 * 1. 包含上标/下标（vertAlign）的 run → setText() 会按字符数重分配，导致角标漂移
 * 2. 包含 footnoteReference / endnoteReference 子节点 → setText() 要求
 *    [[FOOTNOTE_REF:id]] 占位符完全保留，修改 props.text 时容易丢失
 * 3. 包含 math 子节点 → patch 引擎本身会跳过 setText()，但 run 级别更安全
 */
function needsRunLevelReplacement(paraNode: any): boolean {
  function visit(parent: any): boolean {
    if (!parent || !parent.children) return false
    for (const child of parent.children) {
      if (child.type === 'run') {
        const style = child.props.style || {}
        if (style.vertAlign === 'superscript' || style.vertAlign === 'subscript') {
          return true
        }
        // run 内含脚注/尾注引用
        if (child.children) {
          for (const rc of child.children) {
            if (rc.type === 'footnoteReference' || rc.type === 'endnoteReference') {
              return true
            }
          }
        }
      } else if (child.type === 'hyperlink') {
        if (visit(child)) return true
      } else if (child.type === 'math') {
        return true
      }
    }
    return false
  }
  return visit(paraNode)
}

/**
 * 文本片段：对应 run 内的一个 w:t 文本节点。
 */
interface TextSegment {
  node: any
  start: number
  end: number
  text: string
}

/**
 * 收集段落中所有 w:t 文本节点及其在拼接文本中的位置。
 * 深入遍历 run 及 hyperlink 容器，跳过 tab、break 等非文本节点。
 */
function collectTextSegments(paraNode: any): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0

  function visit(parent: any) {
    if (!parent || !parent.children) return
    for (const child of parent.children) {
      if (child.type === 'run') {
        for (const textChild of child.children || []) {
          if (textChild.type === 'text') {
            const text = textChild.props.text || ''
            segments.push({ node: textChild, start: cursor, end: cursor + text.length, text })
            cursor += text.length
          }
        }
      } else if (child.type === 'hyperlink') {
        visit(child)
      }
    }
  }

  visit(paraNode)
  return segments
}

/**
 * 在段落内执行 run 级别的文本替换，保留每个 run 的格式（上下角标、加粗等）。
 *
 * 核心原理：仅修改 w:t 文本节点的 props.text，不修改 paragraph.props.text。
 * 这使得 patch 引擎在处理时走 children 路径而非 setText() 路径，
 * 从而避免了 ParagraphTextModel.setText() 按原始字符数重分配文本导致的
 * 格式边界错位问题。
 *
 * 局限性：当匹配跨越 tab / break 等非文本节点时，可能无法匹配成功。
 * 对于校对场景，这种情况极少出现。
 */
function replaceInParagraphRuns(
  paraNode: any,
  searchText: string,
  replaceText: string
): boolean {
  const segments = collectTextSegments(paraNode)
  if (segments.length === 0) return false

  const fullText = segments.map(s => s.text).join('')
  if (!fullText) return false

  // 空白不敏感匹配，同时 strip 脚注占位符（run 级别的 fullText 不含脚注引用）
  const normalizedSearch = stripFootnotePlaceholders(searchText.trim())
  if (!normalizedSearch) return false

  // replaceText 中也不能包含脚注占位符——脚注引用是独立的 XML 元素，
  // 不在 w:t 文本节点中。写入时必须 strip，否则 doc.patch() 会产生乱码。
  const cleanReplaceText = stripFootnotePlaceholders(replaceText)

  const pattern = escapeRegExp(normalizedSearch).replace(/\s+/g, '\\s+')
  const regex = new RegExp(pattern)
  const match = fullText.match(regex)

  if (!match || match.index === undefined) return false

  const matchStart = match.index
  const matchEnd = match.index + match[0].length

  // 找出被匹配覆盖的文本片段
  const affected = segments.filter(s => s.start < matchEnd && s.end > matchStart)
  if (affected.length === 0) return false

  if (affected.length === 1) {
    // 匹配在单个文本节点内——直接做字符串替换
    const seg = affected[0]
    const localStart = matchStart - seg.start
    const localEnd = matchEnd - seg.start
    seg.node.props.text = seg.text.slice(0, localStart) + cleanReplaceText + seg.text.slice(localEnd)
    return true
  }

  // 匹配跨越多个文本节点：按各节点被消耗的字符数比例分配替换文本
  const consumedLengths = affected.map(seg => {
    return Math.min(seg.end, matchEnd) - Math.max(seg.start, matchStart)
  })

  const totalConsumed = consumedLengths.reduce((a, b) => a + b, 0)
  if (totalConsumed === 0) return false

  let replaceCursor = 0

  for (let i = 0; i < affected.length; i++) {
    const seg = affected[i]
    const isLast = i === affected.length - 1

    const localMatchStart = Math.max(0, matchStart - seg.start)
    const localMatchEnd = Math.min(seg.text.length, matchEnd - seg.start)

    let replacementPortion: string
    if (isLast) {
      // 最后一个片段取剩余全部
      replacementPortion = cleanReplaceText.slice(replaceCursor)
    } else {
      // 按比例截取
      const portionLength = Math.round((cleanReplaceText.length * consumedLengths[i]) / totalConsumed)
      replacementPortion = cleanReplaceText.slice(replaceCursor, replaceCursor + portionLength)
      replaceCursor += portionLength
    }

    seg.node.props.text =
      seg.text.slice(0, localMatchStart) + replacementPortion + seg.text.slice(localMatchEnd)
  }

  return true
}

// ====== 树遍历辅助函数 ======

/**
 * 递归收集一个节点下的所有段落节点（包括表格单元格、文本框内的段落）。
 */
function collectAllParagraphs(node: any, result: any[] = []): any[] {
  if (!node || !node.children) return result
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      result.push(child)
    } else if (child.type === 'table') {
      for (const row of child.children || []) {
        if (row.type === 'table-row') {
          for (const cell of row.children || []) {
            if (cell.type === 'table-cell') {
              collectAllParagraphs(cell, result)
            }
          }
        }
      }
    } else if (child.type === 'text-box') {
      collectAllParagraphs(child, result)
    }
  }
  return result
}

// ====== 主导出函数 ======

/**
 * 使用 docx-edit 回写文档文本。
 *
 * 策略：
 * - 含上/下角标、脚注引用、尾注引用或数学公式的段落：通过虚拟树 API 在 run 级别
 *   修改 w:t 文本节点，不触发 ParagraphTextModel.setText() 的跨 run 字符数重分配，
 *   确保角标格式不会错位且脚注占位符不会丢失。
 * - 普通段落：使用 paragraph.props.text 的整段替换方式（兼容 tab / break）。
 */
export async function replaceTextInDocx(
  inputPath: string,
  outputPath: string,
  replacements: Replacement[]
): Promise<void> {
  const sanitizedReplacements = replacements.filter(
    item => item && item.original && item.suggested !== undefined
  )
  const doc = await loadDocx(inputPath)

  let appliedCount = 0
  const unmatched: Replacement[] = []

  // 一次取树，批量应用所有替换，最后一次 patch
  const tree = doc.toComponentTree()

  // 收集所有文档部件中的段落（body / header / footer 等）
  const allParagraphs: any[] = []
  for (const part of tree.children) {
    collectAllParagraphs(part, allParagraphs)
  }

  for (const replacement of sanitizedReplacements) {
    let applied = false

    for (const paraNode of allParagraphs) {
      if (needsRunLevelReplacement(paraNode)) {
        // 含上下角标或脚注/尾注/math：run 级别替换，保留格式
        applied = replaceInParagraphRuns(paraNode, replacement.original, replacement.suggested)
      } else {
        // 普通段落：整段文本替换（兼容 tab / break）
        const currentText = paraNode.props.text || ''
        const result = replaceFirstWhitespaceInsensitive(
          currentText,
          replacement.original,
          replacement.suggested
        )
        if (result.count > 0) {
          paraNode.props.text = result.text
          applied = true
        }
      }

      if (applied) {
        appliedCount += 1
        break
      }
    }

    if (!applied) {
      unmatched.push(replacement)
    }
  }

  if (appliedCount > 0) {
    doc.patch(tree)
  }

  await doc.saveAs(outputPath)

  console.log('[exportCorrectedDocx] export finished:', {
    inputPath,
    outputPath,
    totalReplacements: sanitizedReplacements.length,
    appliedCount,
    unmatchedCount: unmatched.length,
    unmatched
  })
}
