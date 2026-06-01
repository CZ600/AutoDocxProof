import { describe, it, expect } from 'vitest'
import { STYLE_NAME_ALIASES, styleNameMatches } from '../src/shared/styleAliases'

describe('STYLE_NAME_ALIASES', () => {
  it('should have valid structure', () => {
    expect(STYLE_NAME_ALIASES).toBeInstanceOf(Object)
    expect(Object.keys(STYLE_NAME_ALIASES).length).toBeGreaterThan(0)
  })
})

describe('styleNameMatches', () => {
  it('should match exact same strings', () => {
    expect(styleNameMatches('Heading 1', 'Heading 1')).toBe(true)
    expect(styleNameMatches('normal', 'normal')).toBe(true)
    expect(styleNameMatches('TOC 1', 'TOC 1')).toBe(true)
  })

  it('should match case-insensitively', () => {
    expect(styleNameMatches('heading 1', 'Heading 1')).toBe(true)
    expect(styleNameMatches('NORMAL', 'normal')).toBe(true)
    expect(styleNameMatches('toc 1', 'TOC 1')).toBe(true)
  })

  it('should match via alias table', () => {
    // Chinese alias matches canonical name
    expect(styleNameMatches('标题 1', 'heading 1')).toBe(true)
    expect(styleNameMatches('正文', 'normal')).toBe(true)
    expect(styleNameMatches('页眉', 'header')).toBe(true)
    // Two Chinese aliases match each other
    expect(styleNameMatches('标题 1', '标题1')).toBe(true)
    expect(styleNameMatches('目录 1', '目录1')).toBe(true)
    // English alias matches canonical name
    expect(styleNameMatches('Heading 1', 'heading 1')).toBe(true)
  })

  it('should not match unrelated names', () => {
    expect(styleNameMatches('heading 1', 'heading 2')).toBe(false)
    expect(styleNameMatches('normal', 'title')).toBe(false)
    expect(styleNameMatches('header', 'footer')).toBe(false)
    expect(styleNameMatches('heading 1', 'normal')).toBe(false)
  })
})
