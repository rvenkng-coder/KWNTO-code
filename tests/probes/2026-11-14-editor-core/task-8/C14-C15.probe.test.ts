import { expect, test } from 'vitest'
import { insertAt, placeAt } from '../../../../frontend/src/features/editor/model/sortOrder'

const l = (...p: Array<[string, number]>) => p.map(([id, order]) => ({ id, order }))

// Protects: moving down in the middle takes the midpoint of the new neighbours.
test('[C14] two-bad-items: moving A between C and D', () => {
  expect(placeAt(l(['A', 1], ['B', 2], ['C', 3], ['D', 4]), 'A', 2)).toEqual({ kind: 'one', id: 'A', order: 3.5 })
})

// Protects: a one-item list and negative or fractional indexes have nowhere to move.
test('[C14] empty-one-huge: nothing to move in a short list', () => {
  expect(placeAt(l(['A', 1]), 'A', 0)).toBeNull()
  expect(placeAt([], 'A', 0)).toBeNull()
  expect(placeAt(l(['A', 1], ['B', 2]), 'A', -1)).toBeNull()
  expect(placeAt(l(['A', 1], ['B', 2]), 'A', 0.5)).toBeNull()
})

// Protects: the input list is never changed by a move or an insert.
test('[C14] helper-hides-bug: the given list is not mutated', () => {
  const list = l(['A', 1], ['B', 2], ['C', 3])
  placeAt(list, 'C', 0)
  insertAt(list, 'N', 1)
  expect(list).toEqual(l(['A', 1], ['B', 2], ['C', 3]))
})

// Protects: a negative index inserts at the front; a renumber at the front keeps every id once.
test('[C15] two-bad-items: negative index and a tied front', () => {
  expect(insertAt(l(['A', 1], ['B', 2]), 'N', -4)).toEqual({ kind: 'one', id: 'N', order: 0 })
  const r = insertAt(l(['A', Number.NaN], ['B', 2]), 'N', 1)
  expect(r).toEqual({ kind: 'renumber', orders: l(['A', 1], ['N', 2], ['B', 3]) })
})
