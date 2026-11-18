import { expect, test } from 'vitest'
import { guardedSave } from '../../../../frontend/src/backend/guarded'
import { scriptedIO, writesOf } from './helpers'

// Protects: every non-conflict kind is rethrown after one write.
test('[C6] wrong-actor: invalid, forbidden, not-found, unreachable and unknown are not retried', async () => {
  for (const kind of ['invalid', 'forbidden', 'not-found', 'unreachable', 'unknown', 'locked'] as const) {
    const { io, calls } = scriptedIO([kind], [1])
    await expect(guardedSave(io, {}, 0)).rejects.toMatchObject({ kind })
    expect(calls).toHaveLength(1)
  }
})

// Protects: a failure after some conflicts stops the loop at once.
test('[C6] second-bad-item: forbidden on the third write stops there', async () => {
  const { io, calls } = scriptedIO(['conflict', 'conflict', 'forbidden'], [1, 2])
  await expect(guardedSave(io, {}, 0)).rejects.toMatchObject({ kind: 'forbidden' })
  expect(writesOf(calls)).toHaveLength(3)
})

// Protects: a failing read is rethrown and no further write is made.
test('[C6] refused-vs-failed: unreachable on the re-read is rethrown', async () => {
  const { io, calls } = scriptedIO(['conflict'], ['unreachable'])
  await expect(guardedSave(io, {}, 0)).rejects.toMatchObject({ kind: 'unreachable' })
  expect(calls.map((c) => c.op)).toEqual(['write', 'read'])
})
