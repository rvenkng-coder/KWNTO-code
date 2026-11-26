import { expect, test } from 'vitest'
import type { ProjectFile } from '../../backend'
import { storyOfFile } from './shareStory'

const FILE: ProjectFile = {
  format: 'kwnto-project',
  version: 1,
  exportedAt: '2026-11-26 10:00:00.000Z',
  project: { name: 'Story', startNode: 'n1' },
  chapters: [
    { id: 'c1', title: 'One', position: 1 },
    { id: 'c2', title: 'Two', position: 2 },
  ],
  nodes: [
    { id: 'n1', chapter: 'c1', title: 'Gate', color: 'blue', x: 0, y: 0 },
    { id: 'n2', chapter: 'c2', title: 'Garden', color: 'blue', x: 0, y: 0 },
  ],
  lines: [{ id: 'l1', node: 'n1', character: 'Mara', text: 'Hi', sortOrder: 1 }],
  cues: [{ id: 'q1', node: 'n1', type: 'lighting', text: 'Dim', sortOrder: 1 }],
  connections: [
    { id: 'k1', from: 'n1', to: 'n2', label: 'Go' },
    { id: 'k2', from: 'n1', to: null, label: 'Wait' },
  ],
  media: [
    { id: 'a', node: 'n1', title: 'Pic', kind: 'image' },
    { id: 'b', node: 'n2', title: 'Song', kind: 'audio' },
    { id: 'c', node: 'n1', title: 'Doc', kind: 'document' },
  ],
}

// Protects: a share link's project file becomes the same story the editor's content does: the start
// node, the choices in the file's order (an unlinked one stays), chapter names, no cues, and media of a known
// kind only, each on its own node.
test('a project file becomes the story a player sees', () => {
  const story = storyOfFile(FILE, 'p1')
  expect(story.projectName).toBe('Story')
  expect(story.startId).toBe('n1')
  expect(story.nodes.n1?.choices).toEqual([
    { id: 'k1', label: 'Go', targetId: 'n2' },
    { id: 'k2', label: 'Wait', targetId: null },
  ])
  expect(story.nodes.n2?.chapterTitle).toBe('Two')
  expect(story.nodes.n1?.lines).toEqual([{ character: 'Mara', text: 'Hi' }])
  expect('cues' in (story.nodes.n1 ?? {})).toBe(false)
  expect(story.nodes.n1?.media.map((m) => m.id)).toEqual(['a'])
  expect(story.nodes.n2?.media.map((m) => m.id)).toEqual(['b'])
})
