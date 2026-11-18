import { expect, test } from 'vitest'
import { BackendError } from '../../../../frontend/src/backend/errors'
import { EditConflict } from '../../../../frontend/src/backend/errors'
import { guardedSave } from '../../../../frontend/src/backend/guarded'

type Rec = { version: number; title: string }

// Protects: probe of plan row C1: a non-conflict error is thrown as is and never asks shouldRetry.
test('[C1] other-error: a forbidden write does not reach shouldRetry', async () => {
  let asked = 0
  const io = { read: async () => ({ version: 1, title: 'x' }), write: async (): Promise<Rec> => { throw new BackendError('forbidden', 403, {}, 'no') } }
  const err = await guardedSave(io, { title: 'a' }, 0, () => { asked++; return false }).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(BackendError)
  expect(err).not.toBeInstanceOf(EditConflict)
  expect(asked).toBe(0)
})

// Protects: probe of plan row C2: shouldRetry is asked again on every later 409 with that read's record.
test('[C2] second-conflict: a later 409 can still stop the retry', async () => {
  const reads = [{ version: 2, title: 'ok' }, { version: 3, title: 'theirs' }]
  let n = 0
  const io = { read: async () => reads[n++]!, write: async (): Promise<Rec> => { throw new BackendError('conflict', 409, {}, 'c') } }
  const err = await guardedSave(io, { title: 'a' }, 0, (cur: Rec) => cur.title === 'ok').catch((e: unknown) => e)
  expect(err).toBeInstanceOf(EditConflict)
  expect((err as EditConflict<Rec>).server.version).toBe(3)
})
