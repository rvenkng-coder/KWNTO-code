import { expect, test } from 'vitest'
import { zipEntryText } from '../../../helpers/zip-entry'
import { buildDocx } from '../../../../frontend/src/features/editor/export/documents'
import { bytesOf, map } from './helpers'

const docXml = async (title: string, n = 1) =>
  zipEntryText(await bytesOf(await buildDocx(title, Array.from({ length: n }, (_, i) => map(`C${i + 1}`, 1000, 2000)))), 'word/document.xml')

// Protects: a single chapter has no page break before it, so no blank first page.
test('[C3] empty-one-huge: one chapter has no page break', async () => {
  const xml = await docXml('Story')
  expect(xml).not.toContain('pageBreakBefore')
  expect(xml.match(/<pic:pic/g)).toHaveLength(1)
})

// Protects: characters that are special in XML survive in a project name.
test('[C3] case-and-whitespace: ampersand and angle brackets in the name', async () => {
  const xml = await docXml('Tom & <Jerry> "x"')
  expect(xml).toContain('Tom &amp; &lt;Jerry&gt;')
})

// Protects: ten chapters give ten pictures and nine breaks.
test('[C3] empty-one-huge: ten chapters', async () => {
  const xml = await docXml('Story', 10)
  expect(xml.match(/<pic:pic/g)).toHaveLength(10)
  expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(9)
})
