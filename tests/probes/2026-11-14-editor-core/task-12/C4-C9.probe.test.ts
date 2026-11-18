import { expect, test } from 'vitest'
import { buildPaste, copySelection } from '../../../../frontend/src/features/editor/model/clipboard'
import { chapter, connection, content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { canApply, EMPTY_HISTORY, invert, recordStep, takeRedo, takeUndo, type History, type Step } from '../../../../frontend/src/features/editor/model/history'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'

const step = (label: string): Step => ({ label, changes: [{ type: 'update', kind: 'nodes', id: 'n1', before: { x: 0 }, after: { x: 1 } }] })
const fill = (n: number) => Array.from({ length: n }, (_, i) => step(`s${i}`)).reduce(recordStep, EMPTY_HISTORY)

// Protects: exactly one hundred steps are all kept; the hundred-and-first pushes out only the oldest.
test('[C4] empty-one-huge: the depth boundary', () => {
  expect(fill(100).past[0]?.label).toBe('s0')
  expect(fill(101).past[0]?.label).toBe('s1')
  expect(fill(101).past).toHaveLength(100)
})

// Protects: inverting twice gives the step back, and the input step is not changed.
test('[C5] relative-of-fixed-case: invert twice is the identity', () => {
  const s: Step = { label: 'x', changes: [step('a').changes[0] as Step['changes'][0], { type: 'create', kind: 'script_lines', record: line('l1') }] }
  const copy = JSON.parse(JSON.stringify(s)) as Step
  expect(invert(invert(s))).toEqual(s)
  expect(s).toEqual(copy)
})

// Protects: after an undo, a new edit means nothing can be redone.
test('[C6] stale-after-change: redo after a new edit', () => {
  const undone = takeUndo(fill(3)) as { history: History }
  expect(takeRedo(recordStep(undone.history, step('new')))).toBeNull()
})

// Protects: one changed key among several blocks the change; null values compare correctly.
test('[C7] second-bad-item: two fields, the second touched by a teammate', () => {
  const s = fromContent(content({ nodes: [node('n1', { title: 'A', x: 5 })] }))
  const change = (before: Record<string, unknown>) => ({ type: 'update' as const, kind: 'nodes' as const, id: 'n1', before, after: before })
  expect(canApply(change({ title: 'A', x: 5 }), s)).toBe(true)
  expect(canApply(change({ title: 'A', x: 6 }), s)).toBe(false)
  const p = { type: 'update' as const, kind: 'projects' as const, id: 'p1', before: { startNodeId: null }, after: { startNodeId: 'n1' } }
  expect(canApply(p, s)).toBe(true)
  const removeEdge = { type: 'remove' as const, kind: 'connections' as const, record: { ...connection('k', 'a', 'b'), label: 'old' } }
  expect(canApply(removeEdge, fromContent(content({ connections: [{ ...connection('k', 'a', 'b'), label: 'new' }] })))).toBe(false)
})

// Protects: a node in a trashed chapter is not copied; a self-link of a copied node is kept.
test('[C8] stale-after-change: trashed chapter and a self-link', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('a'), node('z', { chapterId: 'c2' })],
    connections: [connection('aa', 'a', 'a'), connection('az', 'a', 'z')],
  }))
  const clip = copySelection(s, ['a', 'z'])
  expect(clip?.nodes.map((n) => n.id)).toEqual(['a'])
  expect(clip?.connections.map((c) => c.id)).toEqual(['aa'])
})

// Protects: a self-link is remapped at both ends to the same new node; the first paste is not shifted twice.
test('[C9] relative-of-fixed-case: self-link and the first paste', () => {
  const s = fromContent(content({ nodes: [node('a', { x: 3, y: 4 })], connections: [connection('aa', 'a', 'a')] }))
  let n = 0
  const pasted = buildPaste(copySelection(s, ['a']) as NonNullable<ReturnType<typeof copySelection>>, { projectId: 'p1', chapterId: 'c1' }, 1, () => `id${++n}`)
  const id = pasted.nodes[0]?.id
  expect(pasted.connections[0]).toMatchObject({ fromNodeId: id, toNodeId: id })
  expect(pasted.nodes[0]).toMatchObject({ x: 43, y: 44 })
})
