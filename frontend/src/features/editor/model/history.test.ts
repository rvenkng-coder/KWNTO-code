import { expect, test } from 'vitest'
import { content, line, node } from './fixtures'
import { canApply, EMPTY_HISTORY, HISTORY_DEPTH, invert, recordStep, takeRedo, takeUndo, type Change, type History, type Step } from './history'
import { fromContent } from './state'

const rename = (label: string, from: string, to: string): Step =>
  ({ label, changes: [{ type: 'update', kind: 'nodes', id: 'n1', before: { title: from }, after: { title: to } }] })

// Protects: design 8b, D5: at most one hundred steps are kept (the oldest go), and a new edit clears redo.
test('history keeps one hundred steps and a new edit clears redo', () => {
  let h: History = EMPTY_HISTORY
  for (let i = 0; i < 105; i++) h = recordStep(h, rename(`s${i}`, `t${i}`, `t${i + 1}`))
  expect(h.past).toHaveLength(HISTORY_DEPTH)
  expect(h.past[0]?.label).toBe('s5')
  const undone = takeUndo(h)
  expect(undone?.history.future).toHaveLength(1)
  h = recordStep((undone as { history: History }).history, rename('new', 'a', 'b'))
  expect(h.future).toEqual([])
  expect(h.past.at(-1)?.label).toBe('new')
  expect(recordStep(h, { label: 'empty', changes: [] })).toBe(h)
})

// Protects: undo applies the step backwards: last change first, updates swapped, create and remove swapped.
test('invert reverses a step', () => {
  const l = line('l1')
  const step: Step = {
    label: 'mixed',
    changes: [
      { type: 'update', kind: 'nodes', id: 'n1', before: { title: 'A' }, after: { title: 'B' } },
      { type: 'create', kind: 'script_lines', record: l },
      { type: 'remove', kind: 'cues', record: { id: 'q1', projectId: 'p1', nodeId: 'n1', type: 'other', text: '', sortOrder: 1, version: 0 } },
    ],
  }
  const inv = invert(step)
  expect(inv.label).toBe('mixed')
  expect(inv.changes.map((c) => c.type)).toEqual(['create', 'remove', 'update'])
  expect(inv.changes[1]).toEqual({ type: 'remove', kind: 'script_lines', record: l })
  expect(inv.changes[2]).toEqual({ type: 'update', kind: 'nodes', id: 'n1', before: { title: 'B' }, after: { title: 'A' } })
})

// Protects: undo and redo walk the history in order; nothing to undo or redo gives null.
test('undo and redo walk the history in order', () => {
  expect(takeUndo(EMPTY_HISTORY)).toBeNull()
  expect(takeRedo(EMPTY_HISTORY)).toBeNull()
  const a = rename('A', 'x', 'y')
  const b = rename('B', 'y', 'z')
  const h = recordStep(recordStep(EMPTY_HISTORY, a), b)
  const first = takeUndo(h)
  expect(first?.step).toEqual(invert(b))
  const second = takeUndo((first as { history: History }).history)
  expect(second?.step).toEqual(invert(a))
  expect(takeUndo((second as { history: History }).history)).toBeNull()
  const again = takeRedo((second as { history: History }).history)
  expect(again?.step).toEqual(a)
  expect(again?.history.past).toEqual([a])
  expect(again?.history.future).toEqual([b])
})

// Protects: D5 and Review Focus 4: a change whose fields someone else touched since cannot be applied.
test('a change someone else has touched since cannot be applied', () => {
  const update: Change = { type: 'update', kind: 'nodes', id: 'n1', before: { title: 'Y' }, after: { title: 'X' } }
  const now = (title: string) => fromContent(content({ nodes: [node('n1', { title })], lines: [line('l1', { text: 'edited' })] }))
  expect(canApply(update, now('Z'))).toBe(false)
  expect(canApply(update, now('Y'))).toBe(true)
  expect(canApply({ ...update, id: 'gone' }, now('Y'))).toBe(false)
  expect(canApply({ type: 'remove', kind: 'script_lines', record: line('l1', { text: 'original' }) }, now('Y'))).toBe(false)
  expect(canApply({ type: 'remove', kind: 'script_lines', record: line('l1', { text: 'edited', version: 7 }) }, now('Y'))).toBe(true)
  expect(canApply({ type: 'remove', kind: 'script_lines', record: line('l9') }, now('Y'))).toBe(false)
  expect(canApply({ type: 'create', kind: 'script_lines', record: line('l1') }, now('Y'))).toBe(false)
  expect(canApply({ type: 'create', kind: 'script_lines', record: line('l2') }, now('Y'))).toBe(true)
})
