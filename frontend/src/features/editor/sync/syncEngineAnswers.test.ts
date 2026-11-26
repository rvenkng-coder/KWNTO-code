import { expect, test } from 'vitest'
import { BackendError } from '../../../backend/errors'
import { line, node } from '../model/fixtures'
import { settle, sharedParts, tab } from './fakes'
import type { SyncEngine } from './syncEngine'

// More engine behaviour (offline sync plan, whole-branch review): answers for cancelled edits, and answers in a tab that does not send.
type Add = Parameters<SyncEngine['add']>[0]
const upd = (
  id: string,
  changes: Record<string, unknown>,
  baseValues: Record<string, unknown>,
  baseVersion = 3,
): Add => ({ projectId: 'p1', op: 'update', kind: 'nodes', id, changes, baseVersion, baseValues, snapshot: null })
const createLine = (id: string): Add => ({ projectId: 'p1', op: 'create', kind: 'script_lines', id, record: line(id) })
async function started() {
  const t = tab()
  t.engine.start()
  await settle()
  return t
}

const seqOf = (a: unknown[]) => (a[0] as { seq: number }).seq

// Protects: engineering 9 and D11: a remove that cancels waiting work still answers the edits it cancelled (the record never reached the server, which is what the person asked for), so nothing stays pending.
test('a remove that cancels waiting edits still answers them', async () => {
  const t = await started()
  t.engine.setOnline(false)
  const created = await t.engine.add(createLine('L'))
  const updated = await t.engine.add({
    projectId: 'p1',
    op: 'update',
    kind: 'script_lines',
    id: 'L',
    changes: { text: 'x' },
    baseVersion: 0,
    baseValues: { text: 'L' },
    snapshot: null,
  })
  const removed = await t.engine.add({
    projectId: 'p1',
    op: 'remove',
    kind: 'script_lines',
    id: 'L',
    record: line('L'),
  })
  expect(removed).toBe(0)
  expect(await t.storage.list('u1')).toEqual([])
  expect(t.log.saved.map(seqOf).sort()).toEqual([created, updated].sort())
  expect(t.log.saved.every((a) => a[1] === null)).toBe(true)
})

// Protects: D9, review focus 4: in a tab that does not hold the lock the edits made there are still answered: saved, and refused (taken back), as in the tab that sends.
test('a tab that does not send still hears what happened to its own edits', async () => {
  const shared = sharedParts()
  const a = tab(shared)
  const b = tab(shared)
  a.engine.start()
  await settle()
  b.engine.start()
  await settle()
  shared.door.on('update', (c) => {
    if (c.id === 'n2') throw new BackendError('forbidden', 403, {}, 'Not allowed.')
    return node(c.id, { version: 7 })
  })
  await b.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
  await b.engine.add(upd('n2', { title: 'B' }, { title: 'A' }))
  await settle()
  expect(b.log.saved.map((x) => (x[0] as { id: string }).id)).toEqual(['n1'])
  expect(b.log.refused.map((x) => (x[0] as { id: string }).id)).toEqual(['n2'])
  expect((b.log.refused[0]![1] as Error).message).toBe('Not allowed.')
})
