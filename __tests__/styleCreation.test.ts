import { describe, it, expect, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { loadDocx } from 'docx-edit'

describe('applyStyleProfile creates new styles', () => {
  const FIXTURE = path.resolve(__dirname, 'fixtures', 'minimal.docx')
  const TEMP_OUTPUT = path.join(os.tmpdir(), `style-creation-test-${Date.now()}.docx`)

  afterAll(() => {
    if (fs.existsSync(TEMP_OUTPUT)) {
      fs.unlinkSync(TEMP_OUTPUT)
    }
  })

  it('should create a new style with novel styleId', async () => {
    const doc = await loadDocx(FIXTURE)

    // Verify style doesn't exist before
    const beforeProfile = doc.getStyleProfile()
    expect(beforeProfile.styles['abstractTitle']).toBeUndefined()

    // Apply a completely novel style (styleId that doesn't exist in the document)
    doc.applyStyleProfile({
      styles: {
        'abstractTitle': {
          name: 'Abstract Title',
          type: 'paragraph',
          basedOn: 'Normal',
          runStyle: {
            fontSize: '36',
            fontFamily: {
              ascii: 'SimHei',
              eastAsia: '黑体',
              hAnsi: 'SimHei',
            },
            bold: true,
          },
          paragraphStyle: {
            alignment: 'center',
            spacing: { before: 120, after: 120 },
          },
        },
      },
    })

    // Save to temp file
    await doc.saveAs(TEMP_OUTPUT)

    // Reload from saved file
    const reloaded = await loadDocx(TEMP_OUTPUT)
    const afterProfile = reloaded.getStyleProfile()

    // Verify the new style exists and properties are correct
    expect(afterProfile.styles['abstractTitle']).toBeDefined()
    expect(afterProfile.styles['abstractTitle'].name).toBe('Abstract Title')
    expect(afterProfile.styles['abstractTitle'].type).toBe('paragraph')
    expect(afterProfile.styles['abstractTitle'].runStyle.fontSize).toBe('36')
    expect(afterProfile.styles['abstractTitle'].runStyle.bold).toBe(true)
    expect(afterProfile.styles['abstractTitle'].runStyle.fontFamily).toBeDefined()
    expect(afterProfile.styles['abstractTitle'].paragraphStyle.alignment).toBe('center')
  })
})
