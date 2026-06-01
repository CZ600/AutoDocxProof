import { describe, it, expect } from 'vitest'
import {
  classifyParagraphsHeuristic,
  ParagraphMetadata,
} from '../src/main/smartFormatAgent'
import type { ParagraphType } from '../src/main/smartFormatApply'

/** Helper to create a ParagraphMetadata object with defaults */
function m(overrides: Partial<ParagraphMetadata> = {}): ParagraphMetadata {
  return {
    index: 99,
    text: '',
    firstChars: '',
    headingLevel: null,
    styleId: '',
    isBold: false,
    sectionType: null,
    ...overrides,
  }
}

/** Helper: get classification for a single paragraph */
function classify(meta: ParagraphMetadata): ParagraphType {
  return classifyParagraphsHeuristic([meta]).get(meta.index)!
}

// ========== paper-title ==========

describe('paper-title', () => {
  it('classifies index-0 short non-heading text as paper-title', () => {
    const result = classify(m({ index: 0, text: '浅析人工智能在医疗领域的应用', headingLevel: null }))
    expect(result).toBe('paper-title')
  })

  it('does NOT classify as paper-title if headingLevel is present', () => {
    const result = classify(m({ index: 0, text: 'Short Title', headingLevel: 1 }))
    expect(result).not.toBe('paper-title')
  })

  it('does NOT classify as paper-title if text >= 50 chars', () => {
    const longText = 'A'.repeat(50)
    const result = classify(m({ index: 0, text: longText, headingLevel: null }))
    expect(result).not.toBe('paper-title')
  })

  it('does NOT classify as paper-title if text matches section heading', () => {
    const result = classify(m({ index: 0, text: '摘要', headingLevel: null }))
    expect(result).not.toBe('paper-title')
  })

  it('does NOT classify as paper-title if index is not 0', () => {
    const result = classify(m({ index: 1, text: 'Short Title', headingLevel: null }))
    expect(result).not.toBe('paper-title')
  })
})

// ========== abstract ==========

describe('abstract', () => {
  it('classifies "摘要" as abstract-cn-title', () => {
    expect(classify(m({ text: '摘要', sectionType: 'abstract' }))).toBe('abstract-cn-title')
  })

  it('classifies "摘 要" as abstract-cn-title', () => {
    expect(classify(m({ text: '摘 要', sectionType: 'abstract' }))).toBe('abstract-cn-title')
  })

  it('classifies Chinese text in abstract section as abstract-cn-content', () => {
    expect(classify(m({ text: '本文探讨了人工智能在医疗影像诊断中的应用', sectionType: 'abstract' }))).toBe('abstract-cn-content')
  })

  it('classifies "Abstract" as abstract-en-title', () => {
    expect(classify(m({ text: 'Abstract', sectionType: 'abstract' }))).toBe('abstract-en-title')
  })

  it('classifies English text in abstract section as abstract-en-content', () => {
    expect(classify(m({ text: 'This paper explores the application of AI in medical imaging', sectionType: 'abstract' }))).toBe('abstract-en-content')
  })

  it('abstract-cn-title wins over abstract-cn-content', () => {
    expect(classify(m({ text: '摘要', sectionType: 'abstract' }))).toBe('abstract-cn-title')
  })

  it('abstract-en-title wins over abstract-en-content', () => {
    expect(classify(m({ text: 'Abstract', sectionType: 'abstract' }))).toBe('abstract-en-title')
  })
})

// ========== keywords ==========

