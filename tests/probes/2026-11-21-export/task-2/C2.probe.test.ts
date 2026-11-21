import { expect, test } from 'vitest'
import { buildPdf } from '../../../../frontend/src/features/editor/export/documents'
import { bytesOf, map } from './helpers'

const textOf = async (b: Blob) => new TextDecoder('latin1').decode(await bytesOf(b))
const pages = (t: string) => t.match(/\/Type \/Page\b(?!s)/g)?.length
const boxes = (t: string) => [...t.matchAll(/\/MediaBox \[0(?:\.0+)? 0(?:\.0+)? ([\d.]+) ([\d.]+)\]/g)].map((m) => Number(m[1]) > Number(m[2]))

// Protects: one map gives exactly one page, not a blank extra first page.
test('[C2] empty-one-huge: one map is one page', async () => {
  const t = await textOf(await buildPdf('Story', [map('Only', 100, 50)]))
  expect(pages(t)).toBe(1)
  expect(boxes(t)).toEqual([true])
})

// Protects: a tall first map turns the first page too, and a square map counts as landscape.
test('[C2] second-bad-item: portrait first, then square, then portrait', async () => {
  const t = await textOf(await buildPdf('Story', [map('A', 10, 20), map('B', 500, 500), map('C', 1, 9)]))
  expect(pages(t)).toBe(3)
  expect(boxes(t)).toEqual([false, true, false])
})

// Protects: many chapters give many pages, in order.
test('[C2] empty-one-huge: thirty chapters', async () => {
  const maps = Array.from({ length: 30 }, (_, i) => map(`Chapter ${i + 1}`, 900, 600))
  const t = await textOf(await buildPdf('Story', maps))
  expect(pages(t)).toBe(30)
  expect(t.indexOf('(Story - Chapter 2)')).toBeLessThan(t.indexOf('(Story - Chapter 10)'))
})
