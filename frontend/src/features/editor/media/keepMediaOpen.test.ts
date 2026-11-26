import { describe, expect, test } from 'vitest'
import { keepMediaOpen, type OnlinePort } from './keepMediaOpen.ts'

function fakePort(initial = true) {
  let online = initial
  const listeners = new Set<() => void>()
  const port: OnlinePort = {
    online: () => online,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
  return {
    port,
    set(next: boolean) {
      online = next
      ;[...listeners].forEach((fn) => fn())
    },
    listeners: () => listeners.size,
  }
}

function fakeOpen() {
  const state = { opened: 0, closed: 0 }
  const open = () => {
    state.opened++
    return Promise.resolve(() => {
      state.closed++
    })
  }
  return { state, open }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('keepMediaOpen', () => {
  // Protects: offline closes the live subscription (so the SDK can drop its stream), coming back opens it again once.
  test('offline closes the subscription and coming back reopens it', async () => {
    const net = fakePort()
    const { state, open } = fakeOpen()
    const stop = keepMediaOpen(open, net.port)
    await flush()
    expect(state).toEqual({ opened: 1, closed: 0 })

    net.set(false)
    expect(state.closed).toBe(1)
    net.set(false)
    expect(state).toEqual({ opened: 1, closed: 1 })

    net.set(true)
    await flush()
    expect(state).toEqual({ opened: 2, closed: 1 })

    stop()
    expect(state.closed).toBe(2)
    expect(net.listeners()).toBe(0)
  })

  // Protects: an open that finishes after a newer offline or after stop is closed at once, never leaked.
  test('a late open is closed when it is no longer wanted', async () => {
    const net = fakePort()
    const resolvers: Array<(c: () => void) => void> = []
    let closed = 0
    const open = () =>
      new Promise<() => void>((resolve) => {
        resolvers.push(resolve)
      })
    const stop = keepMediaOpen(open, net.port)
    net.set(false)
    resolvers[0]!(() => {
      closed++
    })
    await flush()
    expect(closed).toBe(1)

    net.set(true)
    stop()
    resolvers[1]!(() => {
      closed++
    })
    await flush()
    expect(closed).toBe(2)
  })

  // Protects: starting offline opens nothing until the connection is back.
  test('starting offline opens nothing', async () => {
    const net = fakePort(false)
    const { state, open } = fakeOpen()
    keepMediaOpen(open, net.port)
    await flush()
    expect(state.opened).toBe(0)
    net.set(true)
    await flush()
    expect(state.opened).toBe(1)
  })
})
