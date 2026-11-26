import { expect, test } from 'vitest'
import { connection, cue, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import type { StoryMediaInput } from '../../../../frontend/src/features/player/story'
import { build } from './helpers'

const m = (id: string, nodeId: string, over: Partial<StoryMediaInput> = {}): StoryMediaInput =>
  ({ id, nodeId, title: `t-${id}`, kind: 'image', ...over })

// Protects: tabs and newlines count as blank, and a name alone or text alone keeps the line.
test('[C2] case-and-whitespace: tabs and newlines are blank', () => {
  const s = build({
    nodes: [node('n1')],
    lines: [
      line('l1', { sortOrder: 1, character: '\t', text: '\n' }),
      line('l2', { sortOrder: 2, character: '', text: '\n\t x' }),
      line('l3', { sortOrder: 3, character: '\n', text: '' }),
      line('l4', { sortOrder: 4, character: 'Ann', text: '   ' }),
    ],
  })
  expect(s.nodes.n1.lines).toEqual([
    { character: '', text: '\n\t x' },
    { character: 'Ann', text: '   ' },
  ])
})

// Protects: a node whose lines are all blank, or that has none, gets empty arrays, not missing ones.
test('[C2] empty-one-huge: all blank, none, and one line', () => {
  const s = build({
    nodes: [node('n1'), node('n2'), node('n3')],
    lines: [line('a', { nodeId: 'n1', text: '' }), line('b', { nodeId: 'n1', text: ' ' }), line('c', { nodeId: 'n3', text: 'only' })],
  })
  expect(s.nodes.n1.lines).toEqual([])
  expect(s.nodes.n2.lines).toEqual([])
  expect(s.nodes.n1.media).toEqual([])
  expect(s.nodes.n3.lines).toEqual([{ character: '', text: 'only' }])
})

// Protects: with many lines, blanks are dropped and the order of the rest holds.
test('[C2] empty-one-huge: five hundred lines with blanks between', () => {
  const lines = Array.from({ length: 1000 }, (_, i) =>
    line(`l${i}`, { sortOrder: i + 1, text: i % 2 === 0 ? `t${i}` : '  ' }))
  const s = build({ nodes: [node('n1')], lines })
  const out = s.nodes.n1.lines
  expect(out).toHaveLength(500)
  expect(out[0].text).toBe('t0')
  expect(out[499].text).toBe('t998')
})

// Protects: cue text and type never reach the story, however it is searched.
test('[C2] helper-hides-bug: no cue anywhere in the story', () => {
  const s = build({
    nodes: [node('n1'), node('n2')],
    cues: [cue('q1', { nodeId: 'n1', text: 'SECRETLIGHT' }), cue('q2', { nodeId: 'n2', text: 'SECRETSOUND', type: 'lighting' })],
    lines: [line('l1', { text: 'spoken' })],
    connections: [connection('k1', 'n1', 'n2', { created: '1' })],
  })
  const text = JSON.stringify(s)
  expect(text).not.toContain('SECRET')
  for (const n of Object.values(s.nodes)) {
    expect('cues' in n).toBe(false)
    expect('cue' in n).toBe(false)
  }
})

// Protects: media keeps the given order, drops entries for nodes that are not live, and exposes only id, title and kind.
test('[C2] second-bad-item: media of an unknown or trashed node is ignored', () => {
  const input = [
    m('c', 'n1', { kind: 'video' }),
    m('x', 'ghost'),
    m('b', 'n2', { kind: 'audio' }),
    m('t', 'n3'),
    m('a', 'n1'),
  ]
  const copy = structuredClone(input)
  const s = build({ nodes: [node('n1'), node('n2'), node('n3', { deleted: true })] }, input)
  expect(s.nodes.n1.media).toEqual([{ id: 'c', title: 't-c', kind: 'video' }, { id: 'a', title: 't-a', kind: 'image' }])
  expect(s.nodes.n2.media).toEqual([{ id: 'b', title: 't-b', kind: 'audio' }])
  expect(Object.keys(s.nodes)).toEqual(['n1', 'n2'])
  expect(input).toEqual(copy)
})
