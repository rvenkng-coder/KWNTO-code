import { createRequire } from 'node:module'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)
type LogEvent = (app: FakeApp, type: string, userId: string, ip: string, detail: object) => void
const { logEvent } = require('../../backend/pb_hooks/lib/security-log.js') as { logEvent: LogEvent }

// Stands in for PocketBase's global Record class, which the hook runtime provides.
class FakeRecord {
  values: { [field: string]: unknown } = {}
  collection: unknown
  constructor(collection: unknown) {
    this.collection = collection
  }
  set(field: string, value: unknown) {
    this.values[field] = value
  }
}

type FakeApp = { findCollectionByNameOrId: (name: string) => unknown; save: (record: FakeRecord) => void }

const runtime = globalThis as unknown as { Record?: unknown }

beforeEach(() => {
  runtime.Record = FakeRecord
})

afterEach(() => {
  delete runtime.Record
  vi.restoreAllMocks()
})

// Protects docs/security.md section 8: each event lands in security_events with its fields.
test('logEvent saves one security_events record with the given fields', () => {
  const saved: FakeRecord[] = []
  const app: FakeApp = { findCollectionByNameOrId: (name) => ({ name }), save: (record) => saved.push(record) }

  logEvent(app, 'failure', 'user123', '203.0.113.7', { reason: 'wrong password' })

  expect(saved).toHaveLength(1)
  expect(saved[0]?.collection).toEqual({ name: 'security_events' })
  expect(saved[0]?.values).toEqual({ type: 'failure', user: 'user123', ip: '203.0.113.7', detail: { reason: 'wrong password' } })
})

// Protects the logEvent contract "never throws": a logging failure must not block a
// sign-in or a join; it is reported on the server console instead.
test('logEvent reports a failed save on the console and does not throw', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const app: FakeApp = {
    findCollectionByNameOrId: (name) => ({ name }),
    save: () => {
      throw new Error('database is locked')
    },
  }

  expect(() => logEvent(app, 'sign-in', '', '203.0.113.7', {})).not.toThrow()
  expect(consoleError).toHaveBeenCalledOnce()
  expect(String(consoleError.mock.calls[0])).toContain('database is locked')
})
