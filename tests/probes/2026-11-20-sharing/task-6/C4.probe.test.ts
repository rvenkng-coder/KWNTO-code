import { expect, test } from 'vitest'
import type { PresenceRow } from '../../../../frontend/src/backend'
import { activeEditors, editingLabel, editorsOf } from '../../../../frontend/src/features/presence/presenceModel'

const row = (id: string, userId: string, userName: string, nodeId = 'n1', field = 'title'): PresenceRow => ({ id, userId, userName, nodeId, field })
const NOW = 100_000
const TIMEOUT = 30_000
const rows = [row('r0', 'me', 'Me'), row('r1', 'ana', 'Ana'), row('r2', 'ben', 'Ben'), row('r3', 'cy', 'Cy')]

// Protects: probe of plan row C4, fresh rows of other people, not self, not stale, not never-seen.
test('[C4] equivalence: self, a row seen 31 s ago and a row never seen are left out', () => {
  const seenAt = { r0: NOW, r1: NOW - 10_000, r2: NOW - 31_000 }
  expect(activeEditors(rows, seenAt, NOW, TIMEOUT, 'me').map((r) => r.userName)).toEqual(['Ana'])
})

// Protects: probe of plan row C4, the cut is exact: still shown just under the timeout, gone at it.
test('[C4] boundary: seen 29,999 ms ago shows; exactly 30,000 ms ago does not', () => {
  expect(activeEditors([rows[1]!], { r1: NOW - 29_999 }, NOW, TIMEOUT, 'me')).toHaveLength(1)
  expect(activeEditors([rows[1]!], { r1: NOW - 30_000 }, NOW, TIMEOUT, 'me')).toHaveLength(0)
})

// Protects: probe of plan row C4 / D14, freshness uses this browser's receive time, so a seenAt of 0 is a real time (not "never").
test('[C4] boundary: seenAt 0 counts as seen at time 0', () => {
  expect(activeEditors([rows[1]!], { r1: 0 }, 10, TIMEOUT, 'me')).toHaveLength(1)
  expect(activeEditors([rows[1]!], {}, 10, TIMEOUT, 'me')).toHaveLength(0)
})

// Protects: probe of plan row C4, the node and field filters, sorted names.
test('[C4] equivalence: editorsOf by node and by field returns sorted names', () => {
  const active = [row('a', 'u1', 'Zed', 'n1', 'title'), row('b', 'u2', 'Ana', 'n1', 'line'), row('c', 'u3', 'Ben', 'n2', 'title')]
  expect(editorsOf(active, 'n1')).toEqual(['Ana', 'Zed'])
  expect(editorsOf(active, 'n1', 'title')).toEqual(['Zed'])
  expect(editorsOf(active, 'n1', 'choice')).toEqual([])
  expect(editorsOf(active, 'missing')).toEqual([])
  expect(editorsOf([], 'n1')).toEqual([])
})

// Protects: probe of plan row C4, exact copy of the indicator for 0, 1, 2, 3 and 5 names.
test('[C4] boundary: editingLabel for 0, 1, 2, 3 and 5 names', () => {
  expect(editingLabel([])).toBe('')
  expect(editingLabel(['Ana'])).toBe('Ana is editing')
  expect(editingLabel(['Ana', 'Ben'])).toBe('Ana and Ben are editing')
  expect(editingLabel(['Ana', 'Ben', 'Cy'])).toBe('Ana and 2 others are editing')
  expect(editingLabel(['A', 'B', 'C', 'D', 'E'])).toBe('A and 4 others are editing')
})
