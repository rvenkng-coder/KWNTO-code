import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The pure parts of the version-guarded update (decision 0002, option 2).
// guardedTable picks the table name the guard puts into its SQL, so only the seven
// content collections may pass; changedFields decides which fields the guard copies
// onto the freshly read record, so version and timestamps must never be among them;
// parseSentVersion decides whether the client sent a usable version at all.

const require = createRequire(import.meta.url)
const { guardedTable, changedFields, parseSentVersion } = require('../../backend/pb_hooks/lib/content-guard.js') as {
  guardedTable: (name: string) => string
  changedFields: (names: string[], read: (n: string) => unknown, readOriginal: (n: string) => unknown) => string[]
  parseSentVersion: (value: unknown) => number | null
}

function readers(
  now: Record<string, unknown>,
  before: Record<string, unknown>,
): [(n: string) => unknown, (n: string) => unknown] {
  return [(n) => now[n], (n) => before[n]]
}

// Protects the SQL table name: anything outside the seven, including an injection
// string, must throw rather than reach the query.
test('guardedTable accepts only the content collections', () => {
  expect(guardedTable('nodes')).toBe('nodes')
  expect(() => guardedTable('users')).toThrow('not a guarded collection: users')
  expect(() => guardedTable('nodes; DROP TABLE x')).toThrow('not a guarded collection: nodes; DROP TABLE x')
})

// Protects per-attribute saving: only fields that really differ are written, so a
// concurrent edit of another field is not overwritten with a stale copy.
test('changedFields lists only the fields that differ', () => {
  const [read, original] = readers({ title: 'New', x: 10, version: 4 }, { title: 'Old', x: 10, version: 3 })
  expect(changedFields(['title', 'x', 'version'], read, original)).toEqual(['title'])
})

// Protects the counter: the guard sets version itself; a client's version or
// timestamps must never be copied onto the stored record.
test('version and timestamps are never changed fields', () => {
  const [read, original] = readers(
    { id: 'a', version: 9, created: 'c', updated: '2026-11-14 10:00:01.000Z' },
    { id: 'a', version: 2, created: 'c', updated: '2026-11-14 10:00:00.000Z' },
  )
  expect(changedFields(['id', 'version', 'created', 'updated'], read, original)).toEqual([])
})

// Protects the 400 "version is required" answer: only whole numbers from 0 are a version.
test('parseSentVersion accepts only whole numbers from 0', () => {
  expect(parseSentVersion(0)).toBe(0)
  expect(parseSentVersion(7)).toBe(7)
  for (const bad of [-1, 1.5, '3', null, undefined, Number.NaN]) {
    expect(parseSentVersion(bad)).toBeNull()
  }
})
