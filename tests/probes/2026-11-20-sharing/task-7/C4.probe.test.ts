import { expect, test } from 'vitest'
import { BackendError } from '../../../../frontend/src/backend/errors'
import { node } from '../../../../frontend/src/features/editor/model/fixtures'
import { settle, tab } from '../../../../frontend/src/features/editor/sync/fakes'

const down = () => new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
const entry = { projectId: 'p1', op: 'update', kind: 'nodes', id: 'n1', changes: { title: 'B' }, baseVersion: 3, baseValues: { title: 'A' }, snapshot: null } as const
const updates = (t: ReturnType<typeof tab>) => t.door.calls.filter((c) => c.method === 'update').length

async function waitingEdit() {
  const t = tab()
  t.engine.start()
  await settle()
  t.door.on('update', () => { throw down() })
  await t.engine.add(entry)
  await settle()
  return t
}

// Protects: probe of plan row C4, a waiting edit on a long backoff is sent at once, and the backoff starts again from its first step.
test('[C4] boundary: after three failures retryNow sends at once and the next wait is 1 s again', async () => {
  const t = await waitingEdit()
  t.clock.advance(1000)
  await settle()
  t.clock.advance(2000)
  await settle()
  const before = updates(t)
  t.engine.retryNow()
  await settle()
  expect(updates(t)).toBe(before + 1)
  t.clock.advance(999)
  await settle()
  expect(updates(t)).toBe(before + 1)
  t.clock.advance(1)
  await settle()
  expect(updates(t)).toBe(before + 2)
})

// Protects: probe of plan row C4, retryNow with nothing waiting sends nothing and does not throw.
test('[C4] empty: retryNow on an idle engine does nothing', async () => {
  const t = tab()
  t.engine.start()
  await settle()
  t.engine.retryNow()
  await settle()
  expect(t.door.calls).toHaveLength(0)
  expect(t.engine.snapshot()).toMatchObject({ waiting: 0, failed: [] })
})

// Protects: probe of plan row C4, retryNow does not send the same edit twice at once and a success clears Offline.
test('[C4] idempotent: two retryNow calls in a row send one request, and a success empties the queue', async () => {
  const t = await waitingEdit()
  const before = updates(t)
  t.door.on('update', (c) => node(c.id, { version: 9 }))
  t.engine.retryNow()
  t.engine.retryNow()
  await settle()
  expect(updates(t)).toBe(before + 1)
  expect(t.engine.snapshot()).toMatchObject({ online: true, waiting: 0, failed: [] })
  expect(t.clock.pending()).toBe(0)
})
