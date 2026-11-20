import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { serverDeletedAt, isExpired } = require('../../backend/pb_hooks/lib/trash.js') as {
  serverDeletedAt: (sent: string | null | undefined, nowIso: string) => string
  isExpired: (deletedAtIso: string, cutoffIso: string) => boolean
}

const NOW = '2026-11-20 10:00:00.000Z'
const CUTOFF = '2026-10-21 10:00:00.000Z'

// Protects design 6.8 and plan D11 (Review Focus 2): the server's own time is the trash
// time, so a wrong browser clock cannot make a teammate's work expire early; an empty
// value (a restore) stays empty; only items strictly older than the cut-off expire.
test('the server\'s own time is used and only older items expire', () => {
  expect(serverDeletedAt('', NOW)).toBe('')
  expect(serverDeletedAt(null, NOW)).toBe('')
  expect(serverDeletedAt(undefined, NOW)).toBe('')
  expect(serverDeletedAt('1970-01-01 00:00:00.000Z', NOW)).toBe(NOW)

  expect(isExpired('', CUTOFF)).toBe(false)
  expect(isExpired(CUTOFF, CUTOFF)).toBe(false)
  expect(isExpired('2026-10-21 09:59:59.999Z', CUTOFF)).toBe(true)
  expect(isExpired('2026-10-21 10:00:00.001Z', CUTOFF)).toBe(false)
})
