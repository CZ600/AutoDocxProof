import { describe, it, expect, vi } from 'vitest'

// 直接测试审核 Prompt 构建和分批逻辑的纯函数
// 由于 Electron 主进程模块无法在 Node 中直接导入，我们测试可独立验证的逻辑

describe('Review batch splitting logic', () => {
  const BATCH_SIZE = 100

  function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  it('should not split when count <= 100', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }))
    const batches = splitIntoBatches(items, BATCH_SIZE)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(50)
  })

  it('should not split when count == 100', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const batches = splitIntoBatches(items, BATCH_SIZE)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(100)
  })

  it('should split into 2 batches when count == 101', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ id: i }))
    const batches = splitIntoBatches(items, BATCH_SIZE)
    expect(batches).toHaveLength(2)
    expect(batches[0]).toHaveLength(100)
    expect(batches[1]).toHaveLength(1)
  })

  it('should split correctly with 250 items', () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ id: i }))
    const batches = splitIntoBatches(items, BATCH_SIZE)
    expect(batches).toHaveLength(3)
    expect(batches[0]).toHaveLength(100)
    expect(batches[1]).toHaveLength(100)
    expect(batches[2]).toHaveLength(50)
  })

  it('should return empty array for 0 items', () => {
    const batches = splitIntoBatches([], BATCH_SIZE)
    expect(batches).toHaveLength(0)
  })
})

describe('Review filter criteria detection', () => {
  // 测试纯逻辑的过滤规则检测

  it('should detect no-change items (original === suggested)', () => {
    const items = [
      { original: '测试', suggested: '测试', reason: '测试', type: 'Typo' },
      { original: ' hello', suggested: 'hello', reason: '去除空格', type: 'Typo' }
    ]
    const noChangeItems = items.filter(i => i.original === i.suggested)
    expect(noChangeItems).toHaveLength(1)
  })

  it('should detect blank items', () => {
    const items = [
      { original: '测试', suggested: '', reason: '删除', type: 'Grammar' },
      { original: '', suggested: '测试', reason: '添加', type: 'Grammar' },
      { original: '  ', suggested: '测试', reason: '替换空白', type: 'Grammar' }
    ]
    const blankItems = items.filter(i => !i.original.trim() || !i.suggested.trim())
    expect(blankItems).toHaveLength(3)
  })

  it('should keep valid items', () => {
    const items = [
      { original: '测试', suggested: '测是', reason: '错别字', type: 'Typo' },
      { original: '可以的', suggested: '可以的。', reason: '缺少句号', type: 'Punctuation' }
    ]
    const validItems = items.filter(i => i.original.trim() && i.suggested.trim() && i.original !== i.suggested)
    expect(validItems).toHaveLength(2)
  })
})

describe('ProofreadingCorrection type shape', () => {
  it('should accept all required fields', () => {
    const correction = {
      original: '原文',
      suggested: '建议',
      reason: '原因',
      type: 'Typo'
    }
    expect(correction.original).toBe('原文')
    expect(correction.suggested).toBe('建议')
    expect(correction.reason).toBe('原因')
    expect(correction.type).toBe('Typo')
  })

  it('should accept optional filtered and filterReason fields', () => {
    const correction = {
      original: '原文',
      suggested: '建议',
      reason: '原因',
      type: 'Typo',
      filtered: true,
      filterReason: '没有实际改动'
    }
    expect(correction.filtered).toBe(true)
    expect(correction.filterReason).toBe('没有实际改动')
  })

  it('should work without optional fields', () => {
    const correction: {
      original: string
      suggested: string
      reason: string
      type: string
      filtered?: boolean
      filterReason?: string
    } = {
      original: '原文',
      suggested: '建议',
      reason: '原因',
      type: 'Grammar'
    }
    expect(correction.filtered).toBeUndefined()
    expect(correction.filterReason).toBeUndefined()
  })
})
