import { expect, test } from 'vitest'
import { toCreateBody } from '../../../../frontend/src/backend/content-mappers'

// Protects: a new node keeps its client id and never sends version or deleted_at.
test('[C3] helper-hides-bug: a node create body has the id and no version or trash', () => {
  const body = toCreateBody('nodes', { id: 'abc', projectId: 'p', chapterId: 'c', title: 'T', color: 'red', x: 1, y: 2, deleted: false, version: 0 })
  expect(body).toEqual({ id: 'abc', project: 'p', chapter: 'c', title: 'T', color: 'red', x: 1, y: 2 })
})

// Protects: a trashed record given to create still never sends deleted_at (the rule refuses it).
test('[C3] second-bad-item: a chapter marked deleted sends no deleted_at', () => {
  const body = toCreateBody('chapters', { id: 'c', projectId: 'p', title: 'Two', position: 3, deleted: true, version: 5 })
  expect(body).toEqual({ id: 'c', project: 'p', title: 'Two', position: 3 })
})

// Protects: lines and cues send node and sort_order under their stored names.
test('[C3] two-bad-items: lines and cues map node and sort order', () => {
  expect(toCreateBody('script_lines', { id: 'l', projectId: 'p', nodeId: 'n', character: 'A', text: 'hi', sortOrder: 0, version: 0 }))
    .toEqual({ id: 'l', project: 'p', node: 'n', character: 'A', text: 'hi', sort_order: 0 })
  expect(toCreateBody('cues', { id: 'q', projectId: 'p', nodeId: 'n', type: 'audio', text: 'bang', sortOrder: 2, version: 0 }))
    .toEqual({ id: 'q', project: 'p', node: 'n', type: 'audio', text: 'bang', sort_order: 2 })
})
