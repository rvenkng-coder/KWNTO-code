import { expect, test } from 'vitest'
import type { ProjectFile } from '../../../../frontend/src/backend'
import { parseRoute, routeToHash } from '../../../../frontend/src/features/shell/routes'
import { contentFromFile, permissionLabel, shareUrl, shouldRefresh } from '../../../../frontend/src/features/share/shareModel'

const FILE: ProjectFile = {
  format: 'kwnto-project', version: 1, exportedAt: 'now',
  project: { name: 'Story', startNode: 'n1' },
  chapters: [{ id: 'c1', title: 'One', position: 0 }, { id: 'c2', title: 'Two', position: 1 }],
  nodes: [{ id: 'n1', chapter: 'c1', title: 'Start', color: 'slate', x: 1, y: 2 }, { id: 'n2', chapter: 'c2', title: 'End', color: 'red', x: 3, y: 4 }],
  lines: [{ id: 'l1', node: 'n1', character: 'Mara', text: 'Hi', sortOrder: 0 }],
  cues: [{ id: 'q1', node: 'n1', type: 'audio', text: 'door', sortOrder: 0 }],
  connections: [{ id: 'k1', from: 'n1', to: 'n2', label: 'Go' }, { id: 'k2', from: 'n2', to: null, label: 'Dead end' }],
  media: [],
}
const TOKEN = 'A'.repeat(40)

// Protects: probe of plan row C1, the viewer's content keeps the file's ids and is never editable state.
test('[C1] equivalence: contentFromFile keeps ids, order and links, with version 0 and nothing trashed', () => {
  const c = contentFromFile(FILE, 'p9')
  expect(c.project).toMatchObject({ id: 'p9', name: 'Story', startNodeId: 'n1', deleted: false, version: 0 })
  expect(c.chapters.map((x) => [x.id, x.title, x.position, x.deleted, x.version])).toEqual([['c1', 'One', 0, false, 0], ['c2', 'Two', 1, false, 0]])
  expect(c.nodes.map((x) => [x.id, x.chapterId, x.deleted, x.version])).toEqual([['n1', 'c1', false, 0], ['n2', 'c2', false, 0]])
  expect(c.lines[0]).toMatchObject({ id: 'l1', nodeId: 'n1', character: 'Mara', text: 'Hi' })
  expect(c.connections.map((x) => [x.id, x.fromNodeId, x.toNodeId, x.label])).toEqual([['k1', 'n1', 'n2', 'Go'], ['k2', 'n2', null, 'Dead end']])
})

// Protects: probe of plan row C1, an empty file gives an empty viewer, not a crash.
test('[C1] empty: a file with no chapters or nodes gives empty lists and no start node', () => {
  const c = contentFromFile({ ...FILE, project: { name: 'Empty', startNode: null }, chapters: [], nodes: [], lines: [], cues: [], connections: [] }, 'p1')
  expect([c.chapters, c.nodes, c.lines, c.cues, c.connections].map((l) => l.length)).toEqual([0, 0, 0, 0, 0])
  expect(c.project?.startNodeId).toBeNull()
})

// Protects: probe of plan row C1, the 30 s refresh decision (D9): live, visible and at least 30,000 ms.
test('[C1] boundary: shouldRefresh at 29,999 and 30,000 ms, hidden, snapshot, and a clock that went backwards', () => {
  expect(shouldRefresh('live', true, 1000, 1000 + 29999)).toBe(false)
  expect(shouldRefresh('live', true, 1000, 1000 + 30000)).toBe(true)
  expect(shouldRefresh('live', true, 1000, 1000 + 90000)).toBe(true)
  expect(shouldRefresh('live', false, 0, 999999)).toBe(false)
  expect(shouldRefresh('snapshot', true, 0, 999999)).toBe(false)
  expect(shouldRefresh('live', true, 5000, 1000)).toBe(false)
})

// Protects: probe of plan row C1, exact copy of the dialog labels and the link address.
test('[C1] equivalence: labels for the four kinds and the share address', () => {
  expect(permissionLabel('view', 'live')).toBe('Can view (live)')
  expect(permissionLabel('view', 'snapshot')).toBe('Can view (snapshot)')
  expect(permissionLabel('comment', 'live')).toBe('Can comment')
  expect(permissionLabel('edit', 'live')).toBe('Can edit')
  expect(shareUrl('https://a.test', TOKEN)).toBe(`https://a.test/#/s/${TOKEN}`)
})

// Protects: probe of plan row C1 / Review Focus: a token is exactly 40 letters or digits, nothing else reaches the share screen.
test('[C1] boundary: the share route takes 40 letters or digits only', () => {
  expect(parseRoute(`#/s/${TOKEN}`)).toEqual({ name: 'share', token: TOKEN })
  expect(parseRoute(`#/s/${'a1B2'.repeat(10)}`)).toEqual({ name: 'share', token: 'a1B2'.repeat(10) })
  for (const bad of [TOKEN.slice(1), TOKEN + 'A', `${TOKEN.slice(1)}-`, `${TOKEN.slice(1)}%`, `${TOKEN.slice(2)}%2F`, '', `${TOKEN}/x`]) {
    expect(parseRoute(`#/s/${bad}`).name, bad).toBe('teams')
  }
  expect(routeToHash({ name: 'share', token: TOKEN })).toBe(`#/s/${TOKEN}`)
})
