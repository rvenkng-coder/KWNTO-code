import { expect, test } from 'vitest'
import { chapter, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { exportChapters, exportFileName } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: the whole-project export does not depend on which chapter is open, even a missing or stale one.
test('[C1] stale-after-change: the project scope ignores the active chapter', () => {
  const s = fromContent(content({
    chapters: [chapter('a', { position: 1 }), chapter('b', { position: 2 })],
    nodes: [node('x', { chapterId: 'a' }), node('y', { chapterId: 'b' })],
  }))
  for (const active of [null, 'a', 'b', 'gone']) {
    const r = exportChapters(s, 'project', active)
    expect(r.ok && r.chapters.map((c) => c.id)).toEqual(['a', 'b'])
  }
})

// Protects: the whole-project file is named after the project alone, so no chapter title leaks into it.
test('[C1] relative-of-fixed-case: whole-project names have no chapter part, in every format', () => {
  for (const format of ['pdf', 'docx'] as const) expect(exportFileName('Story', null, format)).toBe(`Story.${format}`)
})
