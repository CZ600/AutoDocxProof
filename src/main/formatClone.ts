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
  await applyClone(profile, targetPath, outputPath)
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
      if (styleNameMatches(src.name, dst.name) && dst.type === src.type) {
        const srcParaStyle = src.paragraphStyle || {}
        const srcRunStyle = src.runStyle || {}
        const styleEntry: any = {
          name: dst.name,
          type: src.type,
          basedOn: dst.basedOn,
        }
        if (Object.keys(srcParaStyle).length > 0) styleEntry.paragraphStyle = srcParaStyle
        if (Object.keys(srcRunStyle).length > 0) styleEntry.runStyle = srcRunStyle
        mappedProfile.styles[dstId] = styleEntry
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

  const targetDoc = await loadDocx(targetPath)
  const dstProfile = targetDoc.getStyleProfile()

  const mappedProfile: any = {
    defaults: sanitized.defaults || undefined,
    styles: {}
  }

  // 构建映射后的样式档案，同时记录 styleId -> 格式的映射
  const styleMapByDstId = new Map<string, { paragraphStyle: Record<string, any>; runStyle: Record<string, any> }>()

  for (const [srcId, srcStyle] of Object.entries(sanitized.styles)) {
    for (const [dstId, dstStyle] of Object.entries(dstProfile.styles)) {
      const src = srcStyle as any
      const dst = dstStyle as any
      if (styleNameMatches(src.name, dst.name) && dst.type === src.type) {
        const srcParaStyle = src.paragraphStyle || {}
        const srcRunStyle = src.runStyle || {}

        // 只包含非空属性，避免空对象 {} 在 applyStyleProfile 中覆盖掉目标样式已有的属性
        // （docx-edit 的 updateStyleDefinition 对空对象仍会执行 style.xxxStyle = {}，从而清空原有属性）
        const styleEntry: any = {
          name: dst.name,
          type: src.type,
          basedOn: dst.basedOn,
        }
        if (Object.keys(srcParaStyle).length > 0) styleEntry.paragraphStyle = srcParaStyle
        if (Object.keys(srcRunStyle).length > 0) styleEntry.runStyle = srcRunStyle
        mappedProfile.styles[dstId] = styleEntry

        styleMapByDstId.set(dstId, {
          paragraphStyle: srcParaStyle,
          runStyle: srcRunStyle
        })
        break
      }
    }
  }

  // 1. 应用样式定义（更新 styles.xml 中的命名样式）
  targetDoc.applyStyleProfile(mappedProfile)

  // 2. 在 applyStyleProfile 之后，获取文档默认 runStyle 作为兜底
  const updatedDstProfile = targetDoc.getStyleProfile()
  const docDefaultRunStyle = updatedDstProfile.defaults?.runStyle || {}

  // 3. 使用 resolveEffectiveStyle 解析每个样式的完整有效格式
  const effectiveStyleByDstId = new Map<string, { paragraphStyle: Record<string, any>; runStyle: Record<string, any> }>()
  const matchedDstIds = Array.from(styleMapByDstId.keys())
  for (const dstId of matchedDstIds) {
    try {
      const effective = targetDoc.resolveEffectiveStyle(dstId)
      let effectiveRunStyle = effective.runStyle || {}
      // 兜底：如果有效样式的 runStyle 为空，使用文档默认 runStyle
      if (Object.keys(effectiveRunStyle).length === 0 && Object.keys(docDefaultRunStyle).length > 0) {
        effectiveRunStyle = docDefaultRunStyle
      }
      effectiveStyleByDstId.set(dstId, {
        paragraphStyle: effective.paragraphStyle || {},
        runStyle: effectiveRunStyle
      })
    } catch {
      // 解析失败时回退到 profile 中的原始属性
      const matched = styleMapByDstId.get(dstId)!
      effectiveStyleByDstId.set(dstId, matched)
    }
  }

  // 4. 获取 defaults 中的样式（用于未匹配到样式的段落）
  const defaultsParagraphStyle = sanitized.defaults?.paragraphStyle || {}
  const defaultsRunStyle = sanitized.defaults?.runStyle || {}
  // 兜底：defaults 的 runStyle 为空时也用文档默认
  const effectiveDefaultsRunStyle = Object.keys(defaultsRunStyle).length > 0
    ? defaultsRunStyle
    : docDefaultRunStyle
  const hasDefaultsStyle = Object.keys(defaultsParagraphStyle).length > 0

  // 5. 收集每个段落需应用的格式，然后一次 patch 批量处理所有段落和 run
  // 借鉴 agent 流程：使用 patchStyle 方式逐一应用到每个 run，避免使用 setStyle 可能产生的副作用
  const paraFormatMap = new Map<string, { paragraphStyle: Record<string, any>; runStyle: Record<string, any> }>()

  const body = targetDoc.getBody()
  if (body) {
    const paragraphs = body.getParagraphs()
    for (const para of paragraphs) {
      try {
        let paragraphStyleToApply: Record<string, any> = {}
        let runStyleToApply: Record<string, any> = {}

        const paraStyle = para.getStyle()
        const styleId = paraStyle?.styleId
        if (styleId && effectiveStyleByDstId.has(styleId)) {
          const matched = effectiveStyleByDstId.get(styleId)!
          paragraphStyleToApply = matched.paragraphStyle
          runStyleToApply = matched.runStyle
        } else if (hasDefaultsStyle) {
          paragraphStyleToApply = defaultsParagraphStyle
          runStyleToApply = effectiveDefaultsRunStyle
        }

        if (Object.keys(paragraphStyleToApply).length > 0) {
          paraFormatMap.set((para as any).nodeId, {
            paragraphStyle: paragraphStyleToApply,
            runStyle: runStyleToApply
          })
        }
      } catch {
        // 某些段落可能无法获取样式，跳过
      }
    }
  }

  // 批量应用格式到所有匹配段落：在一个 patch 中修改所有段落的直接格式和 run 的行内格式
  let appliedParagraphs = 0

  if (paraFormatMap.size > 0) {
    // 手动 walk 树找到对应段落和 run 节点，避免逐个控制器调用触发多次 rebuildFromXml
    const walk = (node: any, fn: (n: any) => void) => {
      fn(node)
      if (node.children) {
        for (const child of node.children) {
          walk(child, fn)
        }
      }
    }

    const collectRuns = (node: any, result: any[]) => {
      if (node.type === 'run') {
        result.push(node)
      }
      if (node.children) {
        for (const child of node.children) {
          collectRuns(child, result)
        }
      }
    }

    // 借鉴 agent 流程的 mergeStyleObjects，深合并两个 style 对象
    const deepMerge = (base: Record<string, any>, overlay: Record<string, any>): Record<string, any> => {
      const result = { ...base }
      for (const [key, value] of Object.entries(overlay)) {
        if (value == null) {
          delete result[key]
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = deepMerge(result[key] || {}, value)
          if (Object.keys(result[key]).length === 0) delete result[key]
        } else {
          result[key] = value
        }
      }
      return result
    }

    targetDoc.patchWithMutableTree((nextRoot: any) => {
      walk(nextRoot, (node: any) => {
        if (node.type === 'paragraph' && paraFormatMap.has(node.id)) {
          const { paragraphStyle, runStyle } = paraFormatMap.get(node.id)!
          // 合并且保留 styleId
          const mergedParaStyle = deepMerge(node.props.style || {}, paragraphStyle)
          if (!mergedParaStyle.styleId && node.props.style?.styleId) {
            mergedParaStyle.styleId = node.props.style.styleId
          }
          node.props.style = mergedParaStyle
          appliedParagraphs++

          // 对段落内的所有 run 应用格式
          const runNodes: any[] = []
          collectRuns(node, runNodes)
          if (runNodes.length > 0) {
            if (runStyle && Object.keys(runStyle).length > 0) {
              for (const runNode of runNodes) {
                runNode.props.style = deepMerge(runNode.props.style || {}, runStyle)
              }
            } else {
              for (const runNode of runNodes) {
                runNode.props.style = {}
              }
            }
          }
        }
      })
    })
  }

  await targetDoc.saveAs(outputPath)
  return { appliedParagraphs, matchedStyles: styleMapByDstId.size }
}
