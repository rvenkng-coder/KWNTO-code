import { describe, expect, test } from 'vitest'
import { BackendError, EditConflict } from '../../../backend/errors'
import { TOO_BUSY } from '../../../backend/guarded'
import { line, node } from '../model/fixtures'
import { settle, sharedParts, tab } from './fakes'
import { createMemoryOutbox } from './outboxStorage'
import { createSyncEngine } from './syncEngine'
import type { SyncEngine } from './syncEngine'

type Add = Parameters<SyncEngine['add']>[0]
const upd = (
  id: string,
  changes: Record<string, unknown>,
  baseValues: Record<string, unknown>,
  baseVersion = 3,
): Add => ({ projectId: 'p1', op: 'update', kind: 'nodes', id, changes, baseVersion, baseValues, snapshot: null })
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
    for (const [wait, total] of [
      [1000, 2],
      [2000, 3],
      [4000, 4],
    ] as const) {
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
    t.door.on('create', () => {
      throw new BackendError('invalid', 400, { id: 'taken' }, 'Failed')
    })
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

describe('refusals, conflicts, two tabs', () => {
  // Protects: review focus 5: one refused entry does not block the queue and is not dropped: it waits in the failed list until dismissed.
  test('a refused entry goes to the failed list and the queue goes on', async () => {
    const t = await started()
    t.door.gate(true)
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await t.engine.add(upd('n2', { title: 'B' }, { title: 'A' }))
    await t.engine.add(upd('n3', { title: 'B' }, { title: 'A' }))
    t.door.on('update', (c) => {
      if (c.id === 'n2') throw new BackendError('forbidden', 403, {}, 'Not allowed.')
      return node(c.id, { version: 4 })
    })
    for (let i = 0; i < 3; i++) {
      t.door.releaseNext()
      await settle()
    }
    expect(t.door.calls.map((c) => c.id)).toEqual(['n1', 'n2', 'n3'])
    expect(t.log.refused).toHaveLength(1)
    const failed = t.engine.snapshot().failed
    expect(failed.map((f) => [f.entry.id, f.message])).toEqual([['n2', 'Not allowed.']])
    await t.engine.dismiss(failed[0]!.entry.seq)
    expect(t.engine.snapshot().failed).toEqual([])
    expect(await t.storage.failed('u1')).toEqual([])
  })

  const conflictOn = (t: Awaited<ReturnType<typeof started>>, server = node('n1', { title: 'Theirs', version: 9 })) => {
    let first = true
    t.door.on('update', (c) => {
      if (c.id === 'n1' && first) {
        first = false
        throw new EditConflict(server)
      }
      return node(c.id, { version: 10 })
    })
  }
  const offlineEdits = async (t: Awaited<ReturnType<typeof started>>) => {
    t.engine.setOnline(false)
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await t.engine.add(upd('n2', { title: 'B' }, { title: 'A' }))
    t.engine.setOnline(true)
    await settle()
  }

  // Protects: D4, D12: a real conflict stops the queue for the person; each choice is kept, and a deleted record can be re-created.
  test('a real conflict waits for the person and then keeps their choice', async () => {
    const mine = await started()
    conflictOn(mine)
    await offlineEdits(mine)
    expect(mine.engine.snapshot().conflict).toMatchObject({
      fields: ['title'],
      deleted: false,
      server: { title: 'Theirs' },
    })
    expect(mine.door.calls.map((c) => c.id)).toEqual(['n1'])
    await mine.engine.resolve('mine')
    await settle()
    expect(mine.door.calls.map((c) => c.id)).toEqual(['n1', 'n1', 'n2'])
    expect(mine.door.calls[1]!.args[1]).toBe(9)
    expect(mine.engine.snapshot()).toMatchObject({ conflict: null, waiting: 0 })

    const theirs = await started()
    conflictOn(theirs)
    await offlineEdits(theirs)
    await theirs.engine.resolve('theirs')
    await settle()
    expect(theirs.door.calls.map((c) => c.id)).toEqual(['n1', 'n2'])
    expect(theirs.log.theirs).toHaveLength(1)
    expect(theirs.log.theirs[0]![1]).toMatchObject({ title: 'Theirs' })
    expect(theirs.log.saved.map((a) => (a[0] as { id: string }).id)).toEqual(['n2'])

    const gone = await started()
    gone.door.on('update', () => {
      throw new BackendError('not-found', 404, {}, 'gone')
    })
    gone.engine.setOnline(false)
    await gone.engine.add({
      projectId: 'p1',
      op: 'update',
      kind: 'script_lines',
      id: 'l1',
      changes: { text: 'B' },
      baseVersion: 1,
      baseValues: { text: 'A' },
      snapshot: line('l1', { text: 'B' }),
    })
    gone.engine.setOnline(true)
    await settle()
    expect(gone.engine.snapshot().conflict).toMatchObject({ deleted: true, server: null })
    await gone.engine.resolve('mine')
    await settle()
    const created = gone.door.calls.find((c) => c.method === 'create')
    expect(created).toMatchObject({ kind: 'script_lines', id: 'l1' })
    expect((created!.args[0] as { text: string }).text).toBe('B')
  })

  // Protects: review focus 4: only the tab holding the lock sends, each entry once, and another tab takes over when the holder stops.
  test('only the tab holding the lock sends and another takes over', async () => {
    const shared = sharedParts()
    const a = tab(shared)
    const b = tab(shared)
    a.engine.start()
    await settle()
    b.engine.start()
    await settle()
    for (const id of ['n1', 'n2', 'n3']) await b.engine.add(upd(id, { title: 'B' }, { title: 'A' }))
    await settle()
    expect(shared.door.calls.map((c) => c.id)).toEqual(['n1', 'n2', 'n3'])
    expect(a.log.saved).toHaveLength(3)
    expect(b.log.saved).toHaveLength(3)
    await a.engine.stop()
    await b.engine.add(upd('n4', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(shared.door.calls.map((c) => c.id)).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(await shared.storage.list('u1')).toEqual([])
  })

  // Protects: design 5 "the later write wins": an edit made online is retried silently by the door and never raises the dialog.
  test('an edit made online is retried silently as before', async () => {
    const t = await started()
    t.door.on('update', () => {
      throw new BackendError('conflict', 409, {}, TOO_BUSY)
    })
    await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
    await settle()
    expect(t.door.calls[0]!.args).toHaveLength(2)
    expect(t.engine.snapshot().conflict).toBeNull()
    expect(t.engine.snapshot().failed.map((f) => f.message)).toEqual([TOO_BUSY])
  })
})

// Protects: engineering 9 "never discard a queued edit": Keep mine on a deleted record with no copy to re-create goes to the failed list.
test('keep mine without a copy to restore moves the entry to the failed list', async () => {
  const t = await started()
  t.door.on('update', () => {
    throw new BackendError('not-found', 404, {}, 'gone')
  })
  t.engine.setOnline(false)
  await t.engine.add({
    projectId: 'p1',
    op: 'update',
    kind: 'cues',
    id: 'q1',
    changes: { text: 'B' },
    baseVersion: 1,
    baseValues: { text: 'A' },
    snapshot: null,
  })
  t.engine.setOnline(true)
  await settle()
  await t.engine.resolve('mine')
  await settle()
  expect(t.engine.snapshot().failed).toHaveLength(1)
  expect(t.engine.snapshot().conflict).toBeNull()
  expect(t.log.refused).toHaveLength(1)
})

// Protects: D11 and the sign-out question: an edit still being stored already counts as waiting, so undo cannot slip in before it.
test('an edit that is still being stored already counts as waiting', async () => {
  const t = await started()
  t.engine.setOnline(false)
  const stored = t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
  expect(t.engine.snapshot().waiting).toBe(1)
  await stored
  expect(t.engine.snapshot().waiting).toBe(1)
})

// Protects: D12: Keep theirs drops only the conflicting fields; the other fields of the same waiting entry are still sent, on the server's version.
test('keep theirs still sends the fields that did not conflict', async () => {
  const t = await started()
  t.engine.setOnline(false)
  await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
  await t.engine.add(upd('n1', { color: 'red' }, { color: 'blue' }))
  let first = true
  t.door.on('update', (c) => {
    if (first) {
      first = false
      throw new EditConflict(node('n1', { title: 'Theirs', color: 'blue', version: 9 }))
    }
    return node(c.id, { version: 10 })
  })
  t.engine.setOnline(true)
  await settle()
  expect(t.engine.snapshot().conflict).toMatchObject({ fields: ['title'] })
  await t.engine.resolve('theirs')
  await settle()
  expect(t.door.calls).toHaveLength(2)
  expect(t.door.calls[1]!.args[0]).toEqual({ color: 'red' })
  expect(t.door.calls[1]!.args[1]).toBe(9)
  expect(t.log.theirs).toHaveLength(1)
  expect(t.engine.snapshot().waiting).toBe(0)
})

// Protects: a storage that fails (the page is closing and its IndexedDB connection is gone) must not raise an unhandled rejection from the engine's background work.
test('a failing storage does not leave an unhandled rejection', async () => {
  const storage = createMemoryOutbox()
  const broken = {
    ...storage,
    list: () => Promise.reject(new Error('closed database')),
    failed: () => Promise.reject(new Error('closed database')),
  }
  const t = tab(sharedParts())
  const engine = createSyncEngine({
    userId: 'u1',
    door: t.door.door,
    storage: broken,
    hooks: { saved() {}, refused() {}, theirs() {} },
    clock: t.clock,
    lock: (_n, run) => run(),
    channel: { post() {}, listen: () => () => {} },
  })
  engine.start()
  await settle()
  engine.setOnline(true)
  await settle()
  expect(engine.snapshot().waiting).toBe(0)
})

// Protects: design 6.7: a plain 404 with no server message (a proxy with no route, Tailscale serve switched off) is "cannot be reached" for the engine: an update waits, and a remove is not counted as already done.
test('a proxy answering a bare 404 keeps updates and removes waiting', async () => {
  const t = await started()
  const bare = () => {
    throw new BackendError('not-found', 404, {}, 'Request failed')
  }
  t.door.on('update', bare)
  t.door.on('remove', bare)
  t.door.on('get', bare)
  await t.engine.add(upd('n1', { title: 'B' }, { title: 'A' }))
  await t.engine.add({ projectId: 'p1', op: 'remove', kind: 'script_lines', id: 'l1', record: line('l1') })
  await settle()
  expect(t.engine.snapshot()).toMatchObject({ online: false, waiting: 2, failed: [] })
  expect(t.log.refused).toHaveLength(0)
  expect(t.log.saved).toHaveLength(0)
})
