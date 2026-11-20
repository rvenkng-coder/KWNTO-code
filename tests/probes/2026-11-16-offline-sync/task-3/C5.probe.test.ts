import { expect, test } from 'vitest'
import { BackendError } from '../../../../frontend/src/backend/errors'
import { settle, tab } from '../../../../frontend/src/features/editor/sync/fakes'

// Protects: probe of plan row C5: a refused create and a refused remove both leave the queue moving and stay in the failed list.
test('[C5] refused-kinds: a refused create then a remove that succeeds', async () => {
  const t = tab()
  t.engine.start()
  await settle()
  t.door.on('create', () => { throw new BackendError('invalid', 400, { text: 'too long' }, 'Too long.') })
  await t.engine.add({ projectId: 'p1', op: 'create', kind: 'script_lines', id: 'l1', record: { id: 'l1', projectId: 'p1' } as never })
  await t.engine.add({ projectId: 'p1', op: 'remove', kind: 'cues', id: 'q1', record: { id: 'q1' } as never })
  await settle()
  expect(t.door.calls.map((c) => c.method)).toEqual(['create', 'remove'])
  expect(t.engine.snapshot().failed.map((f) => f.message)).toEqual(['Too long.'])
})
