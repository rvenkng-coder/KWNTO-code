import { expect, test } from 'vitest'
import { BackendError, EditConflict } from '../../../backend/errors'
import { node } from '../model/fixtures'
import { settle, sharedParts, tab } from './fakes'
import type { SyncEngine } from './syncEngine'

// What a tab that does not send shows and can do (offline sync plan, whole-branch review I4): the offline state and the conflict of the tab that sends.
type Add = Parameters<SyncEngine['add']>[0]
const upd = (id: string, title: string): Add => ({
  projectId: 'p1',
  op: 'update',
  kind: 'nodes',
  id,
  changes: { title },
  baseVersion: 3,
  baseValues: { title: 'A' },
  snapshot: null,
})

async function twoTabs() {
  const shared = sharedParts()
  const a = tab(shared)
  const b = tab(shared)
  a.engine.start()
  await settle()
  b.engine.start()
  await settle()
  return { shared, a, b }
}

// Protects: D3: a tab that does not send shows `Offline` when the tab that sends cannot reach the server, and marks its own edits offline, so they can raise the conflict dialog instead of silently overwriting a teammate.
test('a tab that does not send follows the server being unreachable', async () => {
  const { shared, a, b } = await twoTabs()
  shared.door.on('update', () => {
    throw new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
  })
  await a.engine.add(upd('n1', 'B'))
  await settle()
  expect(a.engine.snapshot().online).toBe(false)
  expect(b.engine.snapshot().online).toBe(false)
  await b.engine.add(upd('n2', 'B'))
  expect((await shared.storage.list('u1')).find((e) => e.id === 'n2')?.offline).toBe(true)
})

// Protects: D12: the conflict dialog can be answered from any tab: a tab that does not send sees the conflict of the one that sends, and its answer reaches it.
test('a conflict is shown and answered in a tab that does not send', async () => {
  const { shared, a, b } = await twoTabs()
  let first = true
  shared.door.on('update', (c) => {
    if (first) {
      first = false
      throw new EditConflict(node('n1', { title: 'Theirs', version: 9 }))
    }
    return node(c.id, { version: 10 })
  })
  b.engine.setOnline(false)
  await b.engine.add(upd('n1', 'Mine'))
  b.engine.setOnline(true)
  await settle()
  expect(a.engine.snapshot().conflict).not.toBeNull()
  expect(b.engine.snapshot().conflict).toMatchObject({ fields: ['title'], server: { title: 'Theirs' } })

  await b.engine.resolve('mine')
  await settle()
  expect(shared.door.calls).toHaveLength(2)
  expect(shared.door.calls[1]!.args[1]).toBe(9)
  expect(a.engine.snapshot().conflict).toBeNull()
  expect(b.engine.snapshot().conflict).toBeNull()
})

// Protects: a tab opened after the conflict arose still learns about it.
test('a tab opened later sees the open conflict', async () => {
  const shared = sharedParts()
  const a = tab(shared)
  a.engine.start()
  await settle()
  shared.door.on('update', () => {
    throw new EditConflict(node('n1', { title: 'Theirs', version: 9 }))
  })
  a.engine.setOnline(false)
  await a.engine.add(upd('n1', 'Mine'))
  a.engine.setOnline(true)
  await settle()
  expect(a.engine.snapshot().conflict).not.toBeNull()
  const late = tab(shared)
  late.engine.start()
  await settle()
  expect(late.engine.snapshot().conflict).not.toBeNull()
})
