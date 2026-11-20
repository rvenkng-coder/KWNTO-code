import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { subscribeProject } from '../../../../frontend/src/backend/realtime'

// Protects: probe of plan row C3: a failed collection subscription closes the connect listener too.
test('[C3] failure-cleanup: a refused subscription removes the PB_CONNECT listener', async () => {
  const live = new Set<unknown>()
  const pb = {
    filter: (q: string) => q,
    collection: () => ({ subscribe: async () => { throw new Error('boom') } }),
    realtime: { isConnected: false, subscribe: async (_t: string, cb: unknown) => { live.add(cb); return async () => { live.delete(cb) } } },
  } as unknown as PocketBase
  await expect(subscribeProject(pb, 'p', () => {}, () => {})).rejects.toBeTruthy()
  expect(live.size).toBe(0)
})
