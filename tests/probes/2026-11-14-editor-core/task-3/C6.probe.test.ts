import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: a throwing listener in the middle or at the end does not stop the others or escape.
test('[C6] throw-anywhere: first, middle and last listeners may throw; the store call does not', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const boom = () => { throw new Error('boom') }
  const ok = [vi.fn(), vi.fn()]
  auth.onChange(boom)
  auth.onChange(ok[0])
  auth.onChange(boom)
  auth.onChange(ok[1])
  auth.onChange(boom)
  expect(() => store.save('t', rec('u1'))).not.toThrow()
  expect(ok[0]).toHaveBeenCalledTimes(1)
  expect(ok[1]).toHaveBeenCalledTimes(1)
})

// Protects: a listener that threw is still registered and hears the next change; current() is updated.
test('[C6] throw-stays-subscribed: after throwing, the next change is still delivered', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const l = vi.fn(() => { throw new Error('boom') })
  auth.onChange(l)
  store.save('t', rec('u1'))
  store.clear()
  expect(l).toHaveBeenCalledTimes(2)
  expect(auth.current()).toBeNull()
})

// Protects: a throwing listener during a sign-out of this tab still lets signOut() return.
test('[C6] throw-in-signout: signOut() does not throw when a listener does', () => {
  const { pb } = makeStore(rec('u1'))
  const auth = createAuth(pb)
  auth.onChange(() => { throw new Error('boom') })
  expect(() => auth.signOut()).not.toThrow()
})
