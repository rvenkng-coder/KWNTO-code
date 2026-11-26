import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { purgeInBatches, withoutSkipped } = require('../../backend/pb_hooks/lib/purge.js') as {
  purgeInBatches: (
    find: (except: string[]) => Array<{ id: string }>,
    remove: (r: { id: string }) => void,
    onError: (r: { id: string }, e: unknown) => void,
  ) => number
  withoutSkipped: (filter: string, except: string[], params: Record<string, string>) => string
}

// A backlog of ids; `find` hands out up to `size` of those not yet removed and not skipped.
function backlog(ids: string[], size = 2) {
  const left = new Set(ids)
  return {
    find: (except: string[]) =>
      [...left]
        .filter((id) => !except.includes(id))
        .slice(0, size)
        .map((id) => ({ id })),
    remove: (r: { id: string }) => {
      left.delete(r.id)
    },
    left,
  }
}

// Protects a complete purge: the purge deletes everything it can, a record that cannot be deleted is reported and
// skipped so the ones behind it are still purged, and the loop ends instead of retrying the same record every
// night.
test('one record that cannot be deleted does not stop the purge', () => {
  const b = backlog(['a', 'bad', 'c', 'd', 'e'])
  const errors: string[] = []
  const deleted = purgeInBatches(
    b.find,
    (r) => {
      if (r.id === 'bad') throw new Error('cascade failed')
      b.remove(r)
    },
    (r, e) => errors.push(`${r.id}: ${String(e)}`),
  )
  expect(deleted).toBe(4)
  expect([...b.left]).toEqual(['bad'])
  expect(errors).toEqual(['bad: Error: cascade failed'])
})

// Protects a complete purge: nothing to purge is a clean no-op, and an everything-fails backlog still ends.
test('an empty backlog deletes nothing and a backlog that always fails still ends', () => {
  expect(
    purgeInBatches(
      () => [],
      () => undefined,
      () => undefined,
    ),
  ).toBe(0)
  const b = backlog(['x', 'y', 'z'])
  const seen: string[] = []
  expect(
    purgeInBatches(
      b.find,
      () => {
        throw new Error('no')
      },
      (r) => seen.push(r.id),
    ),
  ).toBe(0)
  expect(seen.sort()).toEqual(['x', 'y', 'z'])
})

// Protects against injection: the skipped ids become bound parameters of the filter, never text pasted into it.
test('skipped ids are added to the filter as bound parameters', () => {
  const params: Record<string, string> = {}
  expect(withoutSkipped("deleted_at != ''", ["a'b", 'c'], params)).toBe(
    "deleted_at != '' && id != {:s0} && id != {:s1}",
  )
  expect(params).toEqual({ s0: "a'b", s1: 'c' })
  expect(withoutSkipped('f', [], {})).toBe('f')
})
