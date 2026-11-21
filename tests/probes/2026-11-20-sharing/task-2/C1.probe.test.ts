import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { buildProjectFile } = require('../../../../backend/pb_hooks/lib/project-file.js') as {
  buildProjectFile: (records: Record<string, unknown>, nowIso: string) => Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const NOW = '2026-11-20 10:00:00.000Z'
const base = () => ({
  project: { id: 'p1', name: 'Story', start_node: 'n1' },
  chapters: [
    { id: 'c2', title: 'Two', position: 2, deleted_at: '' },
    { id: 'c1', title: 'One', position: 1, deleted_at: '' },
    { id: 'c3', title: 'Gone', position: 3, deleted_at: '2026-11-01 00:00:00.000Z' },
  ],
  nodes: [
    { id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 0, y: 0, deleted_at: '' },
    { id: 'n2', chapter: 'c1', title: 'B', color: 'blue', x: 1, y: 1, deleted_at: '2026-11-01 00:00:00.000Z' },
    { id: 'n3', chapter: 'c3', title: 'C', color: 'slate', x: 2, y: 2, deleted_at: '' },
  ],
  script_lines: [
    { id: 'l2', node: 'n1', character: 'X', text: 'second', sort_order: 2 },
    { id: 'l1', node: 'n1', character: 'X', text: 'first', sort_order: 1 },
  ],
  cues: [],
  connections: [
    { id: 'k1', from_node: 'n1', to_node: 'n2', label: 'to trashed' },
    { id: 'k2', from_node: 'n1', to_node: '', label: 'open' },
  ],
  media: [
    { id: 'm1', node: 'n1', title: 'Pic', kind: 'image', removed_at: '' },
    { id: 'm2', node: 'n1', title: 'Old', kind: 'image', removed_at: '2026-11-02 00:00:00.000Z' },
  ],
})

// Protects: probe of plan row C1, the file holds only live records (design 6.8, 10).
test('[C1] stale-after-change: trashed chapters, their nodes, trashed nodes and removed media are left out', () => {
  const f = buildProjectFile(base(), NOW)
  expect(f.chapters.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2'])
  expect(f.nodes.map((n: { id: string }) => n.id)).toEqual(['n1'])
  expect(f.media.map((m: { id: string }) => m.id)).toEqual(['m1'])
  expect(f.format).toBe('kwnto-project')
  expect(f.version).toBe(1)
  expect(typeof f.exportedAt).toBe('string')
})

// Protects: probe of plan row C1, order and open choices.
test('[C1] boundary: lines come out in sortOrder; a choice to a trashed node becomes open, an open one stays', () => {
  const f = buildProjectFile(base(), NOW)
  expect(f.lines.map((l: { id: string }) => l.id)).toEqual(['l1', 'l2'])
  const byId = Object.fromEntries(f.connections.map((c: { id: string }) => [c.id, c]))
  expect(byId.k1.to).toBeNull()
  expect(byId.k2.to).toBeNull()
  expect(f.connections).toHaveLength(2)
})

// Protects: probe of plan row C1, internal fields never leave the server.
test('[C1] helper-hides-bug: no stored field names leak into the file', () => {
  const text = JSON.stringify(buildProjectFile(base(), NOW))
  for (const leak of ['deleted_at', 'removed_at', 'sort_order', 'from_node', 'to_node', 'start_node']) expect(text).not.toContain(leak)
  expect(buildProjectFile({ ...base(), chapters: [], nodes: [], script_lines: [], cues: [], connections: [], media: [] }, NOW).nodes).toEqual([])
})