describe('keywords', () => {
  it('classifies "关键词" as keywords-cn-title', () => {
    expect(classify(m({ text: '关键词', sectionType: 'keywords' }))).toBe('keywords-cn-title')
  })

  it('classifies "Keywords" as keywords-en-title', () => {
    expect(classify(m({ text: 'Keywords', sectionType: 'keywords' }))).toBe('keywords-en-title')
  })

  it('classifies "Key words" as keywords-en-title', () => {
    expect(classify(m({ text: 'Key words', sectionType: 'keywords' }))).toBe('keywords-en-title')
  })

  it('classifies Chinese text after keywords-cn-title as keywords-cn-body', () => {
    const metadata = [
      m({ index: 5, text: '关键词', sectionType: 'keywords' }),
      m({ index: 6, text: '人工智能；医疗影像；深度学习', sectionType: 'keywords' }),
    ]
    const result = classifyParagraphsHeuristic(metadata)
    expect(result.get(5)).toBe('keywords-cn-title')
    expect(result.get(6)).toBe('keywords-cn-body')
  })

  it('classifies English text after keywords-en-title as keywords-en-body', () => {
    const metadata = [
      m({ index: 5, text: 'Keywords', sectionType: 'keywords' }),
      m({ index: 6, text: 'Artificial Intelligence; Medical Imaging; Deep Learning', sectionType: 'keywords' }),
    ]
    const result = classifyParagraphsHeuristic(metadata)
    expect(result.get(5)).toBe('keywords-en-title')
    expect(result.get(6)).toBe('keywords-en-body')
  })

  it('resets position context on section change', () => {
    const metadata = [
      m({ index: 5, text: '关键词', sectionType: 'keywords' }),
      m({ index: 6, text: 'AI; ML; DL', sectionType: 'body' }), // different section, should NOT be keywords-cn-body
    ]
    const result = classifyParagraphsHeuristic(metadata)
    expect(result.get(5)).toBe('keywords-cn-title')
    expect(result.get(6)).not.toBe('keywords-cn-body')
  })
})

// ========== heading levels ==========

describe('heading levels', () => {
  it('classifies headingLevel 1 as chapter-title', () => {
    expect(classify(m({ text: '第一章 绪论', headingLevel: 1 }))).toBe('chapter-title')
  })

  it('classifies text matching 第X章 as chapter-title', () => {
    expect(classify(m({ text: '第一章 绪论', headingLevel: null }))).toBe('chapter-title')
  })

  it('classifies headingLevel 2 as section-1-title', () => {
    expect(classify(m({ text: '研究背景', headingLevel: 2 }))).toBe('section-1-title')
  })

  it('classifies headingLevel 3 as section-2-title', () => {
    expect(classify(m({ text: '实验方法', headingLevel: 3 }))).toBe('section-2-title')
  })

  it('classifies headingLevel 4 as section-3-title', () => {
    expect(classify(m({ text: '数据采集', headingLevel: 4 }))).toBe('section-3-title')
  })

  it('chapter-title (level 1) wins over section-1-title', () => {
    // headingLevel 1 should be chapter-title, not anything else
    expect(classify(m({ text: '第一章', headingLevel: 1 }))).toBe('chapter-title')
  })
})

// ========== item-title ==========

describe('item-title', () => {
  it('classifies bold Chinese-numbered item as item-title', () => {
    expect(classify(m({ text: '（一）研究背景', isBold: true }))).toBe('item-title')
  })

  it('classifies bold parenthesized number item as item-title', () => {
    expect(classify(m({ text: '(1) Introduction', isBold: true }))).toBe('item-title')
  })

  it('classifies bold numbered item with Chinese comma as item-title', () => {
    expect(classify(m({ text: '一、研究背景', isBold: true }))).toBe('item-title')
  })

  it('does NOT classify non-bold item as item-title', () => {
    expect(classify(m({ text: '（一）研究背景', isBold: false }))).not.toBe('item-title')
  })

  it('does NOT classify non-matching text as item-title', () => {
    expect(classify(m({ text: '普通文本', isBold: true }))).not.toBe('item-title')
  })
})

// ========== conclusion ==========

describe('conclusion', () => {
  it('classifies "结论" as conclusion-title', () => {
    expect(classify(m({ text: '结论', sectionType: 'conclusion' }))).toBe('conclusion-title')
  })

  it('classifies "Conclusion" as conclusion-title', () => {
    expect(classify(m({ text: 'Conclusion', sectionType: 'conclusion' }))).toBe('conclusion-title')
  })

  it('classifies sectionType conclusion with headingLevel >= 1 as conclusion-title', () => {
    expect(classify(m({ text: '总结与展望', sectionType: 'conclusion', headingLevel: 1 }))).toBe('conclusion-title')
  })

  it('classifies other text in conclusion section as conclusion-content', () => {
    expect(classify(m({ text: '本文通过实验验证了...', sectionType: 'conclusion' }))).toBe('conclusion-content')
  })

  it('conclusion-title wins over conclusion-content', () => {
    const metadata = [
      m({ index: 0, text: '结论', sectionType: 'conclusion', headingLevel: 1 }),
      m({ index: 1, text: '本文通过实验验证了...', sectionType: 'conclusion' }),
    ]
    const result = classifyParagraphsHeuristic(metadata)
    expect(result.get(0)).toBe('conclusion-title')
    expect(result.get(1)).toBe('conclusion-content')
  })
})

