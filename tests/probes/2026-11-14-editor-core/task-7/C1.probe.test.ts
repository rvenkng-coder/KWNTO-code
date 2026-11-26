import { expect, test } from 'vitest'
import { fromRecord } from '../../../../frontend/src/backend/content-mappers'

// Protects: an empty `deleted_at` (PocketBase sends '') is live, not trashed.
test('[C1] case-and-whitespace: an empty deleted_at is not trashed', () => {
  const chapter = fromRecord('chapters', { id: 'c1', project: 'p1', title: 'One', position: 2, deleted_at: '', version: 3 })
  expect(chapter).toEqual({ id: 'c1', projectId: 'p1', title: 'One', position: 2, deleted: false, deletedAt: null, version: 3 })
})

// Protects: an empty start node is null, a set one is kept; a trashed project is trashed.
test('[C1] empty-one-huge: projects map start_node and deleted_at', () => {
  const live = fromRecord('projects', { id: 'p1', team: 't1', name: 'S', start_node: '', deleted_at: '', version: 0 })
  expect(live.startNodeId).toBeNull()
  expect(live.deleted).toBe(false)
  const set = fromRecord('projects', { id: 'p1', team: 't1', name: 'S', start_node: 'n1', deleted_at: '2026-11-16 10:00:00.000Z', version: 4 })
  expect(set).toEqual({ id: 'p1', teamId: 't1', name: 'S', startNodeId: 'n1', deleted: true, deletedAt: '2026-11-16T10:00:00.000Z', version: 4 })
})

// Protects: the two node references of a connection are not swapped.
test('[C1] two-bad-items: a connection keeps from and to apart', () => {
  const c = fromRecord('connections', { id: 'k', project: 'p', from_node: 'a', to_node: 'b', label: 'go', version: 1 })
  expect(c).toEqual({ id: 'k', projectId: 'p', fromNodeId: 'a', toNodeId: 'b', label: 'go', created: '', version: 1 })
})

// Protects: cues and settings map their own fields; nothing PocketBase-only leaks through.
test('[C1] helper-hides-bug: cues and settings carry only editor fields', () => {
  const cue = fromRecord('cues', { id: 'q', project: 'p', node: 'n', type: 'lighting', text: 'dim', sort_order: 1.5, version: 2, collectionName: 'cues', created: 'x' })
  expect(cue).toEqual({ id: 'q', projectId: 'p', nodeId: 'n', type: 'lighting', text: 'dim', sortOrder: 1.5, version: 2 })
  const s = fromRecord('project_settings', { id: 's', project: 'p', analytics_enabled: true, version: 0 })
  expect(s).toEqual({ id: 's', projectId: 'p', analyticsEnabled: true, version: 0 })
})

// Protects: a node with no title and a trashed node map to editor values.
test('[C1] second-bad-item: node title default and trash flag', () => {
  const n = fromRecord('nodes', { id: 'n', project: 'p', chapter: 'c', color: 'teal', x: -4, y: 9.5, deleted_at: '2026-11-16 10:00:00.000Z', version: 1 })
  expect(n).toEqual({ id: 'n', projectId: 'p', chapterId: 'c', title: '', color: 'teal', x: -4, y: 9.5, width: 0, height: 0, coverMediaId: '', deleted: true, deletedAt: '2026-11-16T10:00:00.000Z', version: 1 })
})
