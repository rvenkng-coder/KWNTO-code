import { expect, test } from 'vitest'
import { buildPaste, copySelection, PASTE_OFFSET } from './clipboard'
import { connection, content, cue, line, node } from './fixtures'
import { fromContent } from './state'

const state = () =>
  fromContent(
    content({
      nodes: [node('a', { x: 10, y: 20 }), node('b', { x: 100, y: 20 }), node('c'), node('t', { deleted: true })],
      lines: [line('la', { nodeId: 'a' }), line('lb', { nodeId: 'b' }), line('lc', { nodeId: 'c' })],
      cues: [cue('qa', { nodeId: 'a' })],
      connections: [connection('ab', 'a', 'b'), connection('bc', 'b', 'c'), connection('ta', 't', 'a')],
    }),
  )

// Protects: copy takes the live selected nodes, their lines and cues, and only the connections between them.
test('copy takes the nodes, their content and the connections between them', () => {
  const clip = copySelection(state(), ['a', 'b', 't'])
  expect(clip?.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  expect(clip?.lines.map((l) => l.id).sort()).toEqual(['la', 'lb'])
  expect(clip?.cues.map((c) => c.id)).toEqual(['qa'])
  expect(clip?.connections.map((c) => c.id)).toEqual(['ab'])
  expect(copySelection(state(), ['t'])).toBeNull()
  expect(copySelection(state(), [])).toBeNull()
})

// Protects: a paste makes new records in the target chapter, every reference remapped, offset per paste.
test('paste makes new records in the target chapter', () => {
  const clip = copySelection(state(), ['a', 'b'])
  if (clip === null) throw new Error('nothing copied')
  let n = 0
  const pasted = buildPaste(clip, { projectId: 'p2', chapterId: 'c9' }, 2, () => `new${++n}`)
  const all = [...pasted.nodes, ...pasted.lines, ...pasted.cues, ...pasted.connections]
  const ids = all.map((r) => r.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.every((id) => id.startsWith('new'))).toBe(true)
  const byOld = new Map(clip.nodes.map((old, i) => [old.id, pasted.nodes[i]]))
  expect(byOld.get('a')).toMatchObject({
    x: 10 + 2 * PASTE_OFFSET,
    y: 20 + 2 * PASTE_OFFSET,
    chapterId: 'c9',
    projectId: 'p2',
    version: 0,
    deleted: false,
  })
  const newIds = new Set(pasted.nodes.map((x) => x.id))
  expect(pasted.lines.every((l) => newIds.has(l.nodeId) && l.projectId === 'p2' && l.version === 0)).toBe(true)
  expect(pasted.cues[0]?.nodeId).toBe(byOld.get('a')?.id)
  expect(pasted.connections[0]).toMatchObject({
    fromNodeId: byOld.get('a')?.id,
    toNodeId: byOld.get('b')?.id,
    projectId: 'p2',
    version: 0,
  })
  expect(pasted.lines.find((l) => l.nodeId === byOld.get('b')?.id)?.text).toBe('lb')
})

// Protects: editor cards design (copy and paste keep empty choices): a choice with no target travels with its node and stays empty.
test("copy keeps a node's empty choices and paste keeps them empty", () => {
  const s = fromContent(
    content({
      nodes: [node('a'), node('c')],
      connections: [connection('empty', 'a', null, { label: 'Wait' }), connection('out', 'a', 'c')],
    }),
  )
  const clip = copySelection(s, ['a'])
  if (clip === null) throw new Error('nothing copied')
  expect(clip.connections.map((c) => c.id)).toEqual(['empty'])
  const pasted = buildPaste(clip, { projectId: 'p1', chapterId: 'c1' }, 1, () => 'new')
  expect(pasted.connections[0]).toMatchObject({ id: 'new', toNodeId: null, label: 'Wait' })
})
