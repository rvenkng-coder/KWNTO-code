// Protects: the preferences door (C8) sends only changed keys, maps the server row back
// and reports a failed call as a BackendError. File header; each test has its own note.
import { expect, test, vi } from 'vitest'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { createPreferences } from './preferences'

const ROW = { id: 'row000000000001', user: 'user1', theme: 'dark', minimap_visible: true }

function fakePb(overrides: { getFirstListItem?: () => Promise<unknown>; update?: (id: string, body: unknown) => Promise<unknown> } = {}) {
  const getFirstListItem = vi.fn(overrides.getFirstListItem ?? (() => Promise.resolve(ROW)))
  const update = vi.fn(overrides.update ?? ((_id: string, body: unknown) => Promise.resolve({ ...ROW, ...(body as object) })))
  const filter = vi.fn((f: string, params: Record<string, unknown>) => `${f}|${JSON.stringify(params)}`)
  const pb = {
    authStore: { record: { id: 'user1' } },
    collection: vi.fn(() => ({ getFirstListItem, update })),
    filter,
  } as unknown as PocketBase
  return { pb, getFirstListItem, update, filter }
}

// Protects: C8, saving the theme never overwrites the minimap choice made in another tab.
test('set sends only the changed preference', async () => {
  const { pb, update } = fakePb()
  const result = await createPreferences(pb).set({ minimapVisible: false })
  expect(update).toHaveBeenCalledWith(ROW.id, { minimap_visible: false })
  expect(result).toEqual({ theme: 'dark', minimapVisible: false })
})

// Protects: the row is found by the signed-in user id, never by a guess.
test('get finds the signed-in user\'s row and maps it', async () => {
  const { pb, getFirstListItem, filter } = fakePb()
  const prefs = await createPreferences(pb).get()
  expect(filter).toHaveBeenCalledWith('user = {:user}', { user: 'user1' })
  expect(getFirstListItem).toHaveBeenCalledOnce()
  expect(prefs).toEqual({ theme: 'dark', minimapVisible: true })
})

// Protects: callers see one error type from the door, not the SDK error.
test('a failed call rejects with a BackendError, not the raw SDK error', async () => {
  const { pb } = fakePb({ getFirstListItem: () => Promise.reject(new ClientResponseError({ status: 0, response: {} })) })
  const err = await createPreferences(pb).get().catch((e: unknown) => e)
  expect(err).not.toBeInstanceOf(ClientResponseError)
  expect((err as { kind?: string }).kind).toBeDefined()
})
