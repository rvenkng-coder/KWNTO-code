import { createRequire } from 'node:module'
import { afterEach, beforeEach, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
type EnsureUserRecords = (app: FakeApp, userId: string) => void
const { ensureUserRecords } = require('../../backend/pb_hooks/lib/user-records.js') as { ensureUserRecords: EnsureUserRecords }

// Stands in for PocketBase's global Record class, which the hook runtime provides.
class FakeRecord {
  values: { [field: string]: unknown } = {}
  collection: { name: string }
  constructor(collection: { name: string }) {
    this.collection = collection
  }
  set(field: string, value: unknown) {
    this.values[field] = value
  }
}

// A tiny in-memory store with just the app methods the helper uses.
class FakeApp {
  rows: FakeRecord[] = []
  findCollectionByNameOrId(name: string) {
    return { name }
  }
  findRecordsByFilter(collection: string, _filter: string, _sort: string, _limit: number, _offset: number, params: { user: string }) {
    return this.rows.filter((row) => row.collection.name === collection && row.values.user === params.user)
  }
  save(record: FakeRecord) {
    if (!this.rows.includes(record)) this.rows.push(record)
  }
}

const runtime = globalThis as unknown as { Record?: unknown }

beforeEach(() => {
  runtime.Record = FakeRecord
})

afterEach(() => {
  delete runtime.Record
})

function rowsFor(app: FakeApp, collection: string, userId: string) {
  return app.findRecordsByFilter(collection, '', '', 0, 0, { user: userId }).map((row) => row.values)
}

// Protects design 7c and the ERD: every account has one row in each per-user table,
// with the documented defaults (dark theme, minimap on, no quota override, not blocked).
test('ensureUserRecords creates the three rows with their defaults', () => {
  const app = new FakeApp()
  ensureUserRecords(app, 'user1')

  expect(rowsFor(app, 'user_preferences', 'user1')).toEqual([{ user: 'user1', theme: 'dark', minimap_visible: true }])
  expect(rowsFor(app, 'user_limits', 'user1')).toEqual([{ user: 'user1' }])
  expect(rowsFor(app, 'user_status', 'user1')).toEqual([{ user: 'user1', blocked: false }])
})

// Protects the helper's contract "idempotent": it also runs at sign-in (Task 4), so a
// second call must not add rows, and must never undo a theme choice or an admin's block.
test('ensureUserRecords never adds a second row or changes an existing one', () => {
  const app = new FakeApp()
  ensureUserRecords(app, 'user1')
  const status = app.rows.find((row) => row.collection.name === 'user_status')
  status?.set('blocked', true)

  ensureUserRecords(app, 'user1')

  expect(app.rows).toHaveLength(3)
  expect(rowsFor(app, 'user_status', 'user1')).toEqual([{ user: 'user1', blocked: true }])
})

// Protects repair at sign-in: a user missing only some rows gets just those back.
test('ensureUserRecords fills in only the missing rows', () => {
  const app = new FakeApp()
  ensureUserRecords(app, 'user1')
  app.rows = app.rows.filter((row) => row.collection.name !== 'user_limits')

  ensureUserRecords(app, 'user1')

  expect(rowsFor(app, 'user_limits', 'user1')).toEqual([{ user: 'user1' }])
  expect(app.rows).toHaveLength(3)
})
