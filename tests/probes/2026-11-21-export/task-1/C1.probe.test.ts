import { expect, test } from 'vitest'
import { chapter, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { exportChapters } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: an active chapter id that no longer exists is refused, not exported or crashed on.
test('[C1] stale-after-change: the active chapter was removed', () => {
  const s = fromContent(content({ chapters: [chapter('c1')], nodes: [node('n1')] }))
  expect(exportChapters(s, 'chapter', 'gone')).toEqual({ ok: false, message: 'This chapter has no nodes to export.' })
})

// Protects: the only chapter with nodes is trashed, so the project export is refused.
test('[C1] empty-one-huge: nodes only in a trashed chapter', () => {
  const s = fromContent(content({
    chapters: [chapter('c1', { deleted: true }), chapter('c2')],
    nodes: [node('n1', { chapterId: 'c1' })],
  }))
  expect(exportChapters(s, 'project', 'c2')).toEqual({ ok: false, message: 'This project has no nodes to export.' })
  expect(exportChapters(s, 'chapter', 'c1')).toEqual({ ok: false, message: 'This chapter has no nodes to export.' })
})

// Protects: tab order is by position, not by creation or id order, and a trashed node beside a live one does not drop the chapter.
test('[C1] second-bad-item: chapters come back in tab order', () => {
  const s = fromContent(content({
    chapters: [chapter('a', { position: 3 }), chapter('b', { position: 1 }), chapter('c', { position: 2 })],
    nodes: [node('x', { chapterId: 'a' }), node('y', { chapterId: 'b', deleted: true }), node('y2', { chapterId: 'b' }), node('z', { chapterId: 'c' })],
  }))
  const r = exportChapters(s, 'project', null)
  expect(r.ok && r.chapters.map((c) => c.id)).toEqual(['b', 'c', 'a'])
})
