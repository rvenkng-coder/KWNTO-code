import { expect, test } from 'vitest'
import { chapter, connection, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { EMPTY_STATE, fromContent } from '../../../../frontend/src/features/editor/model/state'
import { buildStory } from '../../../../frontend/src/features/player/story'

// Protects: tabs, newlines and non-ASCII spaces around titles and labels are cleaned, and a title of only whitespace reads Untitled.
test('[C1] case-and-whitespace: tabs, newlines and accented text around titles', () => {
  const s = fromContent(content({
    project: { id: 'p1', teamId: 't1', name: 'Story', startNodeId: 'n1', deleted: false, deletedAt: null, version: 0 },
    chapters: [chapter('c1', { title: ' \t ' })],
    nodes: [node('n1', { title: '\t Gate\n' }), node('n2', { title: ' \n ' })],
    connections: [connection('k1', 'n1', 'n2', { label: '  Ünï côdé \n', created: '1' }), connection('k2', 'n2', 'n1', { label: '\t', created: '1' })],
  }))
  const st = buildStory(s, [])
  expect(st.nodes.n1?.title).toBe('Gate')
  expect(st.nodes.n2?.title).toBe('Untitled')
  expect(st.nodes.n1?.chapterTitle).toBe('Untitled')
  expect(st.nodes.n1?.choices[0]?.label).toBe('Ünï côdé')
  expect(st.nodes.n2?.choices[0]?.label).toBe('Gate')
})

// Protects: a node whose chapter is trashed is gone from the story, and a choice into it is hidden, not shown as a dead link.
test('[C1] stale-after-change: a chapter is trashed after choices were made into it', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('n1'), node('n2', { chapterId: 'c2' })],
    connections: [connection('k1', 'n1', 'n2', { label: 'Go', created: '1' }), connection('k2', 'n1', null, { label: 'Wait', created: '2' })],
  }))
  const st = buildStory(s, [])
  expect(Object.keys(st.nodes)).toEqual(['n1'])
  expect(st.nodes.n1?.choices.map((c) => c.id)).toEqual(['k2'])
})

// Protects: no project, no nodes, and then a very large project all give a story without throwing.
test('[C1] empty-one-huge: nothing at all, then 2,000 nodes in a chain', () => {
  const empty = buildStory(EMPTY_STATE, [])
  expect(empty).toEqual({ projectName: '', startId: null, nodes: {} })
  const ids = Array.from({ length: 2000 }, (_, i) => `n${i}`)
  const big = fromContent(content({
    project: { id: 'p1', teamId: 't1', name: 'Big', startNodeId: 'n0', deleted: false, deletedAt: null, version: 0 },
    nodes: ids.map((id) => node(id)),
    connections: ids.slice(1).map((id, i) => connection(`k${i}`, `n${i}`, id, { label: `to ${id}`, created: String(i).padStart(6, '0') })),
  }))
  const st = buildStory(big, [])
  expect(Object.keys(st.nodes)).toHaveLength(2000)
  expect(st.nodes.n1999?.choices).toEqual([])
  expect(st.nodes.n1000?.choices).toEqual([{ id: 'k1000', label: 'to n1001', targetId: 'n1001' }])
})

// Protects: two empty-text choices are labelled one by one from their own targets; one blank title does not spoil the other.
test('[C1] two-bad-items: two unlabelled choices, one target untitled', () => {
  const s = fromContent(content({
    nodes: [node('n1', { title: 'A' }), node('n2', { title: '   ' }), node('n3', { title: 'Third' })],
    connections: [connection('k1', 'n1', 'n2', { created: '1' }), connection('k2', 'n1', 'n3', { created: '2' })],
  }))
  expect(buildStory(s, []).nodes.n1?.choices.map((c) => c.label)).toEqual(['Untitled', 'Third'])
})

// Protects: a choice back to its own node, without text, takes the node's own cleaned title.
test('[C1] relative-of-fixed-case: an unlabelled choice to the same node', () => {
  const s = fromContent(content({
    nodes: [node('n1', { title: ' Loop ' })],
    connections: [connection('k1', 'n1', 'n1', { label: '', created: '1' })],
  }))
  expect(buildStory(s, []).nodes.n1?.choices).toEqual([{ id: 'k1', label: 'Loop', targetId: 'n1' }])
})
