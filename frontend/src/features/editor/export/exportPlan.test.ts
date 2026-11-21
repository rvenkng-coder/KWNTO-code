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
  // A part is cut at 100 characters or 120 UTF-8 bytes, whichever comes first, on a whole character.
  expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(120)
  expect(name.endsWith('🎭') || name.endsWith('é')).toBe(true)
  expect(name).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(Array.from(exportFileName('x'.repeat(300), null, 'png'))).toHaveLength(104)
})

// Protects: a name never ends or starts with a space or dot (browsers and Windows rewrite those), even after the cut, and a reserved Windows device name is not used bare.
test('file names have no stray edges and no reserved names', () => {
  expect(exportFileName('Act 1 .', null, 'pdf')).toBe('Act 1.pdf')
  expect(exportFileName('Story', ' . x .. ', 'png')).toBe('Story - x.png')
  expect(exportFileName('a'.repeat(99) + ' b', null, 'png')).toBe(`${'a'.repeat(99)}.png`)
  expect(exportFileName('CON', null, 'pdf')).toBe('_CON.pdf')
  expect(exportFileName('nul', null, 'docx')).toBe('_nul.docx')
  expect(exportFileName('Console', null, 'pdf')).toBe('Console.pdf')
})

// Protects: a whole-project export tells how many empty chapters it left out, so a short file is not a surprise.
test('the export counts the chapters it skipped', () => {
  const s = fromContent(content({
    chapters: [chapter('A', { position: 1 }), chapter('B', { position: 2 }), chapter('C', { position: 3 }), chapter('D', { position: 4, deleted: true })],
    nodes: [node('a1', { chapterId: 'A' })],
  }))
  const skipped = (r: ReturnType<typeof exportChapters>) => (r.ok ? r.skipped : -1)
  expect(skipped(exportChapters(s, 'project', 'A'))).toBe(2)
  expect(skipped(exportChapters(s, 'chapter', 'A'))).toBe(0)
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
