import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { shouldWarn, warningSubject, DAY_MS } = require('../../backend/pb_hooks/lib/storage-warning.js') as {
  shouldWarn: (usedBytes: number, limitBytes: number, lastWarnedMs: number | null, nowMs: number) => boolean
  warningSubject: (usedBytes: number, limitBytes: number) => string
  DAY_MS: number
}

const T = Date.UTC(2026, 10, 20, 12, 0, 0)

// Protects design 7c and plan D12: the admin is warned when the total passes the limit,
// never at exactly the limit, never when the warning is off (limit 0), and at most
// once a day. Each row pins one comparison; the day boundary counts as a new day.
test('the storage warning fires over the limit at most once a day', () => {
  expect(DAY_MS).toBe(86400000)
  expect(shouldWarn(101, 100, null, T), 'over the limit, never warned').toBe(true)
  expect(shouldWarn(100, 100, null, T), 'exactly at the limit').toBe(false)
  expect(shouldWarn(101, 0, null, T), 'limit 0 turns the warning off').toBe(false)
  expect(shouldWarn(101, 100, T - DAY_MS + 1, T), 'warned a moment less than a day ago').toBe(false)
  expect(shouldWarn(101, 100, T - DAY_MS, T), 'warned exactly a day ago').toBe(true)
  expect(warningSubject(2147483648, 1073741824)).toBe('KWNTO storage warning: 2.0 GB of 1.0 GB used')
})
