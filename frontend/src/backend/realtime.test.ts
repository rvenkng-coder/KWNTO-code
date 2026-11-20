import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { subscribeProject } from './realtime'

// A fake pb: records the callbacks of collection subscriptions and of realtime.subscribe('PB_CONNECT').
function fakePb(isConnected = false) {
  const connectCallbacks = new Set<() => void>()
  const closed: string[] = []
  const pb = {
    filter: (q: string) => q,
    collection: (name: string) => ({
      subscribe: async () => async () => { closed.push(name) },
    }),
    realtime: {
      isConnected,
      subscribe: async (topic: string, cb: () => void) => {
        expect(topic).toBe('PB_CONNECT')
        connectCallbacks.add(cb)
        return async () => { connectCallbacks.delete(cb); closed.push('PB_CONNECT') }
      },
    },
  }
  const connect = () => [...connectCallbacks].forEach((cb) => cb())
  return { pb: pb as unknown as PocketBase, connect, closed, listeners: () => connectCallbacks.size }
}

// Protects: finding E / D6: a reconnect is reported, the first connect is not, nothing is reported after close, and close removes the listener.
test('a reconnect is reported but the first connect is not', async () => {
  const { pb, connect, closed, listeners } = fakePb()
  let reconnects = 0
  const close = await subscribeProject(pb, 'p1', () => {}, () => { reconnects++ })
  connect()
  expect(reconnects).toBe(0)
  connect()
  connect()
  expect(reconnects).toBe(2)
  const before = listeners()
  await close()
  expect(before).toBe(1)
  expect(listeners()).toBe(0)
  expect(closed).toContain('PB_CONNECT')
  connect()
  expect(reconnects).toBe(2)
})

// Protects: finding E: when the socket is already connected before this subscription, the first PB_CONNECT seen is already a reconnect.
test('a connect seen on an already open connection is a reconnect', async () => {
  const { pb, connect } = fakePb(true)
  let reconnects = 0
  await subscribeProject(pb, 'p1', () => {}, () => { reconnects++ })
  connect()
  expect(reconnects).toBe(1)
})

// Protects: Plan 3's behaviour: without onReconnect no PB_CONNECT subscription is opened.
test('no reconnect callback, no connect subscription', async () => {
  const { pb, listeners } = fakePb()
  await subscribeProject(pb, 'p1', () => {})
  expect(listeners()).toBe(0)
})
