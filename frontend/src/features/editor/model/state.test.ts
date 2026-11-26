import { expect, test } from 'vitest'
import { chapter, connection, content, cue, line, node } from './fixtures'
import {
  cuesOf,
  fromContent,
  linesOf,
  liveChapters,
  liveConnections,
  liveNodes,
  putRecord,
  dropRecord,
  isLiveNode,
} from './state'

// Protects: trashing a node or a chapter hides it, what it holds and the connections to it.
test('trashed nodes and chapters hide what they hold', () => {
  const s = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2', { deleted: true })],
      nodes: [node('a'), node('gone', { deleted: true }), node('inTrashedChapter', { chapterId: 'c2' })],
      connections: [
        connection('k1', 'a', 'gone'),
        connection('k2', 'a', 'inTrashedChapter'),
        connection('k3', 'a', 'a'),
      ],
    }),
  )
  expect(liveNodes(s).map((n) => n.id)).toEqual(['a'])
  expect(liveNodes(s, 'c2')).toEqual([])
  expect(liveConnections(s).map((c) => c.id)).toEqual(['k3'])
  expect(isLiveNode(s, 'missing')).toBe(false)
})

// Protects: tabs, lines and cues come back in their sort order, ties broken by id.
test('chapters and lines come back in order', () => {
  const s = fromContent(
    content({
      chapters: [chapter('a', { position: 2 }), chapter('b', { position: 1 }), chapter('c', { position: 1.5 })],
      lines: [
        line('x', { sortOrder: 3 }),
        line('y', { sortOrder: 1 }),
        line('z', { sortOrder: 2 }),
        line('other', { nodeId: 'n2', sortOrder: 0 }),
      ],
      cues: [cue('q2', { sortOrder: 2 }), cue('q1', { sortOrder: 1 })],
    }),
  )
  expect(liveChapters(s).map((c) => c.id)).toEqual(['b', 'c', 'a'])
  expect(linesOf(s, 'n1').map((l) => l.id)).toEqual(['y', 'z', 'x'])
  expect(cuesOf(s, 'n1').map((q) => q.id)).toEqual(['q1', 'q2'])
})

// Protects: putRecord and dropRecord return a new state and leave the old one untouched.
test('putRecord and dropRecord do not change the state they are given', () => {
  const s = fromContent(content({ nodes: [node('a')] }))
  const added = putRecord(s, 'nodes', node('b'))
  expect(Object.keys(s.nodes)).toEqual(['a'])
  expect(Object.keys(added.nodes).sort()).toEqual(['a', 'b'])
  const dropped = dropRecord(added, 'nodes', 'a')
  expect(Object.keys(dropped.nodes)).toEqual(['b'])
  expect(Object.keys(added.nodes).sort()).toEqual(['a', 'b'])
  expect(putRecord(s, 'projects', { ...s.project!, name: 'New' }).project?.name).toBe('New')
})
