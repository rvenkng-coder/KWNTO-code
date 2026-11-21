import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { serverDeletedAt, isExpired } = require('../../../../backend/pb_hooks/lib/trash.js') as {
  serverDeletedAt: (sent: unknown, nowIso: string) => string
  isExpired: (deletedAtIso: string, cutoffIso: string) => boolean
}
const N = '2026-11-20 10:00:00.000Z'

// Protects: probe of plan row C1, the server's own trash time (design 6.8, Review Focus 2).
test('[C1] boundary: undefined restores, any other text is replaced by the server time', () => {
  expect(serverDeletedAt(undefined, N)).toBe('')
  expect(serverDeletedAt('2099-01-01 00:00:00.000Z', N)).toBe(N)
  expect(serverDeletedAt(' ', N)).toBe(N)
})

// Protects: probe of plan row C1, expiry is strictly older than the cut-off.
test('[C1] boundary: ISO strings compare in time order and empty never expires', () => {
  expect(isExpired('2026-10-20 10:00:00.000Z', '2026-10-21 10:00:00.000Z')).toBe(true)
  expect(isExpired('2026-10-21 10:00:00.001Z', '2026-10-21 10:00:00.000Z')).toBe(false)
  expect(isExpired('', '2099-01-01 00:00:00.000Z')).toBe(false)
})
