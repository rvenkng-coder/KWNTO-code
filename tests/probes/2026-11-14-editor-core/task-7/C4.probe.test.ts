import { expect, test } from 'vitest'
import { guardedSave } from '../../../../frontend/src/backend/guarded'
import { scriptedIO, writesOf } from './helpers'

// Protects: each retry uses the version of the latest read, not the first one.
test('[C4] second-bad-item: two conflicts in a row use each fresh version', async () => {
  const { io, calls } = scriptedIO(['conflict', 'conflict', 11], [7, 9])
  const body = { title: 'x' }
  await expect(guardedSave(io, body, 3)).resolves.toEqual({ version: 11 })
  expect(writesOf(calls).map((w) => w.version)).toEqual([3, 7, 9])
  expect(writesOf(calls).every((w) => JSON.stringify(w.body) === '{"title":"x"}')).toBe(true)
})

// Protects: a write that succeeds at once never reads.
test('[C4] empty-one-huge: no conflict means one write and no read', async () => {
  const { io, calls } = scriptedIO([4], [99])
  await expect(guardedSave(io, { x: 1 }, 3)).resolves.toEqual({ version: 4 })
  expect(calls).toEqual([{ op: 'write', body: { x: 1 }, version: 3 }])
})

// Protects: the read comes between the conflict and the retry, every time.
test('[C4] race-and-parallel: read then write after each conflict', async () => {
  const { io, calls } = scriptedIO(['conflict', 'conflict', 2], [5, 6])
  await guardedSave(io, {}, 0)
  expect(calls.map((c) => c.op)).toEqual(['write', 'read', 'write', 'read', 'write'])
})
