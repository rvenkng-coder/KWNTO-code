import { expect, test } from 'vitest'
import { newId } from '../../../../frontend/src/features/editor/model/ids'
import { byOrder, renumber, sortOrderBetween } from '../../../../frontend/src/features/editor/model/sortOrder'

// Protects: ids use only the alphabet even when every byte value is mapped.
test('[C1] helper-hides-bug: every byte value maps into a-z0-9', () => {
  const all = newId((bytes) => { bytes.forEach((_, i) => { bytes[i] = (i * 17) % 256 }); return bytes })
  expect(all).toMatch(/^[a-z0-9]{15}$/)
  expect(newId((bytes) => bytes.fill(0))).toBe('000000000000000')
  expect(newId((bytes) => bytes.fill(35))).toBe('zzzzzzzzzzzzzzz')
  expect(newId((bytes) => bytes.fill(36))).toBe('000000000000000')
})

// Protects: ends with negative and fractional neighbours.
test('[C2] empty-one-huge: ends work for negative, zero and huge neighbours', () => {
  expect(sortOrderBetween(null, 0)).toBe(-1)
  expect(sortOrderBetween(-3, null)).toBe(-2)
  expect(sortOrderBetween(null, 1e15)).toBe(1e15 - 1)
})

// Protects: infinities and an unordered pair are "renumber", never a bad order.
test('[C3] two-bad-items: infinite and reversed neighbours ask for a renumber', () => {
  expect(sortOrderBetween(Number.POSITIVE_INFINITY, 1)).toBeNull()
  expect(sortOrderBetween(1, Number.NaN)).toBeNull()
  expect(sortOrderBetween(0.1, 0.2)).toBeCloseTo(0.15)
  expect(sortOrderBetween(-2, -1)).toBe(-1.5)
})

// Protects: renumber of negative counts is empty and ties by id are stable both ways.
test('[C5] case-and-whitespace: byOrder ties break by id, not by input order', () => {
  expect(renumber(-2)).toEqual([])
  const a = { id: 'a', sortOrder: 2 }
  const b = { id: 'b', sortOrder: 2 }
  expect([a, b].sort(byOrder)).toEqual([a, b])
  expect([b, a].sort(byOrder)).toEqual([a, b])
  expect(byOrder({ id: 'z', sortOrder: 1 }, { id: 'a', sortOrder: 2 })).toBeLessThan(0)
})
