import { expect, test } from 'vitest'
import { orderWrites } from './ordering'

const rows = [{ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }, { id: 'c', sortOrder: 3 }]

// Protects: a simple insert or move writes one record's sort order.
test('one placement writes one sort order', () => {
  expect(orderWrites(rows, { kind: 'one', id: 'c', order: 1.5 })).toEqual([{ id: 'c', order: 1.5 }])
})

// Protects: a renumber sends only the records whose order changed, plus a new record that has none yet.
test('a renumber writes only the orders that changed', () => {
  const placement = { kind: 'renumber' as const, orders: [{ id: 'a', order: 1 }, { id: 'new', order: 2 }, { id: 'b', order: 3 }, { id: 'c', order: 4 }] }
  expect(orderWrites(rows, placement)).toEqual([{ id: 'new', order: 2 }, { id: 'b', order: 3 }, { id: 'c', order: 4 }])
})
