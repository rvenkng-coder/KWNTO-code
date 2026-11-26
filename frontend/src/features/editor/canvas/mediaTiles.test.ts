import { expect, test } from 'vitest'
import { rowOf, tilesThatFit } from './mediaTiles'

// Protects: C1, the number of tiles that fit counts the gaps between them and is never below one.
test('tilesThatFit counts tiles and gaps, and never returns less than one', () => {
  expect(tilesThatFit(176, 56, 4)).toBe(3)
  expect(tilesThatFit(172, 56, 4)).toBe(2)
  expect(tilesThatFit(10, 56, 4)).toBe(1)
})

// Protects: C2, when the media do not all fit the last place holds "+N more", and N counts every media not shown.
test('rowOf keeps a place for the "+N more" tile only when something is hidden', () => {
  expect(rowOf(3, 3)).toEqual({ shown: 3, hidden: 0 })
  expect(rowOf(5, 3)).toEqual({ shown: 2, hidden: 3 })
  expect(rowOf(5, 1)).toEqual({ shown: 1, hidden: 4 })
  expect(rowOf(0, 2)).toEqual({ shown: 0, hidden: 0 })
})
