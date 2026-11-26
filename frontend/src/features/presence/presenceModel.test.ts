import { expect, test } from 'vitest'
import type { PresenceRow } from '../../backend'
import { activeEditors, editingLabel, editorsOf } from './presenceModel'

const row = (id: string, userId: string, userName: string, nodeId = 'n1', field = 'title'): PresenceRow => ({
  id,
  userId,
  userName,
  nodeId,
  field,
})

// Protects D14: a row counts while THIS browser last received it less than the timeout ago
// (its own clock, so clock skew between machines cannot matter); a row never received counts
// for nothing; the viewer's own row is dropped; names are listed sorted, by node or by field;
// the label follows the number of people.
test('only fresh rows of other people show as editing', () => {
  const rows = [row('r0', 'me', 'Me'), row('r1', 'u1', 'Ana'), row('r2', 'u2', 'Ben'), row('r3', 'u3', 'Cy')]
  const seenAt = { r0: 99_000, r1: 90_000, r2: 69_000 }
  const active = activeEditors(rows, seenAt, 100_000, 30_000, 'me')
  expect(active.map((r) => r.userName)).toEqual(['Ana'])
  expect(activeEditors(rows, { ...seenAt, r2: 70_001 }, 100_000, 30_000, 'me').map((r) => r.userName)).toEqual([
    'Ana',
    'Ben',
  ])
  expect(activeEditors(rows, { ...seenAt, r2: 70_000 }, 100_000, 30_000, 'me').map((r) => r.userName)).toEqual(['Ana'])

  expect(editorsOf(active, 'n1')).toEqual(['Ana'])
  expect(editorsOf(active, 'n1', 'title')).toEqual(['Ana'])
  expect(editorsOf(active, 'n1', 'line:x')).toEqual([])
  expect(editorsOf(active, 'n2')).toEqual([])
  const two = [row('a', 'u1', 'Zed'), row('b', 'u2', 'Ann', 'n1', 'line:1')]
  expect(editorsOf(two, 'n1')).toEqual(['Ann', 'Zed'])

  expect([
    editingLabel([]),
    editingLabel(['Ana']),
    editingLabel(['Ana', 'Ben']),
    editingLabel(['Ana', 'Ben', 'Cy']),
  ]).toEqual(['', 'Ana is editing', 'Ana and Ben are editing', 'Ana and 2 others are editing'])
})
