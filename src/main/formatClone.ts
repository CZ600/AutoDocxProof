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
