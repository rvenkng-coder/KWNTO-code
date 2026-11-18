import { describe, expect, test } from 'vitest'
import { BackendError } from '../../../backend/errors'
import { line, node } from '../model/fixtures'
import { settle, tab } from './fakes'
import type { SyncEngine } from './syncEngine'

type Add = Parameters<SyncEngine['add']>[0]
const upd = (id: string, changes: Record<string, unknown>, baseValues: Record<string, unknown>, baseVersion = 3): Add =>
  ({ projectId: 'p1', op: 'update', kind: 'nodes', id, changes, baseVersion, baseValues, snapshot: null })
const createNode = (id: string): Add => ({ projectId: 'p1', op: 'create', kind: 'nodes', id, record: node(id) })
const createLine = (id: string): Add => ({ projectId: 'p1', op: 'create', kind: 'script_lines', id, record: line(id) })
const names = (t: ReturnType<typeof tab>) => t.door.calls.map((c) => `${c.method}:${c.kind}`)
const unreachable = () => new BackendError('unreachable', 0, {}, 'The server cannot be reached.')

async function started() {
  const t = tab()
  t.engine.start()
  await settle()
  return t
}

describe('order, success, offline, lost answers', () => {
  // Protects: D2: strict seq order, one request at a time; an entry leaves storage only after the server answered.
  test('entries are sent in order one at a time', async () => {
    const t = await started()
    t.door.gate(true)
    await t.engine.add(createNode('n1'))
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await t.engine.add(createLine('l1'))
    await settle()
    expect(names(t)).toEqual(['create:nodes'])
    expect(t.engine.snapshot().waiting).toBe(3)
    expect(await t.storage.list('u1')).toHaveLength(3)
    for (const [i, waiting] of [2, 1, 0].entries()) {
      t.door.releaseNext()
      await settle()
      expect(t.engine.snapshot().waiting).toBe(waiting)
      expect(await t.storage.list('u1')).toHaveLength(waiting)
      expect(names(t)).toHaveLength(Math.min(3, i + 2))
    }
    expect(names(t)).toEqual(['create:nodes', 'update:nodes', 'create:script_lines'])
  })

  // Protects: the store learns the saved record (its new version) when the server accepted the edit.
  test('a saved entry leaves the outbox and reports the record', async () => {
    const t = await started()
    t.door.on('update', () => node('n1', { title: 'B', version: 8 }))
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(t.log.saved).toHaveLength(1)
    expect(t.log.saved[0]![1]).toMatchObject({ id: 'n1', version: 8 })
    expect(await t.storage.list('u1')).toEqual([])
    expect(t.engine.snapshot().waiting).toBe(0)
  })

  // Protects: D7: backoff 1, 2, 4 s, reset by a success, and an immediate try when the browser says it is online again.
  test('an unreachable server is retried with backoff and at once when back online', async () => {
    const t = await started()
    let failures = 3
    t.door.on('update', (c) => {
      if (failures-- > 0) throw unreachable()
      return node(c.id, { version: 9 })
    })
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(t.door.calls).toHaveLength(1)
    expect(t.engine.snapshot().online).toBe(false)
    expect((await t.storage.list('u1'))[0]?.offline).toBe(true)
    for (const [wait, total] of [[1000, 2], [2000, 3], [4000, 4]] as const) {
      t.clock.advance(wait - 1)
      await settle()
      expect(t.door.calls).toHaveLength(total - 1)
      t.clock.advance(1)
      await settle()
      expect(t.door.calls).toHaveLength(total)
    }
    expect(t.engine.snapshot()).toMatchObject({ online: true, waiting: 0 })
    failures = 1
    await t.engine.add(upd('n2', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(t.door.calls).toHaveLength(5)
    t.clock.advance(1000)
    await settle()
    expect(t.door.calls).toHaveLength(6)
    t.engine.setOnline(false)
    await t.engine.add(upd('n3', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(t.door.calls).toHaveLength(6)
    t.engine.setOnline(true)
    await settle()
    expect(t.door.calls).toHaveLength(7)
  })

  // Protects: review focus 2: a save whose answer was lost is not mistaken for a conflict or a duplicate.
  test('a save whose answer was lost counts as done', async () => {
    const t = await started()
    t.door.on('create', () => { throw new BackendError('invalid', 400, { id: 'taken' }, 'Failed') })
    t.door.on('get', () => node('n1', { text: 'server' } as object))
    await t.engine.add(createNode('n1'))
    await settle()
    expect(t.log.saved).toHaveLength(1)
    expect(t.log.refused).toHaveLength(0)

    t.engine.setOnline(false)
    await t.engine.add({ projectId: 'p1', op: 'remove', kind: 'script_lines', id: 'l1', record: line('l1') })
    t.door.on('get', () => null)
    let retry: boolean | undefined
    t.door.on('update', (c) => {
      const options = c.args[2] as { shouldRetry?: (cur: unknown) => boolean }
      retry = options.shouldRetry?.(node('n2', { title: 'mine', version: 9 }))
      return node('n2', { title: 'mine', version: 10 })
    })
    await t.engine.add(upd('n2', { title: 'mine' }, { title: 'A' }))
    t.engine.setOnline(true)
    await settle()
    expect(t.log.saved).toHaveLength(3)
    expect(t.log.refused).toHaveLength(0)
    expect(t.engine.snapshot().conflict).toBeNull()
    expect(retry).toBe(true)
    expect(t.door.calls.some((c) => c.method === 'remove')).toBe(false)
  })
})
