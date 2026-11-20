import { expect, test } from 'vitest'
import { planAdd, type NewEntry, type OutboxEntry } from '../../../../frontend/src/features/editor/sync/outbox'

const b = { userId: 'u', projectId: 'p1', offline: false, made: 1 }

// Protects: probe of plan row C4, the outbox model rules (design 6.7).
test('[C4] second-bad-item: update of the same id but a different kind does not merge', () => {
  const q = [{ ...b, seq: 1, op: 'update', kind: 'nodes', id: 'x', changes: { title: 'B' }, baseVersion: 1, baseValues: { title: 'A' }, snapshot: null }] as OutboxEntry[]
  const e = { ...b, op: 'update', kind: 'chapters', id: 'x', changes: { title: 'C' }, baseVersion: 2, baseValues: { title: 'B' }, snapshot: null } as NewEntry
  expect(planAdd(q, e, null).replace).toBeNull()
})

// Protects: probe of plan row C4, the outbox model rules (design 6.7).
test('[C4] offline flag: merged entry is offline when only the newer one is', () => {
  const q = [{ ...b, seq: 1, op: 'update', kind: 'nodes', id: 'x', changes: { title: 'B' }, baseVersion: 1, baseValues: { title: 'A' }, snapshot: null }] as OutboxEntry[]
  const e = { ...b, offline: true, op: 'update', kind: 'nodes', id: 'x', changes: { title: 'C' }, baseVersion: 2, baseValues: { title: 'B' }, snapshot: null } as NewEntry
  expect(planAdd(q, e, null).replace?.offline).toBe(true)
})

// Protects: probe of plan row C5, the outbox model rules (design 6.7).
test('[C5] remove of an unrelated record drops nothing', () => {
  const q = [{ ...b, seq: 1, op: 'create', kind: 'cues', id: 'c1', record: { id: 'c1' } }] as unknown as OutboxEntry[]
  const e = { ...b, op: 'remove', kind: 'cues', id: 'c2', record: { id: 'c2' } } as unknown as NewEntry
  const plan = planAdd(q, e, null)
  expect(plan.drop).toEqual([])
  expect(plan.append).toEqual(e)
})
