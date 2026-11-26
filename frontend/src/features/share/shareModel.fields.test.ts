import { expect, test } from 'vitest'
import type { ProjectFile } from '../../backend'
import { contentFromFile } from './shareModel'

const BASE = { chapter: 'c1', color: 'blue', x: 0, y: 0 }
const FILE: ProjectFile = {
  format: 'kwnto-project',
  version: 1,
  exportedAt: '2026-11-26 10:00:00.000Z',
  project: { name: 'Story', startNode: null },
  chapters: [{ id: 'c1', title: 'One', position: 1 }],
  nodes: [
    { ...BASE, id: 'n1', title: 'Sized', width: 320, height: 240, cover: 'm1' },
    { ...BASE, id: 'n2', title: 'Plain' },
  ],
  lines: [],
  cues: [],
  connections: [],
  media: [{ id: 'm1', node: 'n1', title: 'Cover', kind: 'image' }],
}

// Protects the share views: a viewer's node has the size and cover the file gives it, and a node
// without them (every node of an older snapshot) gets the defaults.
test("the viewer's nodes take their size and cover from the file", () => {
  const nodes = contentFromFile(FILE, 'p1').nodes
  expect(nodes.map((n) => [n.width, n.height, n.coverMediaId])).toEqual([
    [320, 240, 'm1'],
    [0, 0, ''],
  ])
})
