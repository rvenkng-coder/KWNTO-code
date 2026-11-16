import { expect, test } from 'vitest'
import { chapter, connection, content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { applyRemote } from '../../../../frontend/src/features/editor/model/remote'
import { fromContent, isLiveNode, liveChapters, liveNodes, linesOf, putRecord } from '../../../../frontend/src/features/editor/model/state'

// Protects: a node whose chapter is missing altogether is not live.
test('[C6] empty-one-huge: a node of an unknown chapter is hidden', () => {
  const s = fromContent(content({ nodes: [node('a', { chapterId: 'nowhere' })] }))
  expect(isLiveNode(s, 'a')).toBe(false)
  expect(liveNodes(s)).toEqual([])
})

// Protects: nodes can be listed for one chapter only.
test('[C6] second-bad-item: liveNodes filters by chapter', () => {
  const s = fromContent(content({ chapters: [chapter('c1'), chapter('c2')], nodes: [node('a'), node('b', { chapterId: 'c2' })] }))
  expect(liveNodes(s, 'c2').map((n) => n.id)).toEqual(['b'])
})

// Protects: a connection is hidden when only its source end is trashed, and shown when both are live.
test('[C6] two-bad-items: connections need both ends', () => {
  const s = fromContent(content({ nodes: [node('a'), node('b', { deleted: true })], connections: [connection('k', 'b', 'a')] }))
  expect(Object.keys(s.connections)).toEqual(['k'])
  expect(putRecord(s, 'nodes', node('b')).connections.k).toBeDefined()
})

// Protects: ordering uses the number, not text (10 after 9) and ignores trashed chapters.
test('[C7] case-and-whitespace: numeric order, not text order', () => {
  const s = fromContent(content({
    chapters: [chapter('x', { position: 10 }), chapter('y', { position: 9 }), chapter('z', { position: 1, deleted: true })],
    lines: [line('a', { sortOrder: 10 }), line('b', { sortOrder: 9 })],
  }))
  expect(liveChapters(s).map((c) => c.id)).toEqual(['y', 'x'])
  expect(linesOf(s, 'n1').map((x) => x.id)).toEqual(['b', 'a'])
})

// Protects: a create event for a record we already hold at the same version is ignored.
test('[C8] two-bad-items: a repeated create is the same state', () => {
  const s = fromContent(content({ nodes: [node('a', { version: 0 })] }))
  expect(applyRemote(s, { kind: 'nodes', action: 'create', record: node('a', { title: 'echo', version: 0 }) })).toBe(s)
})

// Protects: deleting an unknown record is harmless, and an event of another project's line is ignored.
test('[C9] helper-hides-bug: delete of an unknown id and foreign lines', () => {
  const s = fromContent(content({ nodes: [node('a')] }))
  expect(applyRemote(s, { kind: 'script_lines', action: 'delete', record: line('nope') }).nodes).toEqual(s.nodes)
  expect(applyRemote(s, { kind: 'script_lines', action: 'create', record: line('l', { projectId: 'other' }) })).toBe(s)
  expect(applyRemote(s, { kind: 'script_lines', action: 'create', record: line('l') }).lines.l).toBeDefined()
})
