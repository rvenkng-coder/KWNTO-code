import { expect, test } from 'vitest'
import { guardedSave, MAX_SAVE_TRIES, TOO_BUSY } from '../../../../frontend/src/backend/guarded'
import { scriptedIO, writesOf } from './helpers'

// Protects: the bound and message are the ones the plan names.
test('[C5] relative-of-fixed-case: the bound is 20 and the message is exact', () => {
  expect(MAX_SAVE_TRIES).toBe(20)
  expect(TOO_BUSY).toBe('Could not save: too many people are editing this at once. Try again.')
})

// Protects: success on the last allowed write is still a success.
test('[C5] empty-one-huge: a save that wins on the twentieth write succeeds', async () => {
  const writes = [...Array<'conflict'>(19).fill('conflict'), 42]
  const { io, calls } = scriptedIO(writes, [1])
  await expect(guardedSave(io, { a: 1 }, 0)).resolves.toEqual({ version: 42 })
  expect(writesOf(calls)).toHaveLength(20)
})

// Protects: giving up rejects with a conflict carrying TOO_BUSY, after exactly 20 writes.
test('[C5] success-on-failure: endless conflicts reject with TOO_BUSY', async () => {
  const { io, calls } = scriptedIO(['conflict'], [1])
  const error = await guardedSave(io, { a: 1 }, 0).catch((e: unknown) => e)
  expect(error).toMatchObject({ name: 'BackendError', kind: 'conflict', message: TOO_BUSY })
  expect(writesOf(calls)).toHaveLength(20)
})
