import { expect, test } from 'vitest'
import type { ProjectFile } from '../../../../frontend/src/backend'
import { storyOfFile } from '../../../../frontend/src/features/player/shareStory'

function file(over: Partial<ProjectFile> = {}): ProjectFile {
  return {
    format: 'kwnto-project', version: 1, exportedAt: '2026-11-26 10:00:00.000Z',
    project: { name: 'P', startNode: 'n1' },
    chapters: [{ id: 'c1', title: 'One', position: 1 }],
    nodes: [{ id: 'n1', chapter: 'c1', title: 'A', color: 'blue', x: 0, y: 0 }],
    lines: [], cues: [], connections: [], media: [],
    ...over,
  }
}

// Protects: a file with nothing in it, and one whose start node is not in it, have no start and no nodes to play.
test('[C1] empty-one-huge: an empty file, and a start that is not in the file', () => {
  const empty = storyOfFile(file({ project: { name: 'P', startNode: null }, chapters: [], nodes: [] }), 'p1')
  expect(empty).toEqual({ projectName: 'P', startId: null, nodes: {} })
  expect(storyOfFile(file({ project: { name: 'P', startNode: 'gone' } }), 'p1').startId).toBeNull()
})

// Protects: media kinds are matched exactly; capitals, empty and look-alike kinds are dropped, and a good one after a bad one is kept.
test('[C1] second-bad-item: a wrong kind between two good ones', () => {
  const story = storyOfFile(file({
    media: [
      { id: 'a', node: 'n1', title: 'A', kind: 'image' },
      { id: 'b', node: 'n1', title: 'B', kind: 'Image' },
      { id: 'c', node: 'n1', title: 'C', kind: '' },
      { id: 'd', node: 'n1', title: 'D', kind: 'constructor' },
      { id: 'e', node: 'n1', title: 'E', kind: 'video' },
    ],
  }), 'p1')
  expect(story.nodes.n1?.media.map((m) => m.id)).toEqual(['a', 'e'])
})

// Protects: media of a node that is not in the file, and a choice into a node that is not in the file, leave nothing dangling.
test('[C1] stale-after-change: media and a choice that point at a node the file lacks', () => {
  const story = storyOfFile(file({
    connections: [{ id: 'k1', from: 'n1', to: 'ghost', label: 'Go' }, { id: 'k2', from: 'n1', to: null, label: 'Wait' }],
    media: [{ id: 'm', node: 'ghost', title: 'M', kind: 'audio' }],
  }), 'p1')
  expect(Object.keys(story.nodes)).toEqual(['n1'])
  expect(story.nodes.n1?.choices.map((c) => c.id)).toEqual(['k2'])
  expect(story.nodes.n1?.media).toEqual([])
})

// Protects: the file's own order of choices is the order the player offers them.
test('[C1] relative-of-fixed-case: choices keep the file order, not the id order', () => {
  const story = storyOfFile(file({
    connections: [{ id: 'z', from: 'n1', to: 'n1', label: 'first' }, { id: 'a', from: 'n1', to: 'n1', label: 'second' }, { id: 'm', from: 'n1', to: null, label: 'third' }],
  }), 'p1')
  expect(story.nodes.n1?.choices.map((c) => c.label)).toEqual(['first', 'second', 'third'])
})

// Protects: titles and lines with only spaces are cleaned the same way as in the editor, whichever way the story was built.
test('[C1] case-and-whitespace: blank titles and lines from a file', () => {
  const story = storyOfFile(file({
    nodes: [{ id: 'n1', chapter: 'c1', title: '  ', color: 'blue', x: 0, y: 0 }],
    lines: [{ id: 'l1', node: 'n1', character: ' ', text: ' ', sortOrder: 1 }, { id: 'l2', node: 'n1', character: ' Mara ', text: 'Hi', sortOrder: 2 }],
  }), 'p1')
  expect(story.nodes.n1?.title).toBe('Untitled')
  expect(story.nodes.n1?.lines).toEqual([{ character: 'Mara', text: 'Hi' }])
})
