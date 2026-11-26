import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
type Json = Record<string, unknown>
const { buildProjectFile } = require('../../../../backend/pb_hooks/lib/project-file.js') as { buildProjectFile: (records: Json, nowIso: string) => Json }

function build(connections: Json[], nodes: Json[] = [{ id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 0, y: 0, deleted_at: '' }]) {
  const file = buildProjectFile({
    project: { id: 'p1', name: 'P', start_node: 'n1' },
    chapters: [{ id: 'c1', title: 'One', position: 1, deleted_at: '' }],
    nodes, script_lines: [], cues: [], media: [], connections,
  }, '2026-11-26 10:00:00.000Z')
  return file.connections as { id: string; label: string; to: string | null }[]
}
const k = (id: string, created: string, extra: Json = {}): Json => ({ id, from_node: 'n1', to_node: '', label: id, created, ...extra })

// Protects: the same creation time falls back to id order, so the file is the same every time it is built.
test('[C8] relative-of-fixed-case: equal creation times are ordered by id', () => {
  const t = '2026-11-26 10:00:00.000Z'
  expect(build([k('c', t), k('a', t), k('b', t)]).map((c) => c.id)).toEqual(['a', 'b', 'c'])
})

// Protects: records with no creation time at all (an older caller) still give a stable id order and do not throw.
test('[C8] empty-one-huge: no connections, and connections without a creation time', () => {
  expect(build([])).toEqual([])
  const bare = [{ id: 'b', from_node: 'n1', to_node: '', label: 'b' }, { id: 'a', from_node: 'n1', to_node: '', label: 'a' }]
  expect(build(bare).map((c) => c.id)).toEqual(['a', 'b'])
})

// Protects: an unlinked choice made later is listed after a linked one, a choice to a trashed node keeps its place with `to: null`, and one from a trashed node is left out.
test('[C8] second-bad-item: trashed target and trashed source among ordered choices', () => {
  const nodes = [
    { id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 0, y: 0, deleted_at: '' },
    { id: 'n2', chapter: 'c1', title: 'B', color: 'slate', x: 0, y: 0, deleted_at: '2026-11-25 10:00:00.000Z' },
  ]
  const out = build([
    k('late', '2026-11-26 10:00:03.000Z'),
    k('toTrashed', '2026-11-26 10:00:02.000Z', { to_node: 'n2' }),
    k('fromTrashed', '2026-11-26 10:00:01.500Z', { from_node: 'n2' }),
    k('first', '2026-11-26 10:00:01.000Z', { to_node: 'n1' }),
  ], nodes)
  expect(out.map((c) => c.id)).toEqual(['first', 'toTrashed', 'late'])
  expect(out.find((c) => c.id === 'toTrashed')?.to).toBeNull()
  expect(out.find((c) => c.id === 'first')?.to).toBe('n1')
})

// Protects: five thousand choices made in a shuffled order come out oldest first.
test('[C8] empty-one-huge: 5,000 shuffled choices', () => {
  const n = 5000
  const order = Array.from({ length: n }, (_, i) => (i * 7919) % n)
  const rows = order.map((i) => k(`id${String(n - i).padStart(5, '0')}`, `2026-11-26 10:00:00.${String(i).padStart(6, '0')}Z`))
  const out = build(rows).map((c) => c.id)
  const expected = Array.from({ length: n }, (_, i) => `id${String(n - i).padStart(5, '0')}`)
  expect(out).toEqual(expected)
})

// Protects: a later time in a different second sorts after an earlier time with a bigger fraction (compared as a whole, not by pieces).
test('[C8] case-and-whitespace: times that differ in the seconds and the milliseconds', () => {
  const out = build([k('b', '2026-11-26 10:00:02.001Z'), k('a', '2026-11-26 10:00:01.999Z'), k('c', '2026-11-26 10:01:00.000Z')])
  expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c'])
})
