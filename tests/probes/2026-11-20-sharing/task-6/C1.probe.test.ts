import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { staleCutoffIso } = require('../../../../backend/pb_hooks/lib/presence.js') as { staleCutoffIso: (nowMs: number, timeoutSeconds: number) => string }
const NOW = Date.parse('2026-11-20T12:00:00.000Z')

// Protects: probe of plan row C1, a row is stale after twice the timeout, in PocketBase's text format.
test('[C1] equivalence: 30 s timeout gives a cut-off 60 s back, as "YYYY-MM-DD HH:mm:ss.SSSZ"', () => {
  expect(staleCutoffIso(NOW, 30)).toBe('2026-11-20 11:59:00.000Z')
  expect(staleCutoffIso(NOW, 30)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})

// Protects: probe of plan row C1, a timeout of 0 means "now", and a cut-off sorts as text with `updated`.
test('[C1] boundary: timeout 0 is the same instant; the text sorts in time order across a day boundary', () => {
  expect(staleCutoffIso(NOW, 0)).toBe('2026-11-20 12:00:00.000Z')
  expect(staleCutoffIso(Date.parse('2026-11-21T00:00:10.000Z'), 30)).toBe('2026-11-20 23:59:10.000Z')
  expect(staleCutoffIso(NOW, 1) > staleCutoffIso(NOW, 2)).toBe(true)
})

// Protects: probe of plan row C1, the setting is read in seconds, not milliseconds; fractions keep their milliseconds.
test('[C1] boundary: a large timeout and a fractional one', () => {
  expect(staleCutoffIso(NOW, 3600)).toBe('2026-11-20 10:00:00.000Z')
  expect(staleCutoffIso(NOW, 0.5)).toBe('2026-11-20 11:59:59.000Z')
})
