import { expect, test } from 'vitest'
import { BackendError } from '../../../backend/errors'
import type { ProjectContent, RemoteEvent, StoryNode } from '../../../backend'
import { content, node } from '../model/fixtures'
import { createMemoryOutbox, type OutboxStorage } from '../sync/outboxStorage'
import { createSyncEngine } from '../sync/syncEngine'
import { settle } from '../sync/fakes'
import { portOf } from './editorSync'
import { createEditorStore, type EditorDoor } from './editorStore'
import { createHookRegistry } from '../sync/hookRegistry'

type Update = { args: unknown[]; resolve(n: StoryNode): void; reject(e: unknown): void }

// A door the test answers by hand: loads answer at once from `pages`, updates wait for the test.
function fakeDoor(pages: ProjectContent[]) {
  const updates: Update[] = []
  const loads: string[] = []
  const reconnects: Array<() => void> = []
  const events: Array<(e: RemoteEvent) => void> = []
  let server: StoryNode | null = null
  const door: EditorDoor = {
    load: () => Promise.resolve(pages[Math.min(loads.push('p1') - 1, pages.length - 1)]!),
    get: () => Promise.resolve(server) as never,
    subscribe: (_id, onEvent, onReconnect) => {
      events.push(onEvent)
      if (onReconnect !== undefined) reconnects.push(onReconnect)
      return Promise.resolve(async () => {})
    },
    create: () => Promise.reject(new Error('unused')),
    update: ((...args: unknown[]) => new Promise<StoryNode>((resolve, reject) => updates.push({ args, resolve, reject }))) as EditorDoor['update'],
    remove: () => Promise.reject(new Error('unused')),
  }
  return { door, updates, loads, reconnects, events, setServer: (n: StoryNode) => { server = n } }
}

