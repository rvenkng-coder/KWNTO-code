import { expect, test } from 'vitest'
import { exportFileName } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: no file name holds a path or reserved character, however the names are typed.
test('[C2] case-and-whitespace: every awkward name gives a safe, non-empty file name', () => {
  const names = ['a/b\\c', 'x:y*z?"<>|', '...', '.', '  ', '\r\n', '\u0000\u0007', 'Ünï Çödé', '../../etc/passwd', 'dot.', ' lead and trail ']
  for (const project of names) {
    for (const chapter of [null, ...names]) {
      for (const format of ['pdf', 'docx', 'jpg', 'png'] as const) {
        const file = exportFileName(project, chapter, format)
        expect(file.endsWith(`.${format}`)).toBe(true)
        const stem = file.slice(0, -format.length - 1)
        expect(stem).not.toMatch(/[\\/:*?"<>|]/)
        expect(Array.from(stem).every((ch) => (ch.codePointAt(0) ?? 0) >= 32)).toBe(true)
        expect(stem.trim()).toBe(stem)
        expect(stem.startsWith('.')).toBe(false)
        expect(stem.length).toBeGreaterThan(0)
      }
    }
  }
})

// Protects: a long chapter name is cut on its own, so the project part survives.
test('[C2] empty-one-huge: a 300-character chapter keeps the project part whole', () => {
  const file = exportFileName('Story', 'x'.repeat(300), 'pdf')
  expect(file.startsWith('Story - ')).toBe(true)
  expect(file).toBe(`Story - ${'x'.repeat(100)}.pdf`)
})

// Protects: a one-character name is kept as it is.
test('[C2] empty-one-huge: one character', () => {
  expect(exportFileName('A', 'B', 'png')).toBe('A - B.png')
})
