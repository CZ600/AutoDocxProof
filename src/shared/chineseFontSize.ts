/**
 * Chinese font size mapping (中文字号 → half-points)
 * and font family mapping for docx-edit.
 *
 * docx-edit uses half-points for fontSize (e.g. 四号 = 14pt = 28 half-points).
 * Reference: src/main/formatFromDesc.ts:130-136
 */

/** Map Chinese font size names to half-point strings (docx-edit format). */
export const CHINESE_FONT_SIZE_MAP: Record<string, string> = {
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

/**
 * Resolve a font size input to a half-point string.
 *
 * Accepts:
 * - Chinese name with "号" suffix: "小四号" → "24"
 * - Chinese name without suffix: "小四" → "24"
 * - Point value string: "14pt" → "28"
 * - Already half-points: "28" → "28"
 * - Unknown input: returned unchanged
 */
export function resolveFontSize(input: string): string {
  // Chinese name with "号" suffix
  if (input.endsWith('号') && input.length > 1) {
    // Try with full name first (e.g. "小四号" → strip "号" → "小四")
    const name = input.slice(0, -1)
    if (CHINESE_FONT_SIZE_MAP[name]) {
      return CHINESE_FONT_SIZE_MAP[name]
    }
  }

  // Chinese name without suffix, or full name (e.g. "小四", "四号")
  if (CHINESE_FONT_SIZE_MAP[input]) {
    return CHINESE_FONT_SIZE_MAP[input]
  }

  // Point value (e.g. "14pt", "14Pt", "14PT")
  const ptMatch = input.match(/^(\d+(?:\.\d+)?)\s*pt$/i)
  if (ptMatch) {
    const halfPoints = Math.round(parseFloat(ptMatch[1]) * 2)
    return String(halfPoints)
  }

  // Already a half-point number string (e.g. "28")
  if (/^\d+$/.test(input)) {
    return input
  }

  // Unknown – return as-is
  return input
}

/**
 * Font family map for docx-edit.
 * Each entry provides ascii, eastAsia, and hAnsi values.
 */
export const FONT_FAMILY_MAP: Record<string, { ascii: string; eastAsia: string; hAnsi: string }> = {
  '黑体': { ascii: 'SimHei', eastAsia: '黑体', hAnsi: 'SimHei' },
  '宋体': { ascii: 'SimSun', eastAsia: '宋体', hAnsi: 'SimSun' },
  '楷体': { ascii: 'KaiTi', eastAsia: '楷体', hAnsi: 'KaiTi' },
  '仿宋': { ascii: 'FangSong', eastAsia: '仿宋', hAnsi: 'FangSong' },
  'Times New Roman': { ascii: 'Times New Roman', eastAsia: 'Times New Roman', hAnsi: 'Times New Roman' },
}
