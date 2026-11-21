import { expect, test } from 'vitest'
import { chapter, content, node } from '../model/fixtures'
import { fromContent } from '../model/state'
import { exportChapters, exportFileName, exportPixelRatio, fitInto, isSmallText, scopesFor } from './exportPlan'

// Protects: an export never includes empty or trashed chapters, and an empty export is refused, not downloaded blank.
test('the chapters to export skip empty and trashed chapters', () => {
  const s = fromContent(content({
    chapters: [
      chapter('A', { position: 1 }), chapter('B', { position: 2 }), chapter('C', { position: 3 }),
      chapter('D', { position: 4, deleted: true }),
    ],
    nodes: [
      node('a1', { chapterId: 'A' }), node('a2', { chapterId: 'A' }),
      node('c1', { chapterId: 'C' }), node('c2', { chapterId: 'C', deleted: true }),
      node('d1', { chapterId: 'D' }),
    ],
  }))
  const ids = (r: ReturnType<typeof exportChapters>) => (r.ok ? r.chapters.map((c) => c.id) : r)
  expect(ids(exportChapters(s, 'chapter', 'A'))).toEqual(['A'])
  expect(exportChapters(s, 'chapter', 'B')).toEqual({ ok: false, message: 'This chapter has no nodes to export.' })
  expect(ids(exportChapters(s, 'project', 'A'))).toEqual(['A', 'C'])
  const onlyTrashed = fromContent(content({ nodes: [node('x', { deleted: true })] }))
  expect(exportChapters(onlyTrashed, 'project', null)).toEqual({ ok: false, message: 'This project has no nodes to export.' })
  expect(exportChapters(s, 'chapter', null)).toEqual({ ok: false, message: 'This chapter has no nodes to export.' })
})

// Protects: whatever a person names a project or chapter, the downloaded file name is safe and never empty.
test('file names are cleaned', () => {
  expect(exportFileName('Story', 'Chapter 1', 'png')).toBe('Story - Chapter 1.png')
  expect(exportFileName('My/Story', 'Ch: "1"', 'pdf')).toBe('My-Story - Ch- -1-.pdf')
  expect(exportFileName('  ', null, 'docx')).toBe('KWNTO map.docx')
  expect(exportFileName('Story', '   ', 'jpg')).toBe('Story - Untitled.jpg')
  expect(exportFileName('..Story..', null, 'pdf')).toBe('Story.pdf')
  expect(exportFileName('Tab\tand\nline', null, 'png')).toBe('Tab and line.png')
  const long = exportFileName('é🎭'.repeat(150), null, 'png')
  const name = long.slice(0, -'.png'.length)
  expect(Array.from(name)).toHaveLength(100)
  expect(name.endsWith('🎭') || name.endsWith('é')).toBe(true)
  expect(name).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
})

// Protects: a huge map is scaled so the image stays inside the browser canvas limits (a bigger canvas comes out blank).
test('the pixel ratio keeps the image inside the canvas limits', () => {
  expect(exportPixelRatio(800, 600)).toBe(2)
  expect(exportPixelRatio(8192, 100)).toBe(1)
  const wide = exportPixelRatio(100000, 500)
  expect(wide).toBeCloseTo(0.08192, 5)
  expect(100000 * wide).toBeLessThanOrEqual(8192)
  const square = exportPixelRatio(6000, 6000)
  expect(square).toBeLessThan(1)
  expect((6000 * square) ** 2).toBeLessThanOrEqual(32_000_001)
  expect(exportPixelRatio(0, 0)).toBe(2)
  expect(isSmallText(0.49)).toBe(true)
  expect(isSmallText(0.5)).toBe(false)
})

// Protects: images export one chapter only; PDF and Word may export the whole project; fitting keeps the aspect.
test('scopes per format and fitting into a box', () => {
  expect(scopesFor('pdf')).toEqual(['chapter', 'project'])
  expect(scopesFor('docx')).toEqual(['chapter', 'project'])
  expect(scopesFor('jpg')).toEqual(['chapter'])
  expect(scopesFor('png')).toEqual(['chapter'])
  expect(fitInto(2000, 1000, { width: 500, height: 500 })).toEqual({ width: 500, height: 250 })
  expect(fitInto(100, 400, { width: 500, height: 500 })).toEqual({ width: 125, height: 500 })
})
