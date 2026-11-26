import PocketBase from 'pocketbase'
import { expect, test, vi } from 'vitest'
import { createRealtime, subscribeProject } from './realtime'

// A fake pb: records the callbacks of collection subscriptions and of realtime.subscribe('PB_CONNECT').
function fakePb(isConnected = false) {
  const connectCallbacks = new Set<() => void>()
  const closed: string[] = []
  const pb = {
    filter: (q: string) => q,
    collection: (name: string) => ({
      subscribe: async () => async () => {
        closed.push(name)
      },
    }),
    realtime: {
      isConnected,
      subscribe: async (topic: string, cb: () => void) => {
        expect(topic).toBe('PB_CONNECT')
        connectCallbacks.add(cb)
        return async () => {
          connectCallbacks.delete(cb)
          closed.push('PB_CONNECT')
        }
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
  const close = await subscribeProject(
    pb,
    'p1',
    () => {},
    () => {
      reconnects++
    },
  )
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
  await subscribeProject(
    pb,
    'p1',
    () => {},
    () => {
      reconnects++
    },
  )
  connect()
  expect(reconnects).toBe(1)
})

// Protects: Plan 3's behaviour: without onReconnect no PB_CONNECT subscription is opened.
test('no reconnect callback, no connect subscription', async () => {
  const { pb, listeners } = fakePb()
  await subscribeProject(pb, 'p1', () => {})
  expect(listeners()).toBe(0)
})

// Protects plan 7 D15: listeners hear `true` on every connect and `false` when the stream drops
// while the project's subscriptions are open; a drop with nothing subscribed is ignored; several
// listeners are allowed; and nothing arrives after the subscription is closed or a listener left.
test('connection listeners hear connects and drops only while subscribed', async () => {
  const { pb, connect, closed } = fakePb()
  const realtime = createRealtime(pb)
  const heard: string[] = []
  const off = realtime.onConnectionChange((up) => heard.push(`a:${up}`))
  realtime.onConnectionChange((up) => heard.push(`b:${up}`))
  const close = await subscribeProject(
    pb,
    'p1',
    () => {},
    () => {},
  )
  connect()
  const drop = (pb as unknown as { realtime: { onDisconnect?: (subs: string[]) => void } }).realtime.onDisconnect
  drop?.(['x'])
  drop?.([])
  expect(heard).toEqual(['a:true', 'b:true', 'a:false', 'b:false'])
  off()
  connect()
  expect(heard.slice(4)).toEqual(['b:true'])
  await close()
  expect(closed).toContain('PB_CONNECT')
  connect()
  expect((pb as unknown as { realtime: { onDisconnect?: unknown } }).realtime.onDisconnect).toBeUndefined()
  expect(heard).toHaveLength(5)
})

// Protects review finding M4 of plan 2026-11-20-sharing: the stream probe is built from the client's
// own base URL (a backend on another origin is probed, not the page's host), answers true on the
// server's connect event, and false on an error or when nothing answers within two seconds.
test('the stream probe uses the client address and answers on connect, error or timeout', async () => {
  const opened: Array<{ url: string; fire(type: string): void; closed: boolean }> = []
  class FakeSource {
    closed = false
    private handlers = new Map<string, () => void>()
    url: string
    constructor(url: string) {
      this.url = url
      opened.push(this)
    }
    addEventListener(type: string, fn: () => void) {
      this.handlers.set(type, fn)
    }
    fire(type: string) {
      this.handlers.get(type)?.()
    }
    close() {
      this.closed = true
    }
  }
  vi.stubGlobal('EventSource', FakeSource)
  vi.useFakeTimers()
  try {
    const realtime = createRealtime(new PocketBase('http://backend.test:8090'))
    const first = realtime.probe()
    expect(opened[0]?.url).toBe('http://backend.test:8090/api/realtime')
    opened[0]?.fire('PB_CONNECT')
    expect(await first).toBe(true)
    expect(opened[0]?.closed).toBe(true)

    const second = realtime.probe()
    opened[1]?.fire('error')
    expect(await second).toBe(false)

    const third = realtime.probe()
    await vi.advanceTimersByTimeAsync(2000)
    expect(await third).toBe(false)
    expect(opened[2]?.closed).toBe(true)
  } finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
