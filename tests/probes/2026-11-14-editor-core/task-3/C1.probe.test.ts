import { expect, test, vi } from 'vitest'
import { createAuth } from '../../../../frontend/src/backend/auth'
import { makeStore, rec } from './helpers'

// Protects: many listeners, not just two, each hear one change once.
test('[C1] many-listeners: five listeners each hear one change exactly once', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const ls = Array.from({ length: 5 }, () => vi.fn())
  ls.forEach((l) => auth.onChange(l))
  store.save('t', rec('u7'))
  for (const l of ls) {
    expect(l).toHaveBeenCalledTimes(1)
    expect(l.mock.calls[0][0]).toMatchObject({ id: 'u7', email: 'u7@t.test' })
  }
})

// Protects: a listener added later hears later changes, and each change is delivered, in order.
test('[C1] ordered-sequence: changes arrive in order, one call each', () => {
  const { pb, store } = makeStore()
  const auth = createAuth(pb)
  const seen: Array<string | null> = []
  auth.onChange((u) => seen.push(u?.id ?? null))
  store.save('a', rec('u1'))
  store.save('b', rec('u2'))
  store.save('', null)
  expect(seen).toEqual(['u1', 'u2', null])
})
