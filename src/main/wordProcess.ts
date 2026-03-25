const { loadDocx } = require('docx-edit')

interface Replacement {
  original: string
  suggested: string
}

interface ReplaceResult {
  count: number
  text: string
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceFirstWhitespaceInsensitive(text: string, searchValue: string, replacement: string): ReplaceResult {
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

/**
 * 使用 docx-edit 以段落级方式回写文档文本。
 * 当前策略按文档顺序为每条 correction 仅替换一次，
 * 避免把重复文本在全局范围内全部替换掉。
 */
export async function replaceTextInDocx(
  inputPath: string,
  outputPath: string,
  replacements: Replacement[]
): Promise<void> {
  const sanitizedReplacements = replacements.filter(item => item && item.original && item.suggested !== undefined)
  const doc = await loadDocx(inputPath)

  let appliedCount = 0
  const unmatched: Replacement[] = []

  for (const replacement of sanitizedReplacements) {
    let applied = false
    const paragraphs = doc.getParagraphs()

    for (const paragraph of paragraphs) {
      const currentText = paragraph.getText()
      const result = replaceFirstWhitespaceInsensitive(currentText, replacement.original, replacement.suggested)

      if (result.count > 0) {
        paragraph.setText(result.text)
        applied = true
        appliedCount += 1
        break
      }
    }

    if (!applied) {
      unmatched.push(replacement)
    }
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
