import { expect, test } from 'vitest'
import { chapter, connection, content, line, node } from './fixtures'
import { crossLinksOf, toFlowEdges, toFlowNodes } from './flow'
import { nodeMarkers } from './markers'
import { fromContent } from './state'

// Protects: design 6.1: the canvas of a chapter draws only connections with both ends in it.
test('only connections inside the chapter become edges', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2')],
    nodes: [node('a'), node('b'), node('gone', { deleted: true }), node('far', { chapterId: 'c2' })],
    connections: [
      { ...connection('inside', 'a', 'b'), label: 'Yes' }, connection('across', 'a', 'far'), connection('trashed', 'a', 'gone'),
    ],
  }))
  const edges = toFlowEdges(s, 'c1')
  expect(edges.map((e) => e.id)).toEqual(['inside'])
  expect(edges[0]).toMatchObject({ source: 'a', target: 'b', label: 'Yes' })
})

// Protects: design 6.1: a link into another chapter shows as a tag naming the chapter and node.
test('cross-chapter links become tags', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { title: 'Chapter 2' })],
    nodes: [
      node('a'), node('door', { chapterId: 'c2', title: 'The Door' }), node('blank', { chapterId: 'c2', title: '' }),
      node('gone', { chapterId: 'c2', deleted: true }),
    ],
    connections: [connection('k1', 'a', 'door'), connection('k2', 'a', 'blank'), connection('k3', 'a', 'gone')],
  }))
  const tags = crossLinksOf(s, 'a')
  expect(tags.map((t) => t.text).sort()).toEqual(['→ Chapter 2: The Door', '→ Chapter 2: Untitled'])
  expect(tags.find((t) => t.connectionId === 'k1')).toEqual({ connectionId: 'k1', targetNodeId: 'door', targetChapterId: 'c2', text: '→ Chapter 2: The Door' })
  const card = toFlowNodes(s, 'c1', nodeMarkers(s)).find((n) => n.id === 'a')
  expect(card?.data.crossLinks).toHaveLength(2)
})

// Protects: D9: a node shows its first 3 lines, cut to 80 characters, and counts the rest.
test('node previews show three lines and count the rest', () => {
  const long = 'L'.repeat(120)
  const s = fromContent(content({
    nodes: [node('n1', { title: 'Hall', color: 'red', x: 10, y: 20 })],
    lines: [
      line('l1', { character: 'Narrator', text: 'Hello', sortOrder: 1 }),
      line('l2', { character: '', text: long, sortOrder: 2 }),
      line('l3', { character: 'ana', text: 'Hi', sortOrder: 3 }),
      line('l4', { sortOrder: 4 }), line('l5', { sortOrder: 5 }),
    ],
  }))
  const [card] = toFlowNodes(s, 'c1', nodeMarkers(s))
  expect(card).toMatchObject({ id: 'n1', type: 'card', position: { x: 10, y: 20 } })
  expect(card?.data.title).toBe('Hall')
  expect(card?.data.color).toBe('red')
  expect(card?.data.preview).toEqual(['NARRATOR: Hello', `${'L'.repeat(79)}…`, 'ANA: Hi'])
  expect(card?.data.more).toBe(2)
  expect(card?.data.marker).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
})
