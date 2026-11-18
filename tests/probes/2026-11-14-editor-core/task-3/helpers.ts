import { vi } from 'vitest'
import type PocketBase from 'pocketbase'

export type Rec = { id: string; email: string; name: string; verified: boolean }
export const rec = (id: string, verified = true): Rec => ({ id, email: `${id}@t.test`, name: id, verified })

// A store like the SDK's: clear() and save() notify the one onChange callback.
export function makeStore(initial: Rec | null = null) {
  let cb: (token: string, r: unknown) => void = () => undefined
  const store = {
    token: initial ? 'tok' : '',
    record: initial as Rec | null,
    onChange: vi.fn((fn: (token: string, r: unknown) => void) => { cb = fn }),
    save(token: string, r: Rec | null) { store.token = token; store.record = r; cb(token, r) },
    clear() { store.token = ''; store.record = null; cb('', null) },
  }
  const collection = {
    authWithPassword: vi.fn(async () => { store.save('t', rec('u1')); return { record: rec('u1') } }),
    authRefresh: vi.fn(async () => { store.save('t2', rec('u1', true)); return { record: rec('u1', true) } }),
  }
  const pb = { authStore: store, collection: () => collection } as unknown as PocketBase
  return { pb, store, collection }
}
