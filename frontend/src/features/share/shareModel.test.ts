import { expect, test } from 'vitest'
import { contentFromFile, permissionLabel, shareUrl, shouldRefresh } from './shareModel'
import type { ProjectFile } from '../../backend'

const FILE: ProjectFile = {
  format: 'kwnto-project',
  version: 1,
  exportedAt: '2026-11-20 10:00:00.000Z',
  project: { name: 'Story', startNode: 'n1' },
  chapters: [
    { id: 'c1', title: 'One', position: 1 },
    { id: 'c2', title: 'Two', position: 2 },
  ],
  nodes: [{ id: 'n1', chapter: 'c1', title: 'Open', color: 'blue', x: 1, y: 2 }],
  lines: [{ id: 'l1', node: 'n1', character: 'Mara', text: 'Hi', sortOrder: 1 }],
  cues: [{ id: 'q1', node: 'n1', type: 'audio', text: 'rain', sortOrder: 1 }],
  connections: [
    { id: 'k1', from: 'n1', to: null, label: 'Leave' },
    { id: 'k2', from: 'n1', to: 'n1', label: 'Again' },
  ],
  media: [],
}

// Protects: a link is copied as one address, the viewer is built from the file's own ids and shows nothing as trashed,
// a live view refreshes only when it is visible and 30 s old (exactly 30 s counts), and each kind of link has its own
// label.
test("links, refreshes and the viewer's content follow the link's kind", () => {
  expect(shareUrl('https://a', 'T')).toBe('https://a/#/s/T')

  const content = contentFromFile(FILE, 'p1')
  expect(content.project).toMatchObject({ id: 'p1', name: 'Story', startNodeId: 'n1', deleted: false, version: 0 })
  expect(content.chapters.map((c) => [c.id, c.title, c.deleted, c.version])).toEqual([
    ['c1', 'One', false, 0],
    ['c2', 'Two', false, 0],
  ])
  expect(content.nodes[0]).toMatchObject({ id: 'n1', chapterId: 'c1', color: 'blue', deleted: false, projectId: 'p1' })
  expect(content.lines[0]).toMatchObject({ id: 'l1', nodeId: 'n1', character: 'Mara', sortOrder: 1 })
  expect(content.cues[0]).toMatchObject({ id: 'q1', nodeId: 'n1', type: 'audio' })
  expect(content.connections.map((c) => [c.id, c.toNodeId])).toEqual([
    ['k1', null],
    ['k2', 'n1'],
  ])
  const created = content.connections.map((c) => c.created)
  expect([...created].sort()).toEqual(created)

  expect(shouldRefresh('live', true, 0, 29_999)).toBe(false)
  expect(shouldRefresh('live', true, 0, 30_000)).toBe(true)
  expect(shouldRefresh('live', false, 0, 60_000)).toBe(false)
  expect(shouldRefresh('snapshot', true, 0, 60_000)).toBe(false)

  expect([
    permissionLabel('view', 'live'),
    permissionLabel('view', 'snapshot'),
    permissionLabel('comment', 'live'),
    permissionLabel('edit', 'live'),
  ]).toEqual(['Can view (live)', 'Can view (snapshot)', 'Can comment', 'Can edit'])
})
