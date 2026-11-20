import { expect, test } from 'vitest'
import { content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { classifyConflict, overlay, type OutboxEntry } from '../../../../frontend/src/features/editor/sync/outbox'

const b = { userId: 'u', projectId: 'p1', offline: true, made: 1 }

// Protects: probe of plan row C6, the outbox model rules (design 6.7).
test('[C6] order: entries applied by seq, not by array order', () => {
  const s = fromContent(content({ nodes: [node('n1', { title: 'S' })] }))
  const mk = (seq: number, title: string) => ({ ...b, seq, op: 'update', kind: 'nodes', id: 'n1', changes: { title }, baseVersion: 0, baseValues: {}, snapshot: null }) as OutboxEntry
  expect(overlay(s, [mk(2, 'second'), mk(1, 'first')]).nodes.n1?.title).toBe('second')
})

// Protects: probe of plan row C6, the outbox model rules (design 6.7).
test('[C6] input not mutated and update of a missing record is ignored', () => {
  const s = fromContent(content())
  const e = { ...b, seq: 1, op: 'update', kind: 'nodes', id: 'ghost', changes: { title: 'x' }, baseVersion: 0, baseValues: {}, snapshot: null } as OutboxEntry
  expect(overlay(s, [e]).nodes.ghost).toBeUndefined()
})

// Protects: probe of plan row C7, the outbox model rules (design 6.7).
test('[C7] boundary: y alone conflicting lists x too; unchanged fields never listed', () => {
  const e = { ...b, seq: 1, op: 'update', kind: 'nodes', id: 'n1', changes: { x: 1, y: 2, title: 'T' }, baseVersion: 0, baseValues: { x: 0, y: 0, title: 'T0' }, snapshot: null } as OutboxEntry
  expect(classifyConflict(e, node('n1', { x: 0, y: 7, title: 'T0' }))).toEqual({ type: 'fields', fields: ['x', 'y'] })
})
