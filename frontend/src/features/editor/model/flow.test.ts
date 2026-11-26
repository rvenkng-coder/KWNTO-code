import { expect, test } from 'vitest'
import { chapter, connection, content, cue, line, node } from './fixtures'
import { crossLinksOf, toFlowEdges, toFlowNodes } from './flow'
import { nodeMarkers } from './markers'
import { fromContent } from './state'

// Protects: design 6.1: the canvas of a chapter draws only connections with both ends in it.
test('only connections inside the chapter become edges', () => {
  const s = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2')],
      nodes: [node('a'), node('b'), node('gone', { deleted: true }), node('far', { chapterId: 'c2' })],
      connections: [
        { ...connection('inside', 'a', 'b'), label: 'Yes' },
        connection('across', 'a', 'far'),
        connection('trashed', 'a', 'gone'),
      ],
    }),
  )
  const edges = toFlowEdges(s, 'c1')
  expect(edges.map((e) => e.id)).toEqual(['inside'])
  expect(edges[0]).toMatchObject({ source: 'a', target: 'b', label: 'Yes' })
})

// Protects: design 6.1: a link into another chapter shows as a tag naming the chapter and node.
test('cross-chapter links become tags', () => {
  const s = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2', { title: 'Chapter 2' })],
      nodes: [
        node('a'),
        node('door', { chapterId: 'c2', title: 'The Door' }),
        node('blank', { chapterId: 'c2', title: '' }),
        node('gone', { chapterId: 'c2', deleted: true }),
      ],
      connections: [connection('k1', 'a', 'door'), connection('k2', 'a', 'blank'), connection('k3', 'a', 'gone')],
    }),
  )
  const tags = crossLinksOf(s, 'a')
  expect(tags.map((t) => t.text).sort()).toEqual(['→ Chapter 2: The Door', '→ Chapter 2: Untitled'])
  expect(tags.find((t) => t.connectionId === 'k1')).toEqual({
    connectionId: 'k1',
    targetNodeId: 'door',
    targetChapterId: 'c2',
    text: '→ Chapter 2: The Door',
  })
  const card = toFlowNodes(s, 'c1', nodeMarkers(s)).find((n) => n.id === 'a')
  expect(card?.data.choices.filter((c) => c.crossLink !== null)).toHaveLength(2)
})

// Protects: D9: a node shows its first 3 lines, cut to 80 characters, and counts the rest.
test('node previews show three lines and count the rest', () => {
  const long = 'L'.repeat(120)
  const s = fromContent(
    content({
      nodes: [node('n1', { title: 'Hall', color: 'red', x: 10, y: 20 })],
      lines: [
        line('l1', { character: 'Narrator', text: 'Hello', sortOrder: 1 }),
        line('l2', { character: '', text: long, sortOrder: 2 }),
        line('l3', { character: 'ana', text: 'Hi', sortOrder: 3 }),
        line('l4', { sortOrder: 4 }),
        line('l5', { sortOrder: 5 }),
      ],
    }),
  )
  const [card] = toFlowNodes(s, 'c1', nodeMarkers(s))
  expect(card).toMatchObject({ id: 'n1', type: 'card', position: { x: 10, y: 20 } })
  expect(card?.data.title).toBe('Hall')
  expect(card?.data.color).toBe('red')
  expect(card?.data.preview).toEqual(['NARRATOR: Hello', `${'L'.repeat(79)}…`, 'ANA: Hi'])
  expect(card?.data.more).toBe(2)
  expect(card?.data.marker).toEqual({ isStart: false, isEnd: true, isUnreachable: true })
})

// Protects: editor cards design 1 (every choice is a row, in the order made; an empty one reads Untitled and is not linked).
test('a card lists every choice in order, empty ones as not linked', () => {
  const s = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2', { title: 'Chapter 2' })],
      nodes: [node('a'), node('b'), node('door', { chapterId: 'c2', title: 'The Door' })],
      connections: [
        connection('k1', 'a', 'b', { label: 'Go', created: '2026-11-18T10:00:01.000Z' }),
        connection('k2', 'a', null, { created: '2026-11-18T10:00:02.000Z' }),
        connection('k3', 'a', 'door', { label: 'Away', created: '2026-11-18T10:00:03.000Z' }),
      ],
    }),
  )
  const card = toFlowNodes(s, 'c1', nodeMarkers(s)).find((n) => n.id === 'a')
  expect(card?.data.choices).toEqual([
    { id: 'k1', text: 'Go', untitled: false, linked: true, crossLink: null },
    { id: 'k2', text: 'Untitled', untitled: true, linked: false, crossLink: null },
    {
      id: 'k3',
      text: 'Away',
      untitled: false,
      linked: true,
      crossLink: { connectionId: 'k3', targetNodeId: 'door', targetChapterId: 'c2', text: '→ Chapter 2: The Door' },
    },
  ])
})

// Protects: editor cards design 2: the card shows two cues with their type, then how many more.
test('a card shows two cues then a count', () => {
  const s = fromContent(
    content({
      nodes: [node('a')],
      cues: [
        cue('q3', { nodeId: 'a', type: 'other', text: 'Fog', sortOrder: 3 }),
        cue('q1', { nodeId: 'a', type: 'audio', text: 'Rain', sortOrder: 1 }),
        cue('q2', { nodeId: 'a', type: 'lighting', text: 'Dim', sortOrder: 2 }),
      ],
    }),
  )
  const data = toFlowNodes(s, 'c1', nodeMarkers(s))[0]?.data
  expect(data?.cues).toEqual([
    { tag: 'Audio', text: 'Rain' },
    { tag: 'Light', text: 'Dim' },
  ])
  expect(data?.moreCues).toBe(1)
})

// Protects: editor cards design 1: a line leaves from its own choice's handle, and an empty or cross-chapter choice draws none.
test("edges leave from their choice's handle and empty choices draw none", () => {
  const s = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2')],
      nodes: [node('a'), node('b'), node('far', { chapterId: 'c2' })],
      connections: [connection('k1', 'a', 'b'), connection('k2', 'a', null), connection('k3', 'a', 'far')],
    }),
  )
  const edges = toFlowEdges(s, 'c1')
  expect(edges).toHaveLength(1)
  expect(edges[0]).toMatchObject({ id: 'k1', source: 'a', target: 'b', sourceHandle: 'choice-k1' })
})
