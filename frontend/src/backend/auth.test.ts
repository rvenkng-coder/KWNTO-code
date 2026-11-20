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

function makeFakePb(record = { id: 'u1', email: 'a@b.test', name: 'A', verified: false }) {
  const clear = vi.fn()
  let storedCb: (token: string, rec: unknown) => void = () => undefined
  const authStore = { token: 'tok', record, clear, onChange: vi.fn((_cb) => { storedCb = _cb }) }
  const pb = {
    authStore, collection: () => ({}),
  } as unknown as PocketBase
  return { pb, fire: (token: string, rec: unknown) => { (authStore.record as Record<string, unknown>) = rec as Record<string, unknown>; storedCb(token, rec) } }
}

// Protects: two listeners must both be called when the store fires a change;
// a single-listener design silently drops one.
test('every listener hears a store change', async () => {
  const { pb, fire } = makeFakePb()
  const auth = createAuth(pb)
  const l1 = vi.fn()
  const l2 = vi.fn()
  auth.onChange(l1)
  auth.onChange(l2)
  const user = { id: 'u2', email: 'x@y.test', name: 'X', verified: true }
  fire('t', user)
  expect(l1).toHaveBeenCalledTimes(1)
  expect(l1).toHaveBeenCalledWith({ id: 'u2', email: 'x@y.test', name: 'X', verified: true })
  expect(l2).toHaveBeenCalledTimes(1)
  expect(l2).toHaveBeenCalledWith({ id: 'u2', email: 'x@y.test', name: 'X', verified: true })
})

// Protects: unsubscribe must remove only that listener; calling it twice must not throw.
test('unsubscribing removes only that listener', async () => {
  const { pb, fire } = makeFakePb()
  const auth = createAuth(pb)
  const l1 = vi.fn()
  const l2 = vi.fn()
  const off1 = auth.onChange(l1)
  auth.onChange(l2)
  off1()
  fire('', null)
  expect(l1).not.toHaveBeenCalled()
  expect(l2).toHaveBeenCalledTimes(1)
  expect(l2).toHaveBeenCalledWith(null)
  off1() // second remove must not throw
})

// Protects: a sign-out from another tab (store fires null) must reach listeners and clear current().
test('a sign-out in another tab reaches the listeners', async () => {
  const { pb, fire } = makeFakePb()
  const auth = createAuth(pb)
  const l1 = vi.fn()
  const l2 = vi.fn()
  auth.onChange(l1)
  auth.onChange(l2)
  fire('', null)
  expect(l1).toHaveBeenCalledWith(null)
  expect(l2).toHaveBeenCalledWith(null)
  expect(auth.current()).toBeNull()
})

// Protects: a sign-in from another tab must replace the cached user and reach listeners.
test('a sign-in in another tab replaces the cached user', async () => {
  const { pb, fire } = makeFakePb()
  const auth = createAuth(pb)
  const l1 = vi.fn()
  auth.onChange(l1)
  const newUser = { id: 'u99', email: 'other@test.com', name: 'Other', verified: true }
  fire('tok2', newUser)
  expect(l1).toHaveBeenCalledWith({ id: 'u99', email: 'other@test.com', name: 'Other', verified: true })
  expect(auth.current()?.id).toBe('u99')
})

// Protects: signIn must fire onChange (not call listeners directly) so each listener hears exactly one event.
test('a sign-in reaches each listener once', async () => {
  const clear = vi.fn()
  const record = { id: 'u1', email: 'a@b.test', name: 'A', verified: true }
  let storedCb: (token: string, rec: unknown) => void = () => undefined
  const authStore = { token: 'tok', record, clear, onChange: vi.fn((_cb) => { storedCb = _cb }) }
  const pb = {
    authStore,
    collection: () => ({
      authWithPassword: () => Promise.resolve({ record }),
    }),
  } as unknown as PocketBase
  const auth = createAuth(pb)
  const l1 = vi.fn()
  const l2 = vi.fn()
  auth.onChange(l1)
  auth.onChange(l2)
  await auth.signIn('a@b.test', 'pass')
  // Simulate the SDK firing onChange after a successful sign-in
  storedCb('tok', record)
  expect(l1).toHaveBeenCalledTimes(1)
  expect(l2).toHaveBeenCalledTimes(1)
})

// Protects: a throwing listener must not prevent other listeners from being called.
test('a failing listener does not silence the others', async () => {
  const { pb, fire } = makeFakePb()
  const auth = createAuth(pb)
  const l1 = vi.fn(() => { throw new Error('boom') })
  const l2 = vi.fn()
  auth.onChange(l1)
  auth.onChange(l2)
  fire('t', { id: 'u1', email: 'a@b.test', name: 'A', verified: true })
  expect(l2).toHaveBeenCalledTimes(1)
})

// Protects: current() must return the same object on every call when the store record has not changed;
// a per-call wrapper loses writes to cached and returns a new object each time.
test('current() returns the same object while the store is unchanged', () => {
  const clear = vi.fn()
  const record = { id: 'u1', email: 'a@b.test', name: 'A', verified: false }
  const authStore = { token: 'tok', record, clear, onChange: vi.fn() }
  const pb = {
    authStore,
    collection: () => ({}),
  } as unknown as PocketBase
  const auth = createAuth(pb)
  expect(auth.current()).toBe(auth.current())
})

// Protects: after signIn resolves, current() must return the same object that signIn returned;
// a per-call wrapper in doSignIn loses the cached write so current() gets a different object.
test('signIn result and current() are the same object', async () => {
  const clear = vi.fn()
  const record = { id: 'u1', email: 'a@b.test', name: 'A', verified: true }
  const authStore = { token: 'tok', record, clear, onChange: vi.fn() }
  const pb = {
    authStore,
    collection: () => ({
      authWithPassword: () => Promise.resolve({ record }),
    }),
  } as unknown as PocketBase
  const auth = createAuth(pb)
  const result = await auth.signIn('a@b.test', 'pass')
  expect(auth.current()).toBe(result)
})

// Protects Plan 6 D9 / C2: the mail-link screens finish verification and reset through the SDK with
// exactly the token and passwords given, and a refusal (the password rules) reaches the screen as a
// BackendError of kind invalid carrying the server's message.
test('the door confirms verification and resets through the SDK', async () => {
  const confirmVerification = vi.fn().mockResolvedValue(true)
  const confirmPasswordReset = vi.fn().mockResolvedValue(true)
  const pb = {
    authStore: { token: '', record: null, clear: vi.fn(), onChange: vi.fn() },
    collection: (name: string) => (name === 'users' ? { confirmVerification, confirmPasswordReset } : {}),
  } as unknown as PocketBase
  const auth = createAuth(pb)
  await auth.confirmVerification('t')
  expect(confirmVerification).toHaveBeenCalledExactlyOnceWith('t')
  await auth.confirmPasswordReset('t', 'p', 'q')
  expect(confirmPasswordReset).toHaveBeenCalledExactlyOnceWith('t', 'p', 'q')

  const failure = new ClientResponseError({ status: 400, response: { message: 'Password must ...' } })
  confirmPasswordReset.mockRejectedValue(failure)
  confirmVerification.mockRejectedValue(failure)
  await expect(auth.confirmPasswordReset('t', 'p', 'q')).rejects.toMatchObject({ name: 'BackendError', kind: 'invalid', message: 'Password must ...' })
  await expect(auth.confirmVerification('t')).rejects.toMatchObject({ kind: 'invalid', message: 'Password must ...' })
})
