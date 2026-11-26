import { expect, test } from 'vitest'
import { isOffline, STREAM_GRACE_MS } from './connectionStatus'

const T = 100_000

// Protects: the engine is told "offline" when the browser says so, or when the live
// connection has been down for three seconds (a brief reconnect is not offline); a stream that
// never dropped, or whose drop time is unknown, never counts.
test('a dropped live connection counts as offline after three seconds', () => {
  expect(STREAM_GRACE_MS).toBe(3000)
  expect(isOffline(false, true, null, T)).toBe(true)
  expect(isOffline(true, true, null, T)).toBe(false)
  expect(isOffline(true, false, T - 2999, T)).toBe(false)
  expect(isOffline(true, false, T - 3000, T)).toBe(true)
  expect(isOffline(true, false, null, T)).toBe(false)
})
