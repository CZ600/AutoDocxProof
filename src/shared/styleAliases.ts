// ========== Style Name Aliases ==========

/**
 * 样式名常见别名映射，用于模糊名称匹配。
 */
export const STYLE_NAME_ALIASES: Record<string, string[]> = {
  'heading 1':   ['标题 1', '标题1', 'Heading 1', 'heading 1'],
  'heading 2':   ['标题 2', '标题2', 'Heading 2', 'heading 2'],
  'heading 3':   ['标题 3', '标题3', 'Heading 3', 'heading 3'],
  'heading 4':   ['标题 4', '标题4', 'Heading 4', 'heading 4'],
  'heading 5':   ['标题 5', '标题5', 'Heading 5', 'heading 5'],
  'heading 6':   ['标题 6', '标题6', 'Heading 6', 'heading 6'],
  'heading 7':   ['标题 7', '标题7', 'Heading 7', 'heading 7'],
  'heading 8':   ['标题 8', '标题8', 'Heading 8', 'heading 8'],
  'heading 9':   ['标题 9', '标题9', 'Heading 9', 'heading 9'],
  'normal':      ['正文', 'Normal', 'normal', 'Normal Text'],
  'title':       ['标题', 'Title', 'title', '文档标题'],
  'subtitle':    ['副标题', 'Subtitle', 'subtitle'],
  'header':      ['页眉', 'Header', 'header', '页眉字符'],
  'footer':      ['页脚', 'Footer', 'footer', '页脚字符'],
  'caption':     ['题注', 'Caption', 'caption'],
  'footnote text':     ['脚注文本', 'Footnote Text', 'footnote text'],
  'endnote text':      ['尾注文本', 'Endnote Text', 'endnote text'],
  'toc 1':       ['目录 1', '目录1', 'TOC 1', 'toc 1'],
  'toc 2':       ['目录 2', '目录2', 'TOC 2', 'toc 2'],
  'toc 3':       ['目录 3', '目录3', 'TOC 3', 'toc 3'],
  'list paragraph':    ['列表段落', 'List Paragraph', 'ListParagraph'],
  'quote':       ['引用', 'Quote', 'Intense Quote'],
}

// ========== Helper Functions ==========

/**
 * 判断两个样式名是否匹配（支持精确、忽略大小写、去空格、别名表匹配）
 */
export function styleNameMatches(srcName: string, dstName: string): boolean {
  // 精确匹配
  if (srcName === dstName) return true
  // 忽略大小写
  if (srcName.toLowerCase() === dstName.toLowerCase()) return true
  // 去空格后匹配
  if (srcName.replace(/\s+/g, '') === dstName.replace(/\s+/g, '')) return true
  // 别名表匹配：判断两个名称是否属于同一别名组
  const srcLower = srcName.toLowerCase().replace(/\s+/g, '')
  const dstLower = dstName.toLowerCase().replace(/\s+/g, '')
  for (const [, aliases] of Object.entries(STYLE_NAME_ALIASES)) {
    const normalizedAliases = aliases.map(a => a.toLowerCase().replace(/\s+/g, ''))
    if (normalizedAliases.includes(srcLower) && normalizedAliases.includes(dstLower)) {
      return true
    }
  }
  return false
}