// A store on a real sync engine over a memory outbox the test can pre-fill.
async function setup(pages: ProjectContent[], prefill: Array<Record<string, unknown>> = [], startEngine = true) {
  const fake = fakeDoor(pages)
  const storage: OutboxStorage = createMemoryOutbox()
  for (const e of prefill) await storage.add({ userId: 'u1', projectId: 'p1', offline: false, made: 1, ...e } as never)
  const registry = createHookRegistry()
  const engine = createSyncEngine({
    userId: 'u1', door: fake.door, storage, hooks: registry.hooks, lock: (_n, run) => run(),
    channel: { post: () => {}, listen: () => () => {} },
    clock: { now: () => 1, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
  })
  if (startEngine) {
    engine.start()
    await settle()
  }
  const store = createEditorStore(fake.door, portOf(engine, registry.register))
  return { fake, storage, engine, store }
}

const n1 = (over: Partial<StoryNode> = {}) => node('n1', { title: 'A', version: 4, ...over })
const open = async (s: Awaited<ReturnType<typeof setup>>) => {
  await s.store.getState().open('p1')
  await settle()
}

// Protects: design 6.7 / D1: an edit is stored with the version and values it started from, and shows at once.
test('an edit is stored with the version and value it started from', async () => {
  const s = await setup([content({ nodes: [n1()] })])
  await open(s)
  const saving = s.store.getState().update('nodes', 'n1', { title: 'B' })
  expect(s.store.getState().content.nodes.n1?.title).toBe('B')
  await settle()
  expect(await s.storage.list('u1')).toMatchObject([{ op: 'update', id: 'n1', changes: { title: 'B' }, baseVersion: 4, baseValues: { title: 'A' } }])
  s.fake.updates[0]!.resolve(n1({ title: 'B', version: 5 }))
  expect(await saving).toBe(true)
  expect(s.store.getState().content.nodes.n1?.version).toBe(5)
})

// Protects: decision 0002 finding E: edits waiting from an earlier session show over a freshly loaded project, then save.
test('waiting edits are shown over a freshly loaded project', async () => {
  const s = await setup([content({ nodes: [n1({ color: 'red' })] })], [
    { op: 'update', kind: 'nodes', id: 'n1', changes: { color: 'blue' }, baseVersion: 4, baseValues: { color: 'red' }, snapshot: null },
  ])
  await open(s)
  expect(s.store.getState().content.nodes.n1?.color).toBe('blue')
  s.fake.updates[0]!.resolve(n1({ color: 'blue', version: 5 }))
  await settle()
  expect(s.store.getState().content.nodes.n1).toMatchObject({ color: 'blue', version: 5 })
})

// Protects: review focus 3: a live event from a teammate does not hide my waiting edit.
test("a teammate's live change does not hide my waiting edit", async () => {
  const s = await setup([content({ nodes: [n1()] })])
  await open(s)
  void s.store.getState().update('nodes', 'n1', { color: 'blue' })
  await settle()
  s.fake.events[0]!({ kind: 'nodes', action: 'update', record: n1({ title: 'Theirs', color: 'red', version: 9 }) })
  expect(s.store.getState().content.nodes.n1).toMatchObject({ title: 'Theirs', color: 'blue' })
})

// Protects: D6: a reconnect loads the project again and lays the waiting edits over it.
test('a reconnect reloads the project and keeps waiting edits', async () => {
  const s = await setup([
    content({ nodes: [n1()] }),
    content({ nodes: [n1({ title: 'Theirs', version: 9 }), node('n2')] }),
  ])
  await open(s)
  void s.store.getState().update('nodes', 'n1', { color: 'blue' })
  await settle()
  s.fake.reconnects[0]!()
  await settle()
  expect(s.fake.loads).toHaveLength(2)
  expect(Object.keys(s.store.getState().content.nodes).sort()).toEqual(['n1', 'n2'])
  expect(s.store.getState().content.nodes.n1).toMatchObject({ title: 'Theirs', color: 'blue' })
})

// Protects: D8: an entry refused after a reload has no local copy to undo from, so the server's copy is shown and the entry is listed as failed.
test('a refused edit from before a reload shows the server\'s copy', async () => {
  const s = await setup([content({ nodes: [n1({ title: 'Server', version: 6 })] })], [
    { op: 'update', kind: 'nodes', id: 'n1', changes: { title: 'Mine' }, baseVersion: 4, baseValues: { title: 'A' }, snapshot: null },
  ])
  s.fake.setServer(n1({ title: 'Server', version: 6 }))
  await open(s)
  expect(s.store.getState().content.nodes.n1?.title).toBe('Mine')
  s.fake.updates[0]!.reject(new BackendError('forbidden', 403, {}, 'Not allowed.'))
  await settle()
  expect(s.store.getState().content.nodes.n1?.title).toBe('Server')
  expect(s.engine.snapshot().failed.map((f) => f.message)).toEqual(['Not allowed.'])
})

// Protects: finding E: waiting edits the engine only learned about after the project loaded (the outbox was still being read) are laid over it then.
test('waiting edits that become known after the load are laid over the project', async () => {
  const s = await setup([content({ nodes: [n1({ color: 'red' })] })], [
    { op: 'update', kind: 'nodes', id: 'n1', changes: { color: 'blue' }, baseVersion: 4, baseValues: { color: 'red' }, snapshot: null },
  ], false)
  await open(s)
  expect(s.store.getState().content.nodes.n1?.color).toBe('red')
  s.engine.start()
  await settle()
  expect(s.store.getState().content.nodes.n1?.color).toBe('blue')
})

// Protects: D6 / never regress: a reload that was read before my save landed never puts an older copy over the newer one on screen.
test('a reload never replaces a record with an older copy', async () => {
  const s = await setup([content({ nodes: [n1()] }), content({ nodes: [n1()] })])
  await open(s)
  const saving = s.store.getState().update('nodes', 'n1', { title: 'B' })
  await settle()
  s.fake.updates[0]!.resolve(n1({ title: 'B', version: 5 }))
  await saving
  s.fake.reconnects[0]!()
  await settle()
  expect(s.fake.loads).toHaveLength(2)
  expect(s.store.getState().content.nodes.n1).toMatchObject({ title: 'B', version: 5 })
})
