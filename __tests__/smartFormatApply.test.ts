import { describe, it, expect } from 'vitest'
import { paragraphMatchesRule, ParagraphFormatRule, ParagraphType } from '../src/main/smartFormatApply'

/**
 * 创建一个模拟段落对象，支持 paragraphMatchesRule 所需的接口。
 */
function createMockParagraph(text: string, headingLevel: number | null = null): any {
  return {
    getText: () => text,
    getHeadingLevel: () => headingLevel,
    getStyle: () => ({ styleId: 'Normal', name: 'normal' }),
  }
}

const dummyStyleProfile = {
  styles: {
    Normal: { name: 'normal', type: 'paragraph' },
    'Heading1': { name: 'heading 1', type: 'paragraph' },
  },
}

const emptySectionRanges: { start: number; end: number; sectionType: string; headingLevel: number | null }[] = []

describe('paragraphMatchesRule – paragraphType', () => {
  // ---------- Test 1: paragraphType matches specific classification ----------
  it('should match when paragraphType matches the classification in the map', () => {
    const rule: ParagraphFormatRule = {
      match: { paragraphType: 'abstract-cn-title' },
      format: { styleName: 'heading 1' },
    }

    const para = createMockParagraph('摘要')
    const typeMap = new Map<number, string>([
      [0, 'abstract-cn-title'],
    ])

    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(true)
  })

  // ---------- Test 2: paragraphType does not match ----------
  it('should NOT match when paragraphType differs from the classification in the map', () => {
    const rule: ParagraphFormatRule = {
      match: { paragraphType: 'abstract-cn-title' },
      format: { styleName: 'heading 1' },
    }

    const para = createMockParagraph('引言')
    const typeMap = new Map<number, string>([
      [0, 'body'],
    ])

    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(false)
  })

  // ---------- Test 3: paragraph has no classification (not in map) ----------
  it('should NOT match when paragraph index is not in the type map', () => {
    const rule: ParagraphFormatRule = {
      match: { paragraphType: 'abstract-cn-title' },
      format: { styleName: 'heading 1' },
    }

    const para = createMockParagraph('摘要')
    const typeMap = new Map<number, string>([
      [1, 'abstract-cn-title'],
    ])

    // para 的索引是 0，但 map 中只有索引 1
    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(false)
  })

  // ---------- Test 4: backward compat – rule without paragraphType still works ----------
  it('should still match existing criteria when paragraphType is not set (backward compat)', () => {
    const rule: ParagraphFormatRule = {
      match: { headingLevel: 1 },
      format: { styleName: 'heading 1' },
    }

    const para = createMockParagraph('Chapter 1', 1)
    const typeMap = new Map<number, string>([
      [0, 'body'],
    ])

    // paragraphType 未定义，不应受 typeMap 影响
    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(true)
  })

  // ---------- Test 5: paragraphType combined with other criteria ----------
  it('should match when both headingLevel and paragraphType match', () => {
    const rule: ParagraphFormatRule = {
      match: { headingLevel: 1, paragraphType: 'chapter-title' },
      format: { styleName: 'heading 1' },
    }

    const para = createMockParagraph('第一章 绪论', 1)
    const typeMap = new Map<number, string>([
      [0, 'chapter-title'],
    ])

    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(true)
  })

  // ---------- Test 6: paragraphType AND headingLevel – heading fails ----------
  it('should NOT match when paragraphType matches but headingLevel does not', () => {
    const rule: ParagraphFormatRule = {
      match: { headingLevel: 2, paragraphType: 'chapter-title' },
      format: { styleName: 'heading 2' },
    }

    const para = createMockParagraph('第一章 绪论', 1) // headingLevel 1 ≠ 2
    const typeMap = new Map<number, string>([
      [0, 'chapter-title'],
    ])

    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0, typeMap)).toBe(false)
  })

  // ---------- Test 7: paragraphType with empty/non-existent map ----------
  it('should NOT match when paragraphTypeMap is undefined', () => {
    const rule: ParagraphFormatRule = {
      match: { paragraphType: 'body' },
      format: { styleName: 'normal' },
    }

    const para = createMockParagraph('some body text')

    expect(paragraphMatchesRule(para, rule, dummyStyleProfile, emptySectionRanges, 0)).toBe(false)
  })

  // ---------- Test 8: ParagraphType type is properly exported ----------
  it('should have ParagraphType defined as a union of string literals', () => {
    // 类型级别的检查：验证各种段落类型值可通过类型系统
    const types: ParagraphType[] = [
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
    ]
    expect(types.length).toBeGreaterThanOrEqual(24)
    // 确保包含关键值
    expect(types).toContain('abstract-cn-title')
    expect(types).toContain('body')
    expect(types).toContain('chapter-title')
  })
})
