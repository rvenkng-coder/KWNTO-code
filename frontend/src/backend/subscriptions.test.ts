import { expect, test } from 'vitest'
import { closesQuietly } from './subscriptions'

// Protects design 6.7: closing a live subscription while the connection is down is a normal event. The close request
// fails, and that failure must not escape as an unhandled rejection (callers close without waiting or catching).
test('a close function never rejects, and still runs the real close once', async () => {
  let calls = 0
  const failing = closesQuietly(() => {
    calls++
    return Promise.reject(new Error('network down'))
  })
  await expect(failing()).resolves.toBeUndefined()
  expect(calls).toBe(1)

  let closed = false
  const working = closesQuietly(async () => {
    closed = true
  })
  await expect(working()).resolves.toBeUndefined()
  expect(closed).toBe(true)
})

// Protects the same rule for a close that throws at once instead of returning a rejected promise.
test('a close function that throws is also quiet', async () => {
  const throwing = closesQuietly(() => {
    throw new Error('client gone')
  })
  await expect(throwing()).resolves.toBeUndefined()
})
