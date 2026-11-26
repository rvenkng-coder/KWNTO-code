import { expect, test } from 'vitest'
import { node } from '../model/fixtures'
import { createMemoryOutbox } from './outboxStorage'
import type { PendingConflict } from './syncEngine'
import { applyChoice } from './syncResolve'

const GONE = 'The record was deleted and no copy of your change is left to restore it.'

// An outbox holding one waiting title change, and that entry.
async function waiting() {
  const storage = createMemoryOutbox()
  const seq = await storage.add({
    userId: 'u1',
    projectId: 'p1',
    op: 'update',
    kind: 'nodes',
    id: 'n1',
    changes: { title: 'Mine' },
    baseVersion: 3,
    baseValues: { title: 'Old' },
    snapshot: null,
    offline: false,
    made: 0,
  })
  const [entry] = await storage.list('u1')
  if (entry === undefined || entry.seq !== seq) throw new Error('the entry was not stored')
  return { storage, entry }
}

const server = node('n1', { title: 'Theirs', version: 5 })

// Protects design 6.7: keeping the other person's value leaves nothing of the conflicting edit to send.
test('keeping theirs drops the entry and reports the server copy', async () => {
  const { storage, entry } = await waiting()
  const conflict: PendingConflict = { entry, server, fields: ['title'], deleted: false }
  expect(await applyChoice(storage, conflict, 'theirs')).toEqual({ seq: entry.seq, type: 'theirs', server })
  expect(await storage.list('u1')).toEqual([])
})

// Protects design 6.7: keeping one's own value sends it again on the version the server now has.
test('keeping mine re-queues the entry on the server version', async () => {
  const { storage, entry } = await waiting()
  const conflict: PendingConflict = { entry, server, fields: ['title'], deleted: false }
  expect(await applyChoice(storage, conflict, 'mine')).toBeNull()
  expect((await storage.list('u1'))[0]).toMatchObject({
    seq: entry.seq,
    baseVersion: 5,
    baseValues: { title: 'Theirs' },
  })
})

// Protects design 6.7: an edit that can no longer be applied is never dropped silently.
test('keeping mine with nothing to restore fails the entry', async () => {
  const { storage, entry } = await waiting()
  const conflict: PendingConflict = { entry, server: null, fields: [], deleted: true }
  expect(await applyChoice(storage, conflict, 'mine')).toEqual({ seq: entry.seq, type: 'refused', message: GONE })
  expect((await storage.failed('u1')).map((f) => f.message)).toEqual([GONE])
})
