import { expect, test } from 'vitest'
import { chapter, connection, content, node } from './fixtures'
import { effectiveStart, nodeMarkers } from './markers'
import { fromContent } from './state'

const project = (startNodeId: string | null) => ({ id: 'p1', teamId: 't1', name: 'Story', startNodeId, deleted: false, version: 0 })

// Protects: design 6.1 and D8: the start node, an end node and an unreachable node are told apart.
test('markers for a start, a target and a lone node', () => {
  const s = fromContent(content({
    project: project('a'), nodes: [node('a'), node('b'), node('c')], connections: [connection('k1', 'a', 'b')],
  }))
  const m = nodeMarkers(s)
  expect(effectiveStart(s)).toBe('a')
  expect(m.get('a')).toEqual({ isStart: true, isEnd: false, isUnreachable: false })
  expect(m.get('b')).toEqual({ isStart: false, isEnd: true, isUnreachable: false })
  expect(m.get('c')).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
})

// Protects: D8: a connection from a node to itself is outgoing (not an end) but not incoming (still unreachable).
test('a self-link is outgoing but not incoming', () => {
  const s = fromContent(content({ nodes: [node('c')], connections: [connection('k1', 'c', 'c')] }))
  expect(nodeMarkers(s).get('c')).toEqual({ isStart: false, isEnd: false, isUnreachable: true })
})

// Protects: Review Focus 5: trashed nodes leave no marker, no link and no start behind.
test('trashed nodes neither link nor start', () => {
  const s = fromContent(content({
    project: project('gone'),
    nodes: [node('a'), node('b', { deleted: true }), node('gone', { deleted: true }), node('c')],
    connections: [connection('k1', 'a', 'b'), connection('k2', 'gone', 'c')],
  }))
  const m = nodeMarkers(s)
  expect(effectiveStart(s)).toBeNull()
  expect(m.has('b')).toBe(false)
  expect(m.has('gone')).toBe(false)
  expect(m.get('a')).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
  expect(m.get('c')).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
})

// Protects: design 6.1: a link to another chapter is a real link for both ends.
test('cross-chapter connections count as links', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2')],
    nodes: [node('a'), node('b', { chapterId: 'c2' })],
    connections: [connection('k1', 'a', 'b')],
  }))
  const m = nodeMarkers(s)
  expect(m.get('a')?.isEnd).toBe(false)
  expect(m.get('b')?.isUnreachable).toBe(false)
})
