const { loadDocx } = require('docx-edit')
import { STYLE_NAME_ALIASES, styleNameMatches } from '../shared/styleAliases'

export async function extractFormatProfile(filePath: string): Promise<any> {
  const doc = await loadDocx(filePath)
  return doc.getStyleProfile()
}

export async function cloneFormat(
  sourcePath: string,
  targetPath: string,
  outputPath: string
): Promise<void> {
  const sourceDoc = await loadDocx(sourcePath)
  const sourceProfile = sourceDoc.getStyleProfile()
  await applyClone(sourceProfile, targetPath, outputPath)
}

export async function cloneFormatWithProfile(
  profile: any,
  targetPath: string,
  outputPath: string
): Promise<void> {
  const sanitized = {
    defaults: profile.defaults || {},
    styles: profile.styles || {}
  }
  // 确保每个 style 有 paragraphStyle 和 runStyle
  for (const [id, style] of Object.entries(sanitized.styles)) {
    const s = style as any
    if (!s.paragraphStyle) s.paragraphStyle = {}
    if (!s.runStyle) s.runStyle = {}
  }
  await applyClone(sanitized, targetPath, outputPath)
}

async function applyClone(
  srcProfile: any,
  targetPath: string,
  outputPath: string
): Promise<void> {
  const targetDoc = await loadDocx(targetPath)
  const dstProfile = targetDoc.getStyleProfile()

  const mappedProfile: any = {
    defaults: srcProfile.defaults || undefined,
    styles: {}
  }

  for (const [srcId, srcStyle] of Object.entries(srcProfile.styles)) {
    for (const [dstId, dstStyle] of Object.entries(dstProfile.styles)) {
      const src = srcStyle as any
      const dst = dstStyle as any
      // 使用模糊名称匹配：支持精确/忽略大小写/去空格/别名表
      if (styleNameMatches(src.name, dst.name) && dst.type === src.type) {
        mappedProfile.styles[dstId] = {
          name: dst.name,
          type: src.type,
          basedOn: dst.basedOn,
          paragraphStyle: src.paragraphStyle || {},
          runStyle: src.runStyle || {}
        }
        break
      }
    }
  }

  targetDoc.applyStyleProfile(mappedProfile)
  await targetDoc.saveAs(outputPath)
}

/**
 * 强制克隆格式：除了应用样式定义外，还强制将段落格式应用到每个段落的直接格式。
 * 用于覆盖段落上已有的行内格式（如手动设置的缩进、间距等）。
 */
