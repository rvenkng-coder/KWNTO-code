import { expect, test } from 'vitest'
import { content, cue, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { buildStory } from '../../../../frontend/src/features/player/story'

// Protects: names are trimmed, but the spoken text is kept exactly as typed (spaces inside a line are the author's).
test('[C2] case-and-whitespace: name trimmed, text untouched', () => {
  const s = fromContent(content({
    nodes: [node('n1')],
    lines: [line('a', { character: '\tMara\n', text: '  spaced  out  ', sortOrder: 1 })],
  }))
  expect(buildStory(s, []).nodes.n1?.lines).toEqual([{ character: 'Mara', text: '  spaced  out  ' }])
})

// Protects: a blank line between two real ones is dropped and the real ones keep their order.
test('[C2] second-bad-item: good, blank, good', () => {
  const s = fromContent(content({
    nodes: [node('n1')],
    lines: [
      line('a', { character: '', text: 'one', sortOrder: 1 }),
      line('b', { character: ' ', text: '\n', sortOrder: 2 }),
      line('c', { character: 'X', text: 'two', sortOrder: 3 }),
    ],
  }))
  expect(buildStory(s, []).nodes.n1?.lines.map((l) => l.text)).toEqual(['one', 'two'])
})

// Protects: a node of only blank lines has none; a node with a thousand lines keeps them in order.
test('[C2] empty-one-huge: only blanks, then 1,000 lines', () => {
  const many = Array.from({ length: 1000 }, (_, i) => line(`l${i}`, { nodeId: 'n2', character: '', text: `t${i}`, sortOrder: i }))
  const s = fromContent(content({
    nodes: [node('n1'), node('n2')],
    lines: [line('b1', { nodeId: 'n1', character: '', text: '' }), ...many],
  }))
  const st = buildStory(s, [])
  expect(st.nodes.n1?.lines).toEqual([])
  expect(st.nodes.n2?.lines.map((l) => l.text)).toEqual(many.map((l) => l.text))
})

// Protects: cues of every type stay out, whatever they contain.
test('[C2] relative-of-fixed-case: every cue type, with text that looks like script, never reaches a player', () => {
  const s = fromContent(content({
    nodes: [node('n1')],
    cues: [cue('q1', { type: 'audio', text: 'MARA: hello' }), cue('q2', { type: 'lighting', text: 'Dim' }), cue('q3', { type: 'other', text: 'x' })],
  }))
  const json = JSON.stringify(buildStory(s, []))
  expect(json).not.toContain('MARA: hello')
  expect(json).not.toContain('Dim')
})

// Protects: media for a node that is not in the story (trashed or unknown) does not appear anywhere, and a node with none has an empty list.
test('[C2] stale-after-change: media of a trashed node and of an unknown node', () => {
  const s = fromContent(content({ nodes: [node('n1'), node('n2', { deleted: true })] }))
  const st = buildStory(s, [
    { id: 'a', nodeId: 'n2', title: 'A', kind: 'image' },
    { id: 'b', nodeId: 'nope', title: 'B', kind: 'audio' },
  ])
  expect(Object.keys(st.nodes)).toEqual(['n1'])
  expect(st.nodes.n1?.media).toEqual([])
})
