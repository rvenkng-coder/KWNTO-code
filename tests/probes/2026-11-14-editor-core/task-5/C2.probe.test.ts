import { expect, test } from 'vitest'
import { guard, readers } from './helpers'

// Protects: two changed fields are both reported, not only the first.
test('[C2] two-bad-items: two changed fields are both listed', () => {
  const [read, orig] = readers({ title: 'b', position: 2, x: 1 }, { title: 'a', position: 1, x: 1 })
  expect(guard.changedFields(['title', 'x', 'position'], read, orig).sort()).toEqual(['position', 'title'])
})

// Protects: a change after an unchanged field is still seen.
test('[C2] second-bad-item: a change in the last field is listed', () => {
  const [read, orig] = readers({ a: 1, b: 2, c: 'new' }, { a: 1, b: 2, c: 'old' })
  expect(guard.changedFields(['a', 'b', 'c'], read, orig)).toEqual(['c'])
})

// Protects: values are compared by content, not identity, and type changes count.
test('[C2] helper-hides-bug: equal objects are unchanged, 1 and "1" differ', () => {
  const [read, orig] = readers({ meta: { k: [1, 2] }, n: '1', flag: false }, { meta: { k: [1, 2] }, n: 1, flag: false })
  expect(guard.changedFields(['meta', 'n', 'flag'], read, orig)).toEqual(['n'])
})

// Protects: no fields and nothing changed give an empty list.
test('[C2] empty-one-huge: empty field list and identical records give []', () => {
  const [read, orig] = readers({ a: 1 }, { a: 1 })
  expect(guard.changedFields([], read, orig)).toEqual([])
  expect(guard.changedFields(['a'], read, orig)).toEqual([])
})

// Protects: a cleared value (set to empty) counts as a change.
test('[C2] stale-after-change: clearing a value is a change', () => {
  const [read, orig] = readers({ deleted_at: '' }, { deleted_at: '2026-11-14 10:00:00.000Z' })
  expect(guard.changedFields(['deleted_at'], read, orig)).toEqual(['deleted_at'])
})