export async function cloneFormatWithProfileForce(
  profile: any,
  targetPath: string,
  outputPath: string
): Promise<{ appliedParagraphs: number; matchedStyles: number }> {
  const sanitized = {
    defaults: profile.defaults || {},
    styles: profile.styles || {}
  }
  // 确保每个 style 有 paragraphStyle 和 runStyle
  for (const [id, style] of Object.entries(sanitized.styles)) {
    const s = style as any
    if (!s.paragraphStyle) s.paragraphStyle = {}
    if (!s.runStyle) s.runStyle = {}
  }

  const targetDoc = await loadDocx(targetPath)
  const dstProfile = targetDoc.getStyleProfile()

  const mappedProfile: any = {
    defaults: sanitized.defaults || undefined,
    styles: {}
  }

  // 构建映射后的样式档案，同时记录 styleId -> paragraphStyle 的映射
  const styleMapByDstId = new Map<string, { paragraphStyle: Record<string, any>; runStyle: Record<string, any> }>()

  for (const [srcId, srcStyle] of Object.entries(sanitized.styles)) {
    for (const [dstId, dstStyle] of Object.entries(dstProfile.styles)) {
      const src = srcStyle as any
      const dst = dstStyle as any
      if (styleNameMatches(src.name, dst.name) && dst.type === src.type) {
        mappedProfile.styles[dstId] = {
          name: dst.name,
          type: src.type,
          basedOn: dst.basedOn,
          paragraphStyle: src.paragraphStyle || {},
          runStyle: src.runStyle || {}
        }
        styleMapByDstId.set(dstId, {
          paragraphStyle: src.paragraphStyle || {},
          runStyle: src.runStyle || {}
        })
        break
      }
    }
  }

  // 1. 应用样式定义（更新 styles.xml 中的命名样式）
  targetDoc.applyStyleProfile(mappedProfile)

  // 2. 在 applyStyleProfile 之后，使用 resolveEffectiveStyle 解析每个样式的完整有效格式
  // resolveEffectiveStyle 会合并 docDefaults → basedOn 继承链 → 样式自身属性
  // 这确保了继承自父样式或 docDefaults 的属性（如首行缩进）也被包含在内
  const effectiveStyleByDstId = new Map<string, { paragraphStyle: Record<string, any>; runStyle: Record<string, any> }>()
  const matchedDstIds = Array.from(styleMapByDstId.keys())
  for (const dstId of matchedDstIds) {
    try {
      const effective = targetDoc.resolveEffectiveStyle(dstId)
      effectiveStyleByDstId.set(dstId, {
        paragraphStyle: effective.paragraphStyle || {},
        runStyle: effective.runStyle || {}
      })
    } catch {
      // 解析失败时回退到 profile 中的原始属性
      const matched = styleMapByDstId.get(dstId)!
      effectiveStyleByDstId.set(dstId, matched)
    }
  }

  // 3. 获取 defaults 中的样式（用于未匹配到样式的段落）
  const defaultsParagraphStyle = sanitized.defaults?.paragraphStyle || {}
  const defaultsRunStyle = sanitized.defaults?.runStyle || {}
  const hasDefaultsStyle = Object.keys(defaultsParagraphStyle).length > 0 || Object.keys(defaultsRunStyle).length > 0

  // 4. 强制应用段落格式到每个段落的直接格式
  let appliedParagraphs = 0
  const body = targetDoc.getBody()
  if (body) {
    const paragraphs = body.getParagraphs()
    for (const para of paragraphs) {
      try {
        let paragraphStyleToApply: Record<string, any> = {}
        let runStyleToApply: Record<string, any> = {}

        // 尝试根据 styleId 匹配样式
        const paraStyle = para.getStyle()
        const styleId = paraStyle?.styleId
        if (styleId && effectiveStyleByDstId.has(styleId)) {
          // 使用 resolveEffectiveStyle 解析后的完整有效格式（含继承属性）
          const matched = effectiveStyleByDstId.get(styleId)!
          paragraphStyleToApply = matched.paragraphStyle
          runStyleToApply = matched.runStyle
        } else if (hasDefaultsStyle) {
          // 未找到匹配的样式，使用 defaults 中的格式
          paragraphStyleToApply = defaultsParagraphStyle
          runStyleToApply = defaultsRunStyle
        }

        // 强制覆盖段落格式：完全替换直接格式，而非合并
        if (Object.keys(paragraphStyleToApply).length > 0) {
          const currentStyle = para.getStyle()
          // 保留段落的 styleId（样式引用），其余格式全部用有效样式替换
          para.setStyle({
            styleId: currentStyle?.styleId,
            ...paragraphStyleToApply
          })
          appliedParagraphs++
        }

        // 强制覆盖 run 格式：完全替换直接格式，而非合并
        // 这能覆盖段内特殊字体、字号等行内格式
        if (Object.keys(runStyleToApply).length > 0) {
          const runs = para.getRuns()
          if (runs && runs.length > 0) {
            for (const run of runs) {
              run.setStyle(runStyleToApply)
            }
          }
        }
      } catch {
        // 某些段落可能无法获取样式，跳过
      }
    }
  }

  await targetDoc.saveAs(outputPath)
  return { appliedParagraphs, matchedStyles: styleMapByDstId.size }
}
