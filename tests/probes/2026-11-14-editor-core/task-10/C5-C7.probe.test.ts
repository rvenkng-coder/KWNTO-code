import { expect, test } from 'vitest'
import { chapter, connection, content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { crossLinksOf, PREVIEW_CHARS, toFlowEdges, toFlowNodes } from '../../../../frontend/src/features/editor/model/flow'
import { nodeMarkers } from '../../../../frontend/src/features/editor/model/markers'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'

// Protects: a self-link inside the chapter is an edge; a link from another chapter into this one is not.
test('[C5] relative-of-fixed-case: self-link and an incoming cross-chapter link', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2')],
    nodes: [node('a'), node('b', { chapterId: 'c2' })],
    connections: [connection('self', 'a', 'a'), connection('in', 'b', 'a')],
  }))
  expect(toFlowEdges(s, 'c1').map((e) => e.id)).toEqual(['self'])
  expect(toFlowEdges(s, 'c2')).toEqual([])
  const self = toFlowEdges(s, 'c1')[0]
  expect([self.source, self.target]).toEqual(['a', 'a'])
})

// Protects: a link into a trashed chapter gives no tag; a link inside the chapter gives no tag; a blank title says Untitled.
test('[C6] stale-after-change: trashed target chapter, same-chapter link, blank title', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { title: 'Two' }), chapter('c3', { title: 'Gone', deleted: true })],
    nodes: [node('a'), node('same'), node('b', { chapterId: 'c2', title: '' }), node('g', { chapterId: 'c3' })],
    connections: [connection('k1', 'a', 'same'), connection('k2', 'a', 'b'), connection('k3', 'a', 'g')],
  }))
  expect(crossLinksOf(s, 'a')).toEqual([{ connectionId: 'k2', targetNodeId: 'b', targetChapterId: 'c2', text: '→ Two: Untitled' }])
  expect(crossLinksOf(s, 'b')).toEqual([])
})

// Protects: a node with no lines has no preview; exactly 80 characters is not cut; 81 is cut to 80 with the ellipsis.
test('[C7] empty-one-huge: no lines, exactly the limit, one over', () => {
  const s = fromContent(content({
    nodes: [node('empty'), node('n1')],
    lines: [line('l1', { text: 'x'.repeat(PREVIEW_CHARS), sortOrder: 1 }), line('l2', { text: 'y'.repeat(PREVIEW_CHARS + 1), sortOrder: 2 })],
  }))
  const cards = toFlowNodes(s, 'c1', nodeMarkers(s))
  const empty = cards.find((n) => n.id === 'empty')
  const full = cards.find((n) => n.id === 'n1')
  expect(empty?.data.preview).toEqual([])
  expect(empty?.data.more).toBe(0)
  expect(full?.data.preview[0]).toBe('x'.repeat(PREVIEW_CHARS))
  expect(full?.data.preview[1]).toHaveLength(PREVIEW_CHARS)
  expect(full?.data.preview[1].endsWith('…')).toBe(true)
  expect(full?.type).toBe('card')
})
