import { expect, test } from 'vitest'
import { chapter, connection, content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { buildStory } from '../../../../frontend/src/features/player/story'
import { build } from './helpers'

// Protects: tabs, newlines and whitespace-only titles are cleaned the same way as spaces.
test('[C1] case-and-whitespace: tabs and newlines in titles', () => {
  const s = build({
    chapters: [chapter('c1', { title: ' \t ' }), chapter('c2', { title: '\n Two \t' })],
    nodes: [node('n1', { title: '\t Gate\n' }), node('n2', { title: ' \n ', chapterId: 'c2' })],
  })
  expect(s.nodes.n1.title).toBe('Gate')
  expect(s.nodes.n1.chapterTitle).toBe('Untitled')
  expect(s.nodes.n2.title).toBe('Untitled')
  expect(s.nodes.n2.chapterTitle).toBe('Two')
  expect(s.nodes.n2.chapterId).toBe('c2')
})

// Protects: nothing from a trashed node or trashed chapter appears, not as a node and not as a choice target.
test('[C1] stale-after-change: trashed node and trashed chapter leave no trace', () => {
  const s = build({
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('n1'), node('n2', { deleted: true }), node('n3', { chapterId: 'c2' })],
    lines: [line('l1', { nodeId: 'n2' }), line('l2', { nodeId: 'n3' })],
    connections: [
      connection('k1', 'n1', 'n2', { label: 'a', created: '1' }),
      connection('k2', 'n1', 'n3', { label: 'b', created: '2' }),
      connection('k3', 'n2', 'n1', { label: 'c', created: '3' }),
      connection('k4', 'n1', null, { label: 'd', created: '4' }),
    ],
  })
  expect(Object.keys(s.nodes)).toEqual(['n1'])
  expect(s.nodes.n1.choices).toEqual([{ id: 'k4', label: 'd', targetId: null }])
})

// Protects: the label falls back to a trimmed target title, then Untitled, and a self-choice reads its own node.
test('[C1] relative-of-fixed-case: label fallbacks', () => {
  const s = build({
    nodes: [node('n1', { title: ' Home ' }), node('n2', { title: ' Door ' }), node('n3', { title: '  ' })],
    connections: [
      connection('k1', 'n1', 'n2', { label: '\t', created: '1' }),
      connection('k2', 'n1', 'n3', { label: '', created: '2' }),
      connection('k3', 'n1', 'n1', { label: '', created: '3' }),
      connection('k4', 'n1', 'n2', { label: ' Keep  inner ', created: '4' }),
    ],
  })
  expect(s.nodes.n1.choices).toEqual([
    { id: 'k1', label: 'Door', targetId: 'n2' },
    { id: 'k2', label: 'Untitled', targetId: 'n3' },
    { id: 'k3', label: 'Home', targetId: 'n1' },
    { id: 'k4', label: 'Keep  inner', targetId: 'n2' },
  ])
})

// Protects: choices follow created then id, not the order the records were written.
test('[C1] relative-of-fixed-case: choice order is created then id', () => {
  const s = build({
    nodes: [node('n1'), node('n2')],
    connections: [
      connection('k3', 'n1', 'n2', { created: '3' }),
      connection('kb', 'n1', 'n2', { created: '4' }),
      connection('k1', 'n1', 'n2', { created: '1' }),
      connection('ka', 'n1', 'n2', { created: '4' }),
      connection('k2', 'n1', 'n2', { created: '2' }),
    ],
  })
  expect(s.nodes.n1.choices.map((c) => c.id)).toEqual(['k1', 'k2', 'k3', 'ka', 'kb'])
})

// Protects: no project means an empty name and no start; a trashed start gives no start; an empty project has no nodes; the state is not changed.
test('[C1] empty-one-huge: no project, trashed start, no nodes', () => {
  const none = { ...fromContent(content()), project: null }
  expect(buildStory(none, [])).toEqual({ projectName: '', startId: null, nodes: {} })

  const base = content({ nodes: [node('n1', { deleted: true }), node('n2')] })
  const trashedStart = { ...base, project: { ...base.project, startNodeId: 'n1' } }
  const state = fromContent(trashedStart)
  const before = structuredClone(state)
  const out = buildStory(state, [])
  expect(out.startId).toBeNull()
  expect(Object.keys(out.nodes)).toEqual(['n2'])
  expect(state).toEqual(before)

  const live = { ...base, project: { ...base.project, startNodeId: 'n2' } }
  expect(buildStory(fromContent(live), []).startId).toBe('n2')
})

// Protects: lines sort by number (not text), the speaker is trimmed and the spoken text is left as typed.
test('[C1] relative-of-fixed-case: line order is numeric, text is not trimmed', () => {
  const s = build({
    nodes: [node('n1')],
    lines: [
      line('a', { sortOrder: 100, character: ' C ', text: 'third' }),
      line('b', { sortOrder: 9, character: '\tA\t', text: ' first ' }),
      line('c', { sortOrder: 10, character: 'B', text: 'second' }),
    ],
  })
  expect(s.nodes.n1.lines).toEqual([
    { character: 'A', text: ' first ' },
    { character: 'B', text: 'second' },
    { character: 'C', text: 'third' },
  ])
})
