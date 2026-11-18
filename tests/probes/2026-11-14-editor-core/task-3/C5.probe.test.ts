import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: a real signIn (the store fires inside it) reaches each listener once, not twice.
test('[C5] signin-once: signIn with a store that fires reaches each listener once', async () => {
  const { pb } = makeStore()
  const auth = createAuth(pb)
  const [a, b] = [vi.fn(), vi.fn()]
  auth.onChange(a)
  auth.onChange(b)
  const user = await auth.signIn('u1@t.test', 'pw')
  expect(user.id).toBe('u1')
  expect(a).toHaveBeenCalledTimes(1)
  expect(b).toHaveBeenCalledTimes(1)
  expect(auth.current()?.id).toBe('u1')
})

// Protects: a successful refresh reaches each listener once.
test('[C5] refresh-once: refresh with a store that fires reaches each listener once', async () => {
  const { pb } = makeStore(rec('u1', false))
  const auth = createAuth(pb)
  const a = vi.fn()
  auth.onChange(a)
  const user = await auth.refresh()
  expect(user?.id).toBe('u1')
  expect(a).toHaveBeenCalledTimes(1)
})

// Protects: a failed sign-in tells nobody.
test('[C5] failed-signin-silent: a refused sign-in calls no listener', async () => {
  const { pb, collection } = makeStore()
  collection.authWithPassword.mockRejectedValueOnce(new Error('nope'))
  const auth = createAuth(pb)
  const a = vi.fn()
  auth.onChange(a)
  await expect(auth.signIn('x', 'y')).rejects.toBeDefined()
  expect(a).not.toHaveBeenCalled()
})
