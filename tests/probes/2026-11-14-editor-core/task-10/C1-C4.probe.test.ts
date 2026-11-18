import { expect, test } from 'vitest'
import { chapter, connection, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { effectiveStart, nodeMarkers } from '../../../../frontend/src/features/editor/model/markers'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'

const withStart = (start: string | null) => ({ id: 'p1', teamId: 't1', name: 'S', startNodeId: start, deleted: false, version: 0 })

// Protects: an empty project has no markers and no start; one lone start node is an end but reachable.
test('[C1] empty-one-huge: no nodes, one lone start node, and a long chain', () => {
  expect(nodeMarkers(fromContent(content())).size).toBe(0)
  expect(effectiveStart(fromContent(content()))).toBeNull()
  const one = fromContent(content({ project: withStart('a'), nodes: [node('a')] }))
  expect(nodeMarkers(one).get('a')).toEqual({ isStart: true, isEnd: true, isUnreachable: false })
  const ids = Array.from({ length: 300 }, (_, i) => `n${i}`)
  const chain = fromContent(content({
    project: withStart('n0'), nodes: ids.map((id) => node(id)),
    connections: ids.slice(1).map((id, i) => connection(`k${i}`, ids[i], id)),
  }))
  const m = nodeMarkers(chain)
  expect(m.size).toBe(300)
  expect([...m.values()].filter((x) => x.isUnreachable)).toHaveLength(0)
  expect([...m.entries()].filter(([, x]) => x.isEnd).map(([id]) => id)).toEqual(['n299'])
})

// Protects: a node with a self-link and an incoming link from elsewhere is reachable; a self-link alone is not.
test('[C2] relative-of-fixed-case: self-link plus a real incoming link', () => {
  const s = fromContent(content({
    project: withStart('a'), nodes: [node('a'), node('b'), node('c')],
    connections: [connection('k1', 'b', 'b'), connection('k2', 'a', 'b'), connection('k3', 'c', 'c')],
  }))
  const m = nodeMarkers(s)
  expect(m.get('b')).toEqual({ isStart: false, isEnd: false, isUnreachable: false })
  expect(m.get('c')).toEqual({ isStart: false, isEnd: false, isUnreachable: true })
})

// Protects: a node in a trashed chapter is not live: no entry, its links count for nothing, it cannot be the start.
test('[C3] stale-after-change: trashed chapter and a start node in it', () => {
  const s = fromContent(content({
    project: withStart('x'),
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('a'), node('x', { chapterId: 'c2' })],
    connections: [connection('k1', 'x', 'a'), connection('k2', 'a', 'x')],
  }))
  expect(effectiveStart(s)).toBeNull()
  const m = nodeMarkers(s)
  expect(m.has('x')).toBe(false)
  expect(m.get('a')).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
})

// Protects: a start node id that does not exist at all gives no start; cross-chapter links count both ways.
test('[C4] helper-hides-bug: unknown start id and a two-chapter cycle', () => {
  const s = fromContent(content({
    project: withStart('missing'),
    chapters: [chapter('c1'), chapter('c2')],
    nodes: [node('a'), node('b', { chapterId: 'c2' })],
    connections: [connection('k1', 'a', 'b'), connection('k2', 'b', 'a')],
  }))
  expect(effectiveStart(s)).toBeNull()
  const m = nodeMarkers(s)
  expect(m.get('a')).toEqual({ isStart: false, isEnd: false, isUnreachable: false })
  expect(m.get('b')).toEqual({ isStart: false, isEnd: false, isUnreachable: false })
})
