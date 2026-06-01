import { describe, it, expect } from 'vitest'
import {
  CHINESE_FONT_SIZE_MAP,
  resolveFontSize,
  FONT_FAMILY_MAP,
} from '../src/shared/chineseFontSize'

describe('CHINESE_FONT_SIZE_MAP', () => {
  it('should map all 16 Chinese font size names to correct half-point values', () => {
    const expected: Record<string, string> = {
      '初号': '84',
      '小初': '72',
      '一号': '52',
      '小一': '48',
      '二号': '44',
      '小二': '36',
      '三号': '32',
      '小三': '30',
      '四号': '28',
      '小四': '24',
      '五号': '21',
      '小五': '18',
      '六号': '15',
      '小六': '13',
      '七号': '12',
      '八号': '10',
    }

    expect(Object.keys(CHINESE_FONT_SIZE_MAP)).toHaveLength(16)

    for (const [name, halfPoints] of Object.entries(expected)) {
      expect(CHINESE_FONT_SIZE_MAP[name]).toBe(halfPoints)
    }
  })
})

describe('resolveFontSize()', () => {
  describe('Chinese font size names with "号" suffix', () => {
    it('should resolve "小四号" to "24"', () => {
      expect(resolveFontSize('小四号')).toBe('24')
    })

    it('should resolve "四号" to "28"', () => {
      expect(resolveFontSize('四号')).toBe('28')
    })

    it('should resolve "初号" to "84"', () => {
      expect(resolveFontSize('初号')).toBe('84')
    })

    it('should resolve "八号" to "10"', () => {
      expect(resolveFontSize('八号')).toBe('10')
    })
  })

  describe('Chinese font size names without suffix', () => {
    it('should resolve "小四" to "24"', () => {
      expect(resolveFontSize('小四')).toBe('24')
    })

    it('should resolve "五号" to "21" (direct map, no stripping needed)', () => {
      expect(resolveFontSize('五号')).toBe('21')
    })
  })

  describe('pt values', () => {
    it('should resolve "14pt" to "28"', () => {
      expect(resolveFontSize('14pt')).toBe('28')
    })

    it('should resolve "10.5pt" to "21"', () => {
      expect(resolveFontSize('10.5pt')).toBe('21')
    })

    it('should resolve "12pt" to "24"', () => {
      expect(resolveFontSize('12pt')).toBe('24')
    })

    it('should be case-insensitive: "14PT" and "14Pt"', () => {
      expect(resolveFontSize('14PT')).toBe('28')
      expect(resolveFontSize('14Pt')).toBe('28')
    })
  })

  describe('naked number strings (already half-points)', () => {
    it('should resolve "28" to "28"', () => {
      expect(resolveFontSize('28')).toBe('28')
    })

    it('should resolve "24" to "24"', () => {
      expect(resolveFontSize('24')).toBe('24')
    })
  })

  describe('unknown input', () => {
    it('should return unknown input unchanged', () => {
      expect(resolveFontSize('一些中文')).toBe('一些中文')
    })

    it('should return empty string unchanged', () => {
      expect(resolveFontSize('')).toBe('')
    })
  })
})

describe('FONT_FAMILY_MAP', () => {
  it('should have exactly 5 entries', () => {
    expect(Object.keys(FONT_FAMILY_MAP)).toHaveLength(5)
  })

  it('should map 黑体 correctly', () => {
    expect(FONT_FAMILY_MAP['黑体']).toEqual({
      ascii: 'SimHei',
      eastAsia: '黑体',
      hAnsi: 'SimHei',
    })
  })

  it('should map 宋体 correctly', () => {
    expect(FONT_FAMILY_MAP['宋体']).toEqual({
      ascii: 'SimSun',
      eastAsia: '宋体',
      hAnsi: 'SimSun',
    })
  })

  it('should map 楷体 correctly', () => {
    expect(FONT_FAMILY_MAP['楷体']).toEqual({
      ascii: 'KaiTi',
      eastAsia: '楷体',
      hAnsi: 'KaiTi',
    })
  })

  it('should map 仿宋 correctly', () => {
    expect(FONT_FAMILY_MAP['仿宋']).toEqual({
      ascii: 'FangSong',
      eastAsia: '仿宋',
      hAnsi: 'FangSong',
    })
  })

  it('should map Times New Roman correctly', () => {
    expect(FONT_FAMILY_MAP['Times New Roman']).toEqual({
      ascii: 'Times New Roman',
      eastAsia: 'Times New Roman',
      hAnsi: 'Times New Roman',
    })
  })
})
