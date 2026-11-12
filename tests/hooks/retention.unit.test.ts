import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { cutoffIso } = require('../../backend/pb_hooks/lib/retention.js') as {
  cutoffIso: (nowMs: number, days: number) => string
}

// Protects design 6.9: retention is a setting and the cut-off must be exact, in the
// datetime text PocketBase stores, or a purge deletes too much or too little.
test('the cut-off is the given number of days before now, in PocketBase datetime text', () => {
  expect(cutoffIso(Date.UTC(2026, 10, 12, 8, 30, 0), 365)).toBe('2025-11-12 08:30:00.000Z')
})

test('the cut-off crosses a month boundary correctly', () => {
  expect(cutoffIso(Date.UTC(2026, 2, 1, 0, 0, 0), 1)).toBe('2026-02-28 00:00:00.000Z')
})

test('zero days means now', () => {
  expect(cutoffIso(Date.UTC(2026, 0, 1, 0, 0, 0), 0)).toBe('2026-01-01 00:00:00.000Z')
})
