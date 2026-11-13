// Protects: a refresh that fails because the server is unreachable must keep the
// session; only a refusal (401, 403, 404) ends it. Otherwise refreshing on load would
// sign everyone out whenever the server is briefly down (final review, I1).
import { expect, test, vi } from 'vitest'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { createAuth } from './auth'

function fakePb(failure: ClientResponseError): { pb: PocketBase; clear: ReturnType<typeof vi.fn> } {
  const clear = vi.fn()
  const record = { id: 'u1', email: 'a@b.test', name: 'A', verified: false }
  const pb = {
    authStore: { token: 'token', record, clear, onChange: vi.fn() },
    collection: () => ({ authRefresh: () => Promise.reject(failure) }),
  } as unknown as PocketBase
  return { pb, clear }
}

test('refresh keeps the session when the server cannot be reached', async () => {
  const { pb, clear } = fakePb(new ClientResponseError({ status: 0, response: {} }))
  const user = await createAuth(pb).refresh()
  expect(user?.id).toBe('u1')
  expect(clear).not.toHaveBeenCalled()
})

test('refresh keeps the session on a server error', async () => {
  const { pb, clear } = fakePb(new ClientResponseError({ status: 500, response: {} }))
  expect((await createAuth(pb).refresh())?.id).toBe('u1')
  expect(clear).not.toHaveBeenCalled()
})

test.each([401, 403, 404])('refresh ends the session on %i', async (status) => {
  const { pb, clear } = fakePb(new ClientResponseError({ status, response: {} }))
  expect(await createAuth(pb).refresh()).toBeNull()
  expect(clear).toHaveBeenCalledOnce()
})

test('a refresh that was in flight when the user signed out does not sign them back in', async () => {
  const clear = vi.fn()
  const record = { id: 'u1', email: 'a@b.test', name: 'A', verified: true }
  let answer: (value: unknown) => void = () => undefined
  const pb = {
    authStore: { token: 'token', record, clear, onChange: vi.fn() },
    collection: () => ({ authRefresh: () => new Promise((resolve) => { answer = resolve }) }),
  } as unknown as PocketBase
  const auth = createAuth(pb)
  const pending = auth.refresh()
  auth.signOut()
  clear.mockClear()
  answer({ record })
  expect(await pending).toBeNull()
  expect(clear).toHaveBeenCalled()
})
