import { expect, test } from 'vitest'
import { isOffline, STREAM_GRACE_MS } from '../../../../frontend/src/features/editor/sync/connectionStatus'

const T = 1_000_000

// Protects: probe of plan row C3, the browser's own flag wins whatever the stream says.
test('[C3] equivalence: a browser that is offline is offline; a connected stream is online', () => {
  for (const connected of [true, false]) for (const down of [null, T - 10_000]) expect(isOffline(false, connected, down, T)).toBe(true)
  expect(isOffline(true, true, null, T)).toBe(false)
  expect(isOffline(true, true, T - 60_000, T)).toBe(false)
})

// Protects: probe of plan row C3, a brief reconnect is not offline; three seconds is.
test('[C3] boundary: a stream down 2,999 ms is online, 3,000 ms and 60 s are offline', () => {
  expect(STREAM_GRACE_MS).toBe(3000)
  expect(isOffline(true, false, T - 2999, T)).toBe(false)
  expect(isOffline(true, false, T - 3000, T)).toBe(true)
  expect(isOffline(true, false, T - 60_000, T)).toBe(true)
  expect(isOffline(true, false, T, T)).toBe(false)
})

// Protects: probe of plan row C3, a stream that never connected (no drop time) is not called offline by the stream rule.
test('[C3] empty: no drop time means online, and a drop time in the future is not offline', () => {
  expect(isOffline(true, false, null, T)).toBe(false)
  expect(isOffline(true, false, T + 5000, T)).toBe(false)
})