// ========== references ==========

describe('references', () => {
  it('classifies "参考文献" as references-title', () => {
    expect(classify(m({ text: '参考文献', sectionType: 'references' }))).toBe('references-title')
  })

  it('classifies "References" as references-title', () => {
    expect(classify(m({ text: 'References', sectionType: 'references' }))).toBe('references-title')
  })

  it('classifies sectionType references with headingLevel >= 1 as references-title', () => {
    expect(classify(m({ text: '参考', sectionType: 'references', headingLevel: 1 }))).toBe('references-title')
  })

  it('classifies other text in references section as references-content', () => {
    expect(classify(m({ text: '[1] Smith, J. et al. AI in Medicine. Nature, 2023.', sectionType: 'references' }))).toBe('references-content')
  })
})

// ========== toc ==========

describe('toc', () => {
  it('classifies "目录" as toc-title', () => {
    expect(classify(m({ text: '目录', sectionType: 'toc' }))).toBe('toc-title')
  })

  it('classifies toc section with headingLevel >= 1 as toc-chapter', () => {
    expect(classify(m({ text: '第一章 绪论', sectionType: 'toc', headingLevel: 1 }))).toBe('toc-chapter')
  })

  it('classifies toc section with chapter reference as toc-chapter', () => {
    expect(classify(m({ text: '第一章 绪论...', sectionType: 'toc', headingLevel: null }))).toBe('toc-chapter')
  })

  it('classifies other toc entries as toc-other', () => {
    expect(classify(m({ text: '1.1 研究背景', sectionType: 'toc' }))).toBe('toc-other')
  })

  it('toc-title wins over toc-other', () => {
    expect(classify(m({ text: '目录', sectionType: 'toc' }))).toBe('toc-title')
  })
})

// ========== acknowledgement & appendix ==========

describe('acknowledgement and appendix', () => {
  it('classifies "致谢" as acknowledgement-title', () => {
    expect(classify(m({ text: '致谢' }))).toBe('acknowledgement-title')
  })

  it('classifies "Acknowledgement" as acknowledgement-title', () => {
    expect(classify(m({ text: 'Acknowledgement' }))).toBe('acknowledgement-title')
  })

  it('classifies "附录" as appendix-title', () => {
    expect(classify(m({ text: '附录' }))).toBe('appendix-title')
  })

  it('classifies "Appendix" as appendix-title', () => {
    expect(classify(m({ text: 'Appendix A' }))).toBe('appendix-title')
  })
})

// ========== body fallback ==========

describe('body fallback', () => {
  it('classifies unrecognized text as body', () => {
    expect(classify(m({ text: '这是一段普通的正文内容，没有任何特殊的标题特征。' }))).toBe('body')
  })

  it('classifies empty text as body', () => {
    expect(classify(m({ text: '' }))).toBe('body')
  })
})

// ========== all paragraphs classified ==========

