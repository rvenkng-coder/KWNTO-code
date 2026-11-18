import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: a sign-out from another tab tells listeners once and a later sign-in works again.
test('[C3] signout-then-signin: null reaches listeners once, then the next user is heard', () => {
  const { pb, store } = makeStore(rec('u1'))
  const auth = createAuth(pb)
  expect(auth.current()?.id).toBe('u1')
  const l = vi.fn()
  auth.onChange(l)
  store.clear()
  expect(l).toHaveBeenCalledTimes(1)
  expect(l).toHaveBeenLastCalledWith(null)
  expect(auth.current()).toBeNull()
  store.save('t', rec('u2'))
  expect(l).toHaveBeenCalledTimes(2)
  expect(auth.current()?.id).toBe('u2')
})

// Protects: signOut() on this tab tells each listener exactly once.
test('[C3] own-signout-once: signOut() reaches each listener once with null', () => {
  const { pb } = makeStore(rec('u1'))
  const auth = createAuth(pb)
  const [a, b] = [vi.fn(), vi.fn()]
  auth.onChange(a)
  auth.onChange(b)
  auth.signOut()
  expect(a.mock.calls).toEqual([[null]])
  expect(b.mock.calls).toEqual([[null]])
})
