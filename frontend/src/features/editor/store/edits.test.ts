import { expect, test } from 'vitest'
import type { ContentKind, ContentRecords, ProjectContent, RemoteEvent } from '../../../backend'
import { BackendError } from '../../../backend/errors'
import { chapter, content, line, node } from '../model/fixtures'
import { UNDO_BLOCKED } from '../model/history'
import { createMemoryOutbox } from '../sync/outboxStorage'
import { createHookRegistry } from '../sync/hookRegistry'
import { createSyncEngine } from '../sync/syncEngine'
import { settle } from '../sync/fakes'
import { createEdits } from './edits'
import { portOf } from './editorSync'
import { createEditorStore, type EditorDoor } from './editorStore'
import { UNDO_PAUSED } from './editorSync'

// A door that answers at once: an update returns the merged record one version higher.
// `refuse` makes the next call fail; `calls` lists what was sent.
function autoDoor(start: ProjectContent) {
  const records = new Map<string, Record<string, unknown>>()
  for (const r of [...start.chapters, ...start.nodes, ...start.lines]) records.set(r.id, { ...r })
  const calls: string[] = []
  let emit: (e: RemoteEvent) => void = () => undefined
  const refuse = { next: false }
  const check = () => {
    if (!refuse.next) return
    refuse.next = false
    throw new BackendError('forbidden', 403, {}, 'no')
  }
  const door: EditorDoor = {
    load: () => Promise.resolve(start),
    get: () => Promise.resolve(null),
    subscribe: (_p, onEvent) => { emit = onEvent; return Promise.resolve(async () => {}) },
    create: (async (kind: ContentKind, record: ContentRecords[ContentKind]) => {
      calls.push(`create ${kind} ${record.id}`)
      check()
      records.set(record.id, { ...record })
      return record
    }) as EditorDoor['create'],
    update: (async (kind: ContentKind, id: string, changes: Record<string, unknown>) => {
      calls.push(`update ${kind} ${id} ${JSON.stringify(changes)}`)
      check()
      const next = { ...records.get(id), ...changes, version: Number(records.get(id)?.version ?? 0) + 1 }
      records.set(id, next)
      return next
    }) as EditorDoor['update'],
    remove: async (kind, id) => {
      calls.push(`remove ${kind} ${id}`)
      check()
      records.delete(id)
    },
  }
  return { door, calls, refuse, emit: (e: RemoteEvent) => emit(e) }
}

async function setup(start: ProjectContent = content({ nodes: [node('n1', { title: 'A' })] })) {
  const fake = autoDoor(start)
  const store = createEditorStore(fake.door)
  await store.getState().open('p1')
  let flushed = 0
  const edits = createEdits(store, () => { flushed++ })
  return { fake, store, edits, flushed: () => flushed }
}

// Protects: Review Focus 4 and D5: undo never overwrites a teammate's later change; the step is skipped.
test("undo never overwrites a teammate's later change", async () => {
  const { fake, store, edits } = await setup()
  await edits.update('nodes', 'n1', { color: 'red' }, 'Recolour node')
  await edits.update('nodes', 'n1', { title: 'Mine' }, 'Rename node')
  fake.emit({ kind: 'nodes', action: 'update', record: node('n1', { title: 'Theirs', color: 'red', version: 10 }) })
  fake.calls.length = 0
  await edits.undo()
  expect(fake.calls).toEqual([])
  expect(store.getState().error).toBe(UNDO_BLOCKED)
  expect(store.getState().content.nodes.n1?.title).toBe('Theirs')
  await edits.undo()
  expect(fake.calls).toEqual(['update nodes n1 {"color":"slate"}'])
})