describe('all paragraphs classified', () => {
  it('classifies every paragraph (no undefined/null)', () => {
    const metadata: ParagraphMetadata[] = [
      m({ index: 0, text: '论文标题', headingLevel: null }),
      m({ index: 1, text: '摘要', sectionType: 'abstract', headingLevel: 1 }),
      m({ index: 2, text: '本文研究了...', sectionType: 'abstract' }),
      m({ index: 3, text: 'Abstract', sectionType: 'abstract' }),
      m({ index: 4, text: 'This paper studies...', sectionType: 'abstract' }),
      m({ index: 5, text: '关键词', sectionType: 'keywords' }),
      m({ index: 6, text: '人工智能；深度学习', sectionType: 'keywords' }),
      m({ index: 7, text: 'Keywords', sectionType: 'keywords' }),
      m({ index: 8, text: 'AI; Deep Learning', sectionType: 'keywords' }),
      m({ index: 9, text: '第一章 绪论', headingLevel: 1 }),
      m({ index: 10, text: '正文内容段落', sectionType: 'body' }),
      m({ index: 11, text: '1.1 背景', headingLevel: 2 }),
      m({ index: 12, text: '结论', sectionType: 'conclusion', headingLevel: 1 }),
      m({ index: 13, text: '总结文本...', sectionType: 'conclusion' }),
      m({ index: 14, text: '参考文献', sectionType: 'references', headingLevel: 1 }),
      m({ index: 15, text: '[1] Author. Title. 2023.', sectionType: 'references' }),
      m({ index: 16, text: '致谢' }),
      m({ index: 17, text: '附录A', sectionType: 'appendix' }),
      m({ index: 18, text: '目录', sectionType: 'toc' }),
      m({ index: 19, text: '第一章 绪论...', sectionType: 'toc' }),
      m({ index: 20, text: '1.1 背景...', sectionType: 'toc' }),
    ]

    const result = classifyParagraphsHeuristic(metadata)

    for (let i = 0; i < metadata.length; i++) {
      const type = result.get(i)
      expect(type, `paragraph ${i} must have a classification`).toBeDefined()
      expect(
        ['paper-title', 'chapter-title', 'section-1-title', 'section-2-title',
          'section-3-title', 'item-title', 'body',
          'abstract-cn-title', 'abstract-cn-content',
          'abstract-en-title', 'abstract-en-content',
          'keywords-cn-title', 'keywords-cn-body',
          'keywords-en-title', 'keywords-en-body',
          'conclusion-title', 'conclusion-content',
          'references-title', 'references-content',
          'toc-title', 'toc-chapter', 'toc-other',
          'acknowledgement-title', 'appendix-title',
        ],
      ).toContain(type)
    }
  })

  it('classifies a realistic academic paper structure correctly', () => {
    const metadata: ParagraphMetadata[] = [
      m({ index: 0, text: '基于深度学习的医学影像分析研究', headingLevel: null }),
      m({ index: 1, text: '摘要', sectionType: 'abstract', headingLevel: 1 }),
      m({ index: 2, text: '随着人工智能技术的快速发展，深度学习在医学影像分析领域取得了显著成果...', sectionType: 'abstract' }),
      m({ index: 3, text: 'Abstract', sectionType: 'abstract' }),
      m({ index: 4, text: 'With the rapid development of artificial intelligence technology...', sectionType: 'abstract' }),
      m({ index: 5, text: '关键词', sectionType: 'keywords' }),
      m({ index: 6, text: '深度学习；医学影像；卷积神经网络', sectionType: 'keywords' }),
      m({ index: 7, text: 'Keywords', sectionType: 'keywords' }),
      m({ index: 8, text: 'Deep Learning; Medical Imaging; CNN', sectionType: 'keywords' }),
      m({ index: 9, text: '第一章 绪论', headingLevel: 1 }),
      m({ index: 10, text: '1.1 研究背景与意义', headingLevel: 2 }),
      m({ index: 11, text: '近年来，医学影像技术在临床诊断中发挥着越来越重要的作用...', sectionType: 'body' }),
      m({ index: 12, text: '第二章 相关工作', headingLevel: 1 }),
      m({ index: 13, text: '结论', sectionType: 'conclusion', headingLevel: 1 }),
      m({ index: 14, text: '本文针对医学影像分析中的关键问题，提出了...', sectionType: 'conclusion' }),
      m({ index: 15, text: '参考文献', sectionType: 'references', headingLevel: 1 }),
      m({ index: 16, text: '[1] He K, Zhang X, Ren S, et al. Deep Residual Learning for Image Recognition. CVPR, 2016.', sectionType: 'references' }),
      m({ index: 17, text: '致谢' }),
    ]

    const result = classifyParagraphsHeuristic(metadata)

    expect(result.get(0)).toBe('paper-title')
    expect(result.get(1)).toBe('abstract-cn-title')
    expect(result.get(2)).toBe('abstract-cn-content')
    expect(result.get(3)).toBe('abstract-en-title')
    expect(result.get(4)).toBe('abstract-en-content')
    expect(result.get(5)).toBe('keywords-cn-title')
    expect(result.get(6)).toBe('keywords-cn-body')
    expect(result.get(7)).toBe('keywords-en-title')
    expect(result.get(8)).toBe('keywords-en-body')
    expect(result.get(9)).toBe('chapter-title')
    expect(result.get(10)).toBe('section-1-title')
    expect(result.get(11)).toBe('body')
    expect(result.get(12)).toBe('chapter-title')
    expect(result.get(13)).toBe('conclusion-title')
    expect(result.get(14)).toBe('conclusion-content')
    expect(result.get(15)).toBe('references-title')
    expect(result.get(16)).toBe('references-content')
    expect(result.get(17)).toBe('acknowledgement-title')
  })
})
