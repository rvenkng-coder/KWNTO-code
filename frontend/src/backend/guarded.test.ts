// Protects decision 0002: "the client must handle 409 as normal flow (re-read, re-apply
// only its own fields, retry) ... bound the retries". A conflict is retried with the fresh
// version and the caller's own body, at most 20 writes, and any other error stops at once.
import { expect, test } from 'vitest'
import { BackendError, type BackendErrorKind } from './errors'
import { guardedSave, MAX_SAVE_TRIES, TOO_BUSY, type GuardedIO } from './guarded'

type Rec = { version: number; title?: string }

// A fake record store: each write answers from `writes` in turn (a kind rejects, a record
// resolves; the last answer repeats), each read answers from `reads` the same way.
function fakeIO(writes: Array<BackendErrorKind | Rec>, reads: Array<BackendErrorKind | Rec>) {
  const sent: Array<{ body: Record<string, unknown>; version: number }> = []
  let readCount = 0
  const answer = (step: BackendErrorKind | Rec | undefined) =>
    step === undefined || typeof step === 'string'
      ? Promise.reject(new BackendError(step ?? 'unknown', 0, {}, step ?? 'no answer'))
      : Promise.resolve(step)
  const io: GuardedIO<Rec> = {
    read: () => answer(reads[Math.min(readCount++, reads.length - 1)]),
    write: (body, version) => {
      sent.push({ body, version })
      return answer(writes[Math.min(sent.length - 1, writes.length - 1)])
    },
  }
  return { io, sent, reads: () => readCount }
}

// Protects: a 409 is normal flow: re-read, then re-send only the caller's own fields with the fresh version.
test('a conflict is retried with the fresh version and the same fields', async () => {
  const saved = { version: 8, title: 'Mine' }
  const { io, sent } = fakeIO(['conflict', saved], [{ version: 7, title: 'Theirs' }])

  const result = await guardedSave(io, { title: 'Mine' }, 3)

  expect(result).toBe(saved)
  expect(sent).toEqual([
    { body: { title: 'Mine' }, version: 3 },
    { body: { title: 'Mine' }, version: 7 },
  ])
})

// Protects: the retry is bounded and ends with the message the plan names.
test('it gives up after twenty conflicts', async () => {
  const { io, sent } = fakeIO(['conflict'], [{ version: 1 }])

  const error = await guardedSave(io, { x: 1 }, 0).catch((e: unknown) => e)

  expect(MAX_SAVE_TRIES).toBe(20)
  expect(sent).toHaveLength(20)
  expect(error).toBeInstanceOf(BackendError)
  expect((error as BackendError).kind).toBe('conflict')
  expect((error as BackendError).message).toBe(TOO_BUSY)
})

// Protects: a refusal or a failed re-read reaches the caller at once instead of looping.
test('errors other than a conflict are not retried', async () => {
  const refused = fakeIO(['forbidden'], [{ version: 1 }])
  await expect(guardedSave(refused.io, { x: 1 }, 0)).rejects.toMatchObject({ kind: 'forbidden' })
  expect(refused.sent).toHaveLength(1)
  expect(refused.reads()).toBe(0)

  const gone = fakeIO(['conflict'], ['not-found'])
  await expect(guardedSave(gone.io, { x: 1 }, 0)).rejects.toMatchObject({ kind: 'not-found' })
  expect(gone.sent).toHaveLength(1)
})
