import { expect, test } from 'vitest'
import { content, line, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { createEdits } from '../../../../frontend/src/features/editor/store/edits'
import { createEditorStore, type EditorDoor } from '../../../../frontend/src/features/editor/store/editorStore'
import { portOf } from '../../../../frontend/src/features/editor/store/editorSync'
import { createHookRegistry } from '../../../../frontend/src/features/editor/sync/hookRegistry'
import { createMemoryOutbox } from '../../../../frontend/src/features/editor/sync/outboxStorage'
import { settle } from '../../../../frontend/src/features/editor/sync/fakes'
import { createSyncEngine } from '../../../../frontend/src/features/editor/sync/syncEngine'

// A door that never answers a write: offline, nothing can.
function silentDoor(): EditorDoor {
  const never = () => new Promise<never>(() => undefined)
  return {
    load: () => Promise.resolve(content({ nodes: [node('n1', { title: 'A' })] })),
    get: () => Promise.resolve(null),
    subscribe: () => Promise.resolve(async () => {}),
    create: never as unknown as EditorDoor['create'],
    update: never as unknown as EditorDoor['update'],
    remove: never as unknown as EditorDoor['remove'],
  }
}

async function offlineEditor() {
  const door = silentDoor()
  const registry = createHookRegistry()
  const engine = createSyncEngine({
    userId: 'u1', door, storage: createMemoryOutbox(), hooks: registry.hooks, lock: (_n, run) => run(),
    channel: { post: () => undefined, listen: () => () => undefined },
    clock: { now: () => 1, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
  })
  engine.start()
  await settle()
  const store = createEditorStore(door, portOf(engine, registry.register))
  await store.getState().open('p1')
  await settle()
  engine.setOnline(false)
  await settle()
  return { store, edits: createEdits(store, () => undefined) }
}

// Protects: probe of plan row C7 / D15, offline a group closes when its edits are stored, so the next edit is a step of its own.
test('[C7] stale-after-change: an offline group then a rename undo one at a time', async () => {
  const { store, edits } = await offlineEditor()
  await edits.group('Add line', async () => {
    await edits.create('script_lines', line('L1', { nodeId: 'n1' }), 'Add line')
  })
  await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')
  await edits.undo()
  expect(store.getState().content.nodes.n1?.title).toBe('A')
  expect(store.getState().content.lines.L1).toBeDefined()
  expect(store.getState().error).toBeNull()
})

// Protects: probe of plan row C7, a group of several records is still ONE step offline.
test('[C7] equivalence: two creates in one offline group are undone together', async () => {
  const { store, edits } = await offlineEditor()
  await edits.group('Add lines', async () => {
    await Promise.all([
      edits.create('script_lines', line('L1', { nodeId: 'n1' }), 'Add line'),
      edits.create('script_lines', line('L2', { nodeId: 'n1' }), 'Add line'),
    ])
  })
  await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')
  await edits.undo()
  expect(store.getState().content.lines.L1).toBeDefined()
  expect(store.getState().content.lines.L2).toBeDefined()
  await edits.undo()
  expect(store.getState().content.lines.L1).toBeUndefined()
  expect(store.getState().content.lines.L2).toBeUndefined()
})
