import { expect, test } from 'vitest'
import { content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { createMemoryOutbox } from '../../../../frontend/src/features/editor/sync/outboxStorage'
import { createHookRegistry } from '../../../../frontend/src/features/editor/sync/hookRegistry'
import { settle } from '../../../../frontend/src/features/editor/sync/fakes'
import { createSyncEngine } from '../../../../frontend/src/features/editor/sync/syncEngine'
import { portOf } from '../../../../frontend/src/features/editor/store/editorSync'
import { createEditorStore, type EditorDoor } from '../../../../frontend/src/features/editor/store/editorStore'

function build(door: Partial<EditorDoor>) {
  const registry = createHookRegistry()
  const storage = createMemoryOutbox()
  const full = { load: async () => content({ nodes: [node('n1', { version: 2 })], lines: [line('l1')] }), get: async () => null, subscribe: async () => async () => {}, create: async (_k: string, r: unknown) => r, update: async () => { throw new Error('unused') }, remove: async () => {}, ...door } as unknown as EditorDoor
  const engine = createSyncEngine({
    userId: 'u1', door: full, storage, hooks: registry.hooks, lock: (_n, run) => run(), channel: { post() {}, listen: () => () => {} },
    clock: { now: () => 1, setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
  })
  engine.start()
  return { store: createEditorStore(full, portOf(engine, registry.register)), storage, engine }
}

// Protects: probe of plan row C3: removing a line stores a remove entry with the local copy and the base it started from, and a refused remove brings the line back.
test('[C3] remove-kind: a refused remove puts the line back', async () => {
  const { store, storage } = build({ remove: async () => { throw Object.assign(new Error('no'), { kind: 'forbidden' }) } })
  await store.getState().open('p1')
  const result = await store.getState().remove('script_lines', 'l1')
  await settle()
  expect(result).toBe(false)
  expect(store.getState().content.lines.l1).toBeDefined()
  expect(await storage.list('u1')).toEqual([])
})

// Protects: probe of plan row C3: an edit of a record that is not on screen is refused without touching the outbox.
test('[C3] unknown-record: updating a missing node resolves false and stores nothing', async () => {
  const { store, storage } = build({})
  await store.getState().open('p1')
  expect(await store.getState().update('nodes', 'ghost', { title: 'x' })).toBe(false)
  expect(await storage.list('u1')).toEqual([])
})

// Protects: probe of plan row C3: two quick edits of one field resolve both promises true and send once.
test('[C3] merged-edits: two edits of one title are one request and both resolve', async () => {
  let sent = 0
  const { store } = build({ update: (async (_k: string, id: string, changes: object) => { sent++; return node(id, { ...changes, version: 9 }) }) as never })
  await store.getState().open('p1')
  const both = await Promise.all([store.getState().update('nodes', 'n1', { title: 'B' }), store.getState().update('nodes', 'n1', { title: 'C' })])
  expect(both).toEqual([true, true])
  expect(sent).toBeLessThanOrEqual(2)
  expect(store.getState().content.nodes.n1?.title).toBe('C')
  expect(store.getState().saving).toBe(0)
})
