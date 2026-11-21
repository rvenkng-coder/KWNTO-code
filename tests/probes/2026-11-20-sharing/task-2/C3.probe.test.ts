import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { importPlan } = require('../../../../backend/pb_hooks/lib/project-file.js') as {
  importPlan: (file: unknown, newId: () => string) => Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
const file = {
  format: 'kwnto-project', version: 1, exportedAt: 'x',
  project: { name: 'Story', startNode: 'old-n2' },
  chapters: [{ id: 'old-c1', title: 'One', position: 1 }, { id: 'old-c2', title: 'Two', position: 2 }],
  nodes: [
    { id: 'old-n1', chapter: 'old-c1', title: 'A', color: 'slate', x: 0, y: 0 },
    { id: 'old-n2', chapter: 'old-c2', title: 'B', color: 'blue', x: 1, y: 1 },
  ],
  lines: [{ id: 'old-l1', node: 'old-n2', character: 'X', text: 'hi', sortOrder: 1 }],
  cues: [{ id: 'old-q1', node: 'old-n1', type: 'audio', text: 'boom', sortOrder: 1 }],
  connections: [
    { id: 'old-k1', from: 'old-n1', to: 'old-n2', label: 'go' },
    { id: 'old-k2', from: 'old-n2', to: null, label: '' },
  ],
  media: [{ id: 'old-m1', node: 'old-n1', title: 'Pic', kind: 'image' }],
}

// Protects: probe of plan row C3, a file cannot choose the ids of new records.
test('[C3] stale-after-change: no old id survives anywhere in the plan and ids are unique', () => {
  let i = 0
  const plan = importPlan(structuredClone(file), () => `n${++i}`)
  const text = JSON.stringify(plan)
  expect(text).not.toContain('old-')
  const ids: string[] = [...plan.chapters, ...plan.nodes, ...plan.lines, ...plan.cues, ...plan.connections].map((r: { id: string }) => r.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(plan.chapters).toHaveLength(2)
  expect(plan.nodes).toHaveLength(2)
})

// Protects: probe of plan row C3, references follow the new ids.
test('[C3] helper-hides-bug: the start node is the new id of the second node and an open choice stays open', () => {
  let i = 0
  const plan = importPlan(structuredClone(file), () => `n${++i}`)
  const second = plan.nodes.find((n: { title: string }) => n.title === 'B')
  expect(plan.startNode).toBe(second.id)
  const open = plan.connections.find((c: { label: string }) => c.label === '')
  expect(JSON.stringify(open)).not.toMatch(/old-|"n\d+"[^,]*"n\d+"[^,]*"n\d+"/)
  expect(plan.name).toBe('Story')
  const firstConn = plan.connections.find((c: { label: string }) => c.label === 'go')
  expect(Object.values(firstConn)).toContain(second.id)
})

// Protects: probe of plan row C3, a file without a start node.
test('[C3] empty-one-huge: no start node gives null and no records give empty lists', () => {
  const empty = { ...structuredClone(file), project: { name: 'E', startNode: null }, nodes: [], lines: [], cues: [], connections: [], media: [] }
  const plan = importPlan(empty, () => 'x' + Math.random().toString(36).slice(2, 10))
  expect(plan.startNode).toBeNull()
  expect(plan.nodes).toEqual([])
  expect(plan.connections).toEqual([])
})
