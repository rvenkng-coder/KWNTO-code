import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: removing one of three leaves the other two; removing twice does not disturb them.
test('[C2] remove-twice-keeps-others: second removal of the same listener changes nothing', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const [a, b, c] = [vi.fn(), vi.fn(), vi.fn()]
  const offA = auth.onChange(a)
  auth.onChange(b)
  auth.onChange(c)
  offA()
  offA()
  store.save('t', rec('u1'))
  expect(a).not.toHaveBeenCalled()
  expect(b).toHaveBeenCalledTimes(1)
  expect(c).toHaveBeenCalledTimes(1)
})

// Protects: a listener that removes itself while being called does not stop the others.
test('[C2] remove-during-delivery: a listener unsubscribing itself does not silence the next', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const b = vi.fn()
  const offA = auth.onChange(() => offA())
  auth.onChange(b)
  store.save('t', rec('u1'))
  expect(b).toHaveBeenCalledTimes(1)
  store.save('t', rec('u2'))
  expect(b).toHaveBeenCalledTimes(2)
})

// Protects: after everyone unsubscribed, a change still updates current() and does not throw.
test('[C2] none-left: with no listeners a change still updates current()', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  auth.onChange(() => undefined)()
  expect(() => store.save('t', rec('u3'))).not.toThrow()
  expect(auth.current()?.id).toBe('u3')
})
