import { expect, test } from 'vitest'
import { BackendError } from '../../../backend/errors'
import { line, node } from '../model/fixtures'
import { settle, tab } from './fakes'
import type { SyncEngine } from './syncEngine'

// Retry behaviour of the engine (offline sync plan, whole-branch review I3, I5, I6).
type Add = Parameters<SyncEngine['add']>[0]
const upd = (id: string): Add => ({
  projectId: 'p1',
  op: 'update',
  kind: 'nodes',
  id,
  changes: { title: 'B' },
  baseVersion: 3,
  baseValues: { title: 'A' },
  snapshot: null,
})
const unreachable = () => new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
async function started() {
  const t = tab()
  t.engine.start()
  await settle()
  return t
}

// Protects: design 6.7: the rate limiter (429) and a server error (5xx) are "try again later", not a refusal: the edit waits and is retried, it is not taken back.
test('a 429 and a 500 with a message keep the edit waiting for a retry', async () => {
  for (const error of [
    new BackendError('locked', 429, {}, 'Too many requests.'),
    new BackendError('unknown', 500, {}, 'Database is busy.'),
  ]) {
    const t = await started()
    t.door.on('update', () => {
      throw error
    })
    await t.engine.add(upd('n1'))
    await settle()
    expect(t.engine.snapshot()).toMatchObject({ online: false, waiting: 1, failed: [] })
    expect(t.log.refused).toHaveLength(0)
    expect(t.clock.pending()).toBe(1)
    t.door.on('update', (c) => node(c.id, { version: 9 }))
    t.clock.advance(1000)
    await settle()
    expect(t.engine.snapshot()).toMatchObject({ online: true, waiting: 0 })
  }
})

// Protects: a lost create whose follow-up check cannot reach the server does not stall the queue: the entry goes back to waiting and is retried after the backoff.
test('a failing check after a lost create backs off instead of stalling', async () => {
  const t = await started()
  t.door.on('create', () => {
    throw new BackendError('invalid', 400, { id: 'taken' }, 'Failed')
  })
  t.door.on('get', () => {
    throw new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
  })
  await t.engine.add({ projectId: 'p1', op: 'create', kind: 'script_lines', id: 'L', record: line('L') })
  await settle()
  expect(t.engine.snapshot()).toMatchObject({ online: false, waiting: 1, sendingSeq: null, failed: [] })
  expect(t.clock.pending()).toBe(1)
  t.door.on('get', () => ({ ...line('L'), projectId: 'p1' }))
  t.clock.advance(1000)
  await settle()
  expect(t.engine.snapshot()).toMatchObject({ waiting: 0, failed: [] })
})

// Protects: design 6.7: "Offline" does not stay stuck when the server returns after the waiting edit was cancelled: with nothing left to send the engine considers the server reachable again.
test('offline clears when the queue empties while the server was down', async () => {
  const t = await started()
  t.door.on('create', () => {
    throw new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
  })
  await t.engine.add({ projectId: 'p1', op: 'create', kind: 'script_lines', id: 'L', record: line('L') })
  await settle()
  expect(t.engine.snapshot().online).toBe(false)
  await t.engine.add({ projectId: 'p1', op: 'remove', kind: 'script_lines', id: 'L', record: line('L') })
  expect(t.engine.snapshot().waiting).toBe(0)
  t.clock.advance(1000)
  await settle()
  expect(t.engine.snapshot().online).toBe(true)
})

// Protects: design 6.7 (offline for a long time): before sending after a reconnect the session is refreshed; if it has ended nothing is sent (a guest's request would be answered 403 or 404 and the edits wrongly refused) and the entries stay stored for the next sign-in.
test('an ended session is not used to send waiting edits', async () => {
  let valid = false
  let checks = 0
  const t = tab(undefined, {
    refreshSession: () => {
      checks++
      return Promise.resolve(valid)
    },
  })
  t.engine.start()
  await settle()
  await t.engine.add(upd('n1'))
  await settle()
  expect(t.door.calls).toHaveLength(0)
  expect(t.engine.snapshot()).toMatchObject({ waiting: 1, failed: [] })
  valid = true
  t.engine.setOnline(true)
  await settle()
  expect(t.door.calls).toHaveLength(1)
  expect(checks).toBeGreaterThanOrEqual(2)
})

// Protects plan 7 D15 (offline sync plan's carried-over item): a waiting edit whose retry is
// on the backoff is sent at once when the connection is known to be back (`retryNow`), and the
// backoff then starts again from its first step.
test('retryNow sends a waiting edit at once', async () => {
  const t = await started()
  t.door.on('update', () => {
    throw unreachable()
  })
  await t.engine.add(upd('n1'))
  await settle()
  t.clock.advance(1000)
  await settle()
  expect(t.door.calls.filter((c) => c.method === 'update')).toHaveLength(2)
  expect(t.engine.snapshot()).toMatchObject({ online: false, waiting: 1 })

  t.engine.retryNow()
  await settle()
  expect(t.door.calls.filter((c) => c.method === 'update')).toHaveLength(3)
  t.clock.advance(999)
  await settle()
  expect(t.door.calls.filter((c) => c.method === 'update')).toHaveLength(3)
  t.clock.advance(1)
  await settle()
  expect(t.door.calls.filter((c) => c.method === 'update')).toHaveLength(4)

  t.door.on('update', (c) => node(c.id, { version: 9 }))
  t.engine.retryNow()
  await settle()
  expect(t.engine.snapshot()).toMatchObject({ online: true, waiting: 0 })
})
