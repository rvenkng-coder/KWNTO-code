import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: another tab switching user replaces both the listener value and current().
test('[C4] switch-user: u1 then u2 gives u2 everywhere', () => {
  const { pb, store } = makeStore(rec('u1'))
  const auth = createAuth(pb)
  auth.current()
  const l = vi.fn()
  auth.onChange(l)
  store.save('t', rec('u2'))
  expect(l.mock.calls[0][0]).toMatchObject({ id: 'u2' })
  expect(auth.current()?.id).toBe('u2')
})

// Protects: the same user changing (verified flips after the email link, in another tab) is heard
// and current() shows the new flag, not the cached old one.
test('[C4] same-id-new-data: a verified flag changed in another tab reaches current()', () => {
  const { pb, store } = makeStore(rec('u1', false))
  const auth = createAuth(pb)
  expect(auth.current()?.verified).toBe(false)
  const l = vi.fn()
  auth.onChange(l)
  store.save('t', rec('u1', true))
  expect(l.mock.calls[0][0]).toMatchObject({ id: 'u1', verified: true })
  expect(auth.current()?.verified).toBe(true)
})

// Protects: current() hands out the same object while the store's record is unchanged (baseline
// behaviour; React code that compares or depends on the user object must not see a new one each call).
test('[C4] stable-identity: current() twice with an unchanged record is the same object', () => {
  const { pb, store } = makeStore(rec('u1'))
  const auth = createAuth(pb)
  expect(auth.current()).toBe(auth.current())
  store.save('t', rec('u2'))
  expect(auth.current()).toBe(auth.current())
})
