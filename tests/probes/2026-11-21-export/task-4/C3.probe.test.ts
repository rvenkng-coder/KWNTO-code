import { expect, test } from 'vitest'
import { chapter, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { exportChapters } from '../../../../frontend/src/features/editor/export/exportPlan'

// Protects: a chapter whose every node is trashed, or whose own chapter is trashed, never reaches the export, and the last live one still does.
test('[C3] two-bad-items: a trashed chapter and a chapter of trashed nodes are both skipped', () => {
  const s = fromContent(content({
    chapters: [chapter('a', { position: 1 }), chapter('b', { position: 2 }), chapter('c', { position: 3, deleted: true }), chapter('d', { position: 4 })],
    nodes: [node('a1', { chapterId: 'a', deleted: true }), node('b1', { chapterId: 'b' }), node('c1', { chapterId: 'c' }), node('d1', { chapterId: 'd', deleted: true }), node('d2', { chapterId: 'd' })],
  }))
  const r = exportChapters(s, 'project', 'a')
  expect(r.ok && r.chapters.map((c) => c.id)).toEqual(['b', 'd'])
})
