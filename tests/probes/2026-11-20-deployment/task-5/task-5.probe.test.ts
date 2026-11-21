import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { shouldWarn, warningSubject, DAY_MS } = require('../../../../backend/pb_hooks/lib/storage-warning.js') as {
  shouldWarn: (u: number, l: number, last: number | null, now: number) => boolean
  warningSubject: (u: number, l: number) => string
  DAY_MS: number
}
const T = Date.UTC(2026, 10, 20, 12)

// Protects: the day constant the once-a-day promise rests on.
test('[C1] numeric-extremes: DAY_MS is exactly 24 hours', () => {
  expect(DAY_MS).toBe(86400000)
})

// Protects: over/under at the exact limit, and a negative or zero limit meaning off.
test('[C1] boundary-inputs: the limit comparison and the off switch', () => {
  expect(shouldWarn(101, 100, null, T)).toBe(true)
  expect(shouldWarn(100, 100, null, T)).toBe(false)
  expect(shouldWarn(99, 100, null, T)).toBe(false)
  expect(shouldWarn(0, 0, null, T)).toBe(false)
  expect(shouldWarn(5, 0, null, T)).toBe(false)
  expect(shouldWarn(5, -1, null, T)).toBe(false)
  expect(shouldWarn(Number.MAX_SAFE_INTEGER, 1, null, T)).toBe(true)
})

// Protects: the 24 hour window edges, and a last-warned time in the future (clock skew) not re-warning.
test('[C1] boundary-inputs: the 24 hour window', () => {
  expect(shouldWarn(101, 100, T - DAY_MS + 1, T)).toBe(false)
  expect(shouldWarn(101, 100, T - DAY_MS, T)).toBe(true)
  expect(shouldWarn(101, 100, T - DAY_MS - 1, T)).toBe(true)
  expect(shouldWarn(101, 100, T, T)).toBe(false)
  expect(shouldWarn(101, 100, T + 1000, T)).toBe(false)
  expect(shouldWarn(101, 100, 0, T)).toBe(true)
})

// Protects: under the limit never warns however old the last warning.
test('[C1] order-and-duplicates: under the limit never warns, whatever the history', () => {
  for (const last of [null, 0, T - 10 * DAY_MS, T]) expect(shouldWarn(50, 100, last, T)).toBe(false)
})

// Protects: the exact subject copy with formatBytes units.
test('[C1] numeric-extremes: the subject uses formatBytes for both numbers', () => {
  expect(warningSubject(2147483648, 1073741824)).toBe('KWNTO storage warning: 2.0 GB of 1.0 GB used')
  expect(warningSubject(21474836481, 21474836480)).toBe('KWNTO storage warning: 20.0 GB of 20.0 GB used')
  expect(warningSubject(1048576 * 5, 1048576)).toBe('KWNTO storage warning: 5.0 MB of 1.0 MB used')
  expect(warningSubject(2048, 1024)).toBe('KWNTO storage warning: 2 KB of 1 KB used')
})
