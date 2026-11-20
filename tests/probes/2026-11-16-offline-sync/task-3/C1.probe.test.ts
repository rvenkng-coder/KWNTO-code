import { expect, test } from 'vitest'
import { settle, tab } from '../../../../frontend/src/features/editor/sync/fakes'

const upd = (title: string, baseVersion: number) =>
  ({ projectId: 'p1', op: 'update', kind: 'nodes', id: 'n1', changes: { title }, baseVersion, baseValues: { title: 'A' }, snapshot: null }) as const

// Protects: probe of plan row C1: an edit to a record whose entry is on the wire is sent as its own request, never merged into the in-flight one.
test('[C1] in-flight: a second edit of the same record while the first is sent is not merged away', async () => {
  const t = tab()
  t.engine.start()
  await settle()
  t.door.gate(true)
  await t.engine.add(upd('B', 3))
  await settle()
  await t.engine.add(upd('C', 4))
  t.door.releaseNext()
  await settle()
  t.door.releaseNext()
  await settle()
  expect(t.door.calls.map((c) => (c.args[0] as { title: string }).title)).toEqual(['B', 'C'])
  expect(await t.storage.list('u1')).toEqual([])
})

// Protects: probe of plan row C1: waiting edits of one record made before the lock is granted are merged or sent, never lost.
test('[C1] early-add: edits added before start are sent after it', async () => {
  const t = tab()
  await t.engine.add(upd('B', 3))
  expect(t.door.calls).toHaveLength(0)
  t.engine.start()
  await settle()
  expect(t.door.calls).toHaveLength(1)
})
