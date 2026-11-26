import { expect, test } from 'vitest'
import { byOrder, insertAt, type Ordered, placeAt, renumber, sortOrderBetween } from './sortOrder'

const list = (...pairs: Array<[string, number]>): Ordered[] => pairs.map(([id, order]) => ({ id, order }))

// Protects: the first item, an item before the first and an item after the last get sensible orders.
test('sortOrderBetween handles an empty list and both ends', () => {
  expect(sortOrderBetween(null, null)).toBe(1)
  expect(sortOrderBetween(null, 4)).toBe(3)
  expect(sortOrderBetween(4, null)).toBe(5)
})

// Protects: a midpoint is used when there is room; "renumber" (null) when floats cannot split the gap.
test('sortOrderBetween returns null when there is no room', () => {
  expect(sortOrderBetween(1, 2)).toBe(1.5)
  expect(sortOrderBetween(2, 2)).toBeNull()
  expect(sortOrderBetween(3, 1)).toBeNull()
  expect(sortOrderBetween(1, 1 + Number.EPSILON)).toBeNull()
  expect(sortOrderBetween(Number.NaN, 1)).toBeNull()
})

// Protects: inserting 60 times in the same gap keeps the order (the review-focus case).
test('repeated inserts in one gap keep the order', () => {
  let items: Ordered[] = list(['a', 1], ['b', 2])
  const expected = ['a', 'b']
  let renumbered = false
  for (let i = 0; i < 60; i++) {
    const id = `n${i}`
    items.sort((x, y) => x.order - y.order) // insertAt takes the list in display order
    const placement = insertAt(items, id, 1)
    if (placement.kind === 'renumber') {
      renumbered = true
      items = placement.orders
    } else {
      items = [...items, { id, order: placement.order }]
    }
    expected.splice(1, 0, id)
    const sorted = [...items].sort((x, y) =>
      byOrder({ id: x.id, sortOrder: x.order }, { id: y.id, sortOrder: y.order }),
    )
    expect(sorted.map((x) => x.id)).toEqual(expected)
  }
  expect(renumbered).toBe(true)
})

// Protects: a renumber is 1..n and equal orders are told apart by id, so the order is stable.
test('renumber and byOrder', () => {
  expect(renumber(0)).toEqual([])
  expect(renumber(3)).toEqual([1, 2, 3])
  const tied = [
    { id: 'b', sortOrder: 1 },
    { id: 'a', sortOrder: 1 },
  ]
  expect(tied.sort(byOrder).map((t) => t.id)).toEqual(['a', 'b'])
})

// Protects: moving an item gives the new order, or a whole renumber, and refuses impossible moves.
test('placeAt moves an item and renumbers when there is no room', () => {
  const abc = list(['A', 1], ['B', 2], ['C', 3])
  expect(placeAt(abc, 'C', 0)).toEqual({ kind: 'one', id: 'C', order: 0 })
  expect(placeAt(abc, 'A', 2)).toEqual({ kind: 'one', id: 'A', order: 4 })
  expect(placeAt(abc, 'B', 1)).toBeNull()
  expect(placeAt(abc, 'X', 0)).toBeNull()
  expect(placeAt(abc, 'A', 3)).toBeNull()
  expect(placeAt(list(['A', 1], ['B', 1], ['C', 3]), 'C', 1)).toEqual({
    kind: 'renumber',
    orders: list(['A', 1], ['C', 2], ['B', 3]),
  })
})

// Protects: a new item lands at the asked place, or the whole list is renumbered with it included.
test('insertAt places a new item and renumbers when there is no room', () => {
  const ab = list(['A', 1], ['B', 2])
  expect(insertAt(ab, 'N', 1)).toEqual({ kind: 'one', id: 'N', order: 1.5 })
  expect(insertAt(ab, 'N', 0)).toEqual({ kind: 'one', id: 'N', order: 0 })
  expect(insertAt(ab, 'N', 9)).toEqual({ kind: 'one', id: 'N', order: 3 })
  expect(insertAt([], 'N', 0)).toEqual({ kind: 'one', id: 'N', order: 1 })
  expect(insertAt(list(['A', 1], ['B', 1]), 'N', 1)).toEqual({
    kind: 'renumber',
    orders: list(['A', 1], ['N', 2], ['B', 3]),
  })
})