// Protects: a refused write is not recorded, so undo does not try to undo something that never happened.
test('a step is recorded only after its writes succeed', async () => {
  const { fake, edits } = await setup()
  fake.refuse.next = true
  expect(await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')).toBe(false)
  fake.calls.length = 0
  await edits.undo()
  expect(fake.calls).toEqual([])
})

// Protects: a group (a multi-node drag) is one step; undo flushes pending text first and redo applies it again.
test('a group is one step, undone and redone together', async () => {
  const { fake, store, edits, flushed } = await setup(content({ nodes: [node('a'), node('b')] }))
  await edits.group('Move 2 nodes', async () => {
    await edits.update('nodes', 'a', { x: 10 }, 'Move node')
    await edits.update('nodes', 'b', { x: 20 }, 'Move node')
  })
  await edits.undo()
  expect(flushed()).toBe(1)
  expect(store.getState().content.nodes.a?.x).toBe(0)
  expect(store.getState().content.nodes.b?.x).toBe(0)
  fake.calls.length = 0
  await edits.redo()
  expect(fake.calls).toEqual(['update nodes a {"x":10}', 'update nodes b {"x":20}'])
})

// Protects: a new node is undone by trashing it, a removed line comes back with its id, and paste makes one step.
test('creates, removes and pastes undo as one would expect', async () => {
  const { store, edits } = await setup(content({
    chapters: [chapter('c1'), chapter('c2')], nodes: [node('n1')], lines: [line('l1', { nodeId: 'n1', text: 'Hi' })],
  }))
  await edits.create('nodes', node('n2'), 'Add node')
  await edits.undo()
  expect(store.getState().content.nodes.n2?.deleted).toBe(true)
  await edits.remove('script_lines', 'l1', 'Delete line')
  await edits.undo()
  expect(store.getState().content.lines.l1?.text).toBe('Hi')
  edits.copy(['n1'])
  await edits.paste('c2')
  const pasted = Object.values(store.getState().content.nodes).filter((n) => n.chapterId === 'c2')
  expect(pasted).toHaveLength(1)
  expect(Object.values(store.getState().content.lines).filter((l) => l.nodeId === pasted[0]?.id)).toHaveLength(1)
  await edits.undo()
  expect(store.getState().content.nodes[pasted[0]?.id as string]?.deleted).toBe(true)
})

// Protects: an edit started before a group opened stays its own step, even when it finishes inside the group.
test('an edit that started before a group is not part of it', async () => {
  const { store, edits } = await setup(content({ nodes: [node('a'), node('b')] }))
  const early = edits.update('nodes', 'a', { title: 'Typed' }, 'Edit title')
  await edits.group('Move node', async () => {
    await edits.update('nodes', 'b', { x: 5 }, 'Move node')
  })
  await early
  await edits.undo()
  expect(store.getState().content.nodes.b?.x).toBe(0)
  expect(store.getState().content.nodes.a?.title).toBe('Typed')
  await edits.undo()
  expect(store.getState().content.nodes.a?.title).toBe('a')
})

// Protects: Ctrl+Z pressed while a save is still finishing undoes that save, not the step before it.
test('undo waits for an edit still on its way', async () => {
  const { store, edits } = await setup()
  await edits.update('nodes', 'n1', { color: 'red' }, 'Recolour node')
  void edits.update('nodes', 'n1', { title: 'Mine' }, 'Rename node')
  await edits.undo()
  expect(store.getState().content.nodes.n1?.title).toBe('A')
  expect(store.getState().content.nodes.n1?.color).toBe('red')
})

// Protects: D11: while offline with changes waiting, undo does nothing but say why, and the step stays; it works once the pause ends.
test('undo waits while offline changes are waiting', async () => {
  const fake = autoDoor(content({ nodes: [node('n1', { title: 'A' })] }))
  const store = createEditorStore(fake.door)
  await store.getState().open('p1')
  let paused: string | null = UNDO_PAUSED
  const edits = createEdits(store, () => {}, () => paused)
  await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')
  fake.calls.length = 0
  await edits.undo()
  expect(fake.calls).toEqual([])
  expect(store.getState().error).toBe(UNDO_PAUSED)
  expect(store.getState().content.nodes.n1?.title).toBe('B')
  paused = null
  await edits.undo()
  expect(store.getState().content.nodes.n1?.title).toBe('A')
})

// Protects plan 7 D15 (the offline undo group carried over from the offline sync plan): while
// offline a group closes when its edits are STORED, not when the server answers, so an edit
// made after it is a step of its own. Nothing here answers the door; one undo takes back only
// the rename.
test('an offline group closes when its edits are stored', async () => {
  const fake = autoDoor(content({ nodes: [node('n1', { title: 'A' })] }))
  const door: EditorDoor = { ...fake.door, create: (() => new Promise(() => undefined)) as EditorDoor['create'], update: (() => new Promise(() => undefined)) as EditorDoor['update'] }
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
  const edits = createEdits(store, () => undefined)

  await edits.group('Add line', async () => {
    await edits.create('script_lines', line('L1', { nodeId: 'n1' }), 'Add line')
  })
  await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')
  expect(store.getState().content.lines.L1).toBeDefined()
  expect(store.getState().content.nodes.n1?.title).toBe('B')

  await edits.undo()
  expect(store.getState().content.nodes.n1?.title).toBe('A')
  expect(store.getState().content.lines.L1).toBeDefined()
})

// Protects the whole-branch review finding M3 (plan 7 D15): an offline edit resolves when stored,
// so its undo step exists before the server has answered. When the server refuses it after the
// reconnect, the screen is put back AND the step leaves the history; otherwise Ctrl+Z would meet
// a step for a change that is not there and stay blocked in front of every earlier step.
test('an offline edit the server later refuses leaves no dead undo step', async () => {
  const fake = autoDoor(content({ nodes: [node('n1', { title: 'A' })] }))
  const refuse = (changes: Record<string, unknown>) => 'color' in changes
  const door: EditorDoor = {
    ...fake.door,
    update: ((kind: ContentKind, id: string, changes: Record<string, unknown>, ...rest: unknown[]) => {
      if (refuse(changes)) return Promise.reject(new BackendError('forbidden', 403, {}, 'no'))
      return (fake.door.update as (...a: unknown[]) => Promise<unknown>)(kind, id, changes, ...rest)
    }) as EditorDoor['update'],
  }
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
  const edits = createEdits(store, () => undefined)

  expect(await edits.update('nodes', 'n1', { title: 'B' }, 'Rename node')).toBe(true)
  expect(await edits.update('nodes', 'n1', { color: 'red' }, 'Recolour node')).toBe(true)
  engine.setOnline(true)
  await settle()
  await settle()
  expect(store.getState().content.nodes.n1?.color).not.toBe('red')

  await edits.undo()
  expect(store.getState().error).not.toBe(UNDO_BLOCKED)
  expect(store.getState().content.nodes.n1?.title).toBe('A')
})
