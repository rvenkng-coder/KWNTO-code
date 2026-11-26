import { expect, test } from 'vitest'
import { zipEntryText } from '../../../../../tests/helpers/zip-entry'
import { buildDocx, buildPdf, dataUrlBytes } from './documents'
import type { MapImage } from './exportPlan'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const map = (chapterTitle: string, width: number, height: number): MapImage => ({
  chapterTitle,
  dataUrl: PNG,
  width,
  height,
  small: false,
})
const THREE = [map('Chapter 1', 2000, 1000), map('Chapter 2', 800, 1600), map('Chapter 3', 1200, 900)]
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

// Protects: only real base64 data URLs are decoded; a remote URL or plain data URL is never fetched or guessed at.
test('data URLs become bytes and anything else is refused', () => {
  expect(Array.from(dataUrlBytes(PNG).slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  expect(() => dataUrlBytes('https://x.example/a.png')).toThrow('Not a data URL')
  expect(() => dataUrlBytes('data:image/png,abc')).toThrow('Not a data URL')
})

// Protects: each chapter gets its own page, with its heading, turned to fit its map.
test('the PDF has one page per chapter with its heading and orientation', async () => {
  const blob = await buildPdf('Story', THREE)
  expect(blob.type).toBe('application/pdf')
  const text = new TextDecoder('latin1').decode(await bytesOf(blob))
  expect(text.startsWith('%PDF-')).toBe(true)
  expect(text.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(3)
  const boxes = [...text.matchAll(/\/MediaBox \[0(?:\.0+)? 0(?:\.0+)? ([\d.]+) ([\d.]+)\]/g)].map(
    (m) => Number(m[1]) > Number(m[2]),
  )
  expect(boxes).toEqual([true, false, true])
  for (const n of [1, 2, 3]) expect(text).toContain(`(Story - Chapter ${n})`)
})

// Protects: the Word file is landscape and holds a heading and a picture per chapter, each chapter on a new page.
test('the Word file has a heading and an image per chapter on landscape pages', async () => {
  const blob = await buildDocx('Story', THREE)
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const bytes = await bytesOf(blob)
  expect(String.fromCharCode(...bytes.slice(0, 2))).toBe('PK')
  const xml = zipEntryText(bytes, 'word/document.xml')
  expect(xml).toContain('w:orient="landscape"')
  for (const n of [1, 2, 3]) expect(xml).toContain(`Story - Chapter ${n}`)
  expect(xml.match(/<pic:pic/g)).toHaveLength(3)
  expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(2)
})

// Protects: no empty file is ever produced.
test('an empty list is refused', async () => {
  await expect(buildPdf('Story', [])).rejects.toThrow('Nothing to export.')
  await expect(buildDocx('Story', [])).rejects.toThrow('Nothing to export.')
})

// Protects: a chapter with no title gets the same "Untitled" in its page heading as in its file name.
test('an untitled chapter is headed Untitled in both formats', async () => {
  const untitled = [map('  ', 800, 600)]
  expect(new TextDecoder('latin1').decode(await bytesOf(await buildPdf('Story', untitled)))).toContain(
    '(Story - Untitled)',
  )
  expect(zipEntryText(await bytesOf(await buildDocx('Story', untitled)), 'word/document.xml')).toContain(
    'Story - Untitled',
  )
})
