import { expect, test } from 'vitest'
import { chapter, connection, content, cue, line, node } from '../editor/model/fixtures'
import { fromContent } from '../editor/model/state'
import { buildStory } from './story'

function project(startNodeId: string) {
  return content({
    project: { id: 'p1', teamId: 't1', name: 'Story', startNodeId, deleted: false, deletedAt: null, version: 0 },
    chapters: [chapter('c1', { title: ' One ' }), chapter('c2', { deleted: true })],
    nodes: [
      node('n1', { title: '  Gate ' }),
      node('n2', { title: '' }),
      node('n3', { chapterId: 'c2' }),
      node('n4', { deleted: true }),
    ],
    lines: [
      line('l1', { nodeId: 'n1', character: 'Mara', text: 'Second', sortOrder: 2 }),
      line('l2', { nodeId: 'n1', character: 'Mara', text: 'First', sortOrder: 1 }),
    ],
    connections: [
      connection('k1', 'n1', 'n2', { label: ' Open ', created: '1' }),
      connection('k2', 'n1', null, { label: '', created: '2' }),
      connection('k3', 'n1', 'n4', { label: 'Gone', created: '3' }),
      connection('k4', 'n2', 'n1', { label: '   ', created: '4' }),
    ],
  })
}

// Protects Review Focus 1 and design 9b: only live nodes are in the story, titles are cleaned, lines
// come in order, a choice to a trashed node is hidden, and a choice's label falls back to the target's
// title and then `Untitled`; a trashed start node means there is no start.
test('the story holds live nodes, ordered lines and labelled choices', () => {
  const story = buildStory(fromContent(project('n1')), [])
  expect(Object.keys(story.nodes).sort()).toEqual(['n1', 'n2'])
  expect(story.projectName).toBe('Story')
  expect(story.startId).toBe('n1')
  expect(story.nodes.n1?.title).toBe('Gate')
  expect(story.nodes.n2?.title).toBe('Untitled')
  expect(story.nodes.n1?.chapterTitle).toBe('One')
  expect(story.nodes.n1?.lines.map((l) => l.text)).toEqual(['First', 'Second'])
  expect(story.nodes.n1?.choices).toEqual([
    { id: 'k1', label: 'Open', targetId: 'n2' },
    { id: 'k2', label: 'Untitled', targetId: null },
  ])
  expect(story.nodes.n2?.choices).toEqual([{ id: 'k4', label: 'Gate', targetId: 'n1' }])
  expect(buildStory(fromContent(project('n3')), []).startId).toBeNull()
})

// Protects Review Focus 3 and design 6.4: a script line with no name and no text leaves no gap, cues and
// lighting notes never reach a player, and media follows its own node in the given order.
test('blank lines and cues stay out and media follows its node', () => {
  const state = fromContent(content({
    nodes: [node('n1'), node('n2')],
    lines: [
      line('a', { character: '', text: '', sortOrder: 1 }),
      line('b', { character: '  ', text: ' ', sortOrder: 2 }),
      line('c', { character: '', text: 'He waits.', sortOrder: 3 }),
      line('d', { character: ' Mara ', text: '', sortOrder: 4 }),
    ],
    cues: [cue('q1', { type: 'lighting' }), cue('q2', { type: 'audio' })],
  }))
  const story = buildStory(state, [
    { id: 'a', nodeId: 'n1', title: 'A', kind: 'image' },
    { id: 'b', nodeId: 'n2', title: 'B', kind: 'audio' },
    { id: 'c', nodeId: 'n1', title: 'C', kind: 'video' },
  ])
  const n1 = story.nodes.n1
  expect(n1?.lines).toEqual([{ character: '', text: 'He waits.' }, { character: 'Mara', text: '' }])
  expect(n1 !== undefined && 'cues' in n1).toBe(false)
  expect(n1?.media.map((m) => m.id)).toEqual(['a', 'c'])
  expect(story.nodes.n2?.media.map((m) => m.id)).toEqual(['b'])
})
