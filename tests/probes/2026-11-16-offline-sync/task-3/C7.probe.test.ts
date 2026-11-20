import { expect, test } from 'vitest'
import { settle, sharedParts, tab } from '../../../../frontend/src/features/editor/sync/fakes'

// Protects: probe of plan row C7: stopping an engine twice, or one that never started, is harmless and sends nothing more.
test('[C7] double-stop: stop is idempotent and an engine that never started can stop', async () => {
  const shared = sharedParts()
  const a = tab(shared)
  await a.engine.stop()
  const b = tab(shared)
  b.engine.start()
  await settle()
  await b.engine.stop()
  await b.engine.stop()
  await b.engine.add({ projectId: 'p1', op: 'create', kind: 'nodes', id: 'n1', record: { id: 'n1' } as never })
  await settle()
  expect(shared.door.calls).toHaveLength(0)
  expect(await shared.storage.list('u1')).toHaveLength(1)
})

// Protects: probe of plan row C7: the entries of another user in the same storage are never sent by this engine.
test('[C7] other-user: entries of another account are not sent', async () => {
  const shared = sharedParts()
  await shared.storage.add({ userId: 'u2', projectId: 'p1', op: 'create', kind: 'nodes', id: 'x', record: { id: 'x' } as never, offline: false, made: 1 })
  const a = tab(shared)
  a.engine.start()
  await settle()
  expect(shared.door.calls).toHaveLength(0)
  expect(a.engine.snapshot().waiting).toBe(0)
})
