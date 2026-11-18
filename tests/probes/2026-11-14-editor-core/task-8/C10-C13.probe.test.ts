import { expect, test } from 'vitest'
import { BackendError } from '../../../../frontend/src/backend/errors'
import { content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { createEditorStore, type EditorDoor } from '../../../../frontend/src/features/editor/store/editorStore'

function door(over: Partial<EditorDoor> = {}): EditorDoor {
  return {
    load: () => Promise.resolve(content({ nodes: [node('n1', { title: 'A', version: 1 })] })),
    subscribe: () => Promise.resolve(async () => {}),
    create: (_k, r) => Promise.resolve(r),
    update: () => Promise.reject(new Error('unused')),
    remove: () => Promise.resolve(),
    ...over,
  } as EditorDoor
}

// Protects: an edit of an unknown record is refused without calling the door.
test('[C10] empty-one-huge: updating a record that is not there', async () => {
  let called = 0
  const store = createEditorStore(door({ update: (() => { called++; return Promise.reject(new Error('x')) }) as EditorDoor['update'] }))
  await store.getState().open('p1')
  expect(await store.getState().update('nodes', 'ghost', { title: 'x' })).toBe(false)
  expect(called).toBe(0)
  expect(store.getState().saving).toBe(0)
})

// Protects: the saved record with an older version than the local one does not replace it.
test('[C10] two-bad-items: an answer older than the local copy is not applied', async () => {
  const store = createEditorStore(door({ update: (() => Promise.resolve(node('n1', { title: 'stale', version: 0 }))) as EditorDoor['update'] }))
  await store.getState().open('p1')
  await store.getState().update('nodes', 'n1', { title: 'B' })
  expect(store.getState().content.nodes.n1?.title).toBe('B')
})

// Protects: a refused create removes the new record again; a refused remove brings it back.
test('[C11] helper-hides-bug: create and remove roll back', async () => {
  const no = new BackendError('forbidden', 403, {}, 'no')
  const store = createEditorStore(door({ create: () => Promise.reject(no), remove: () => Promise.reject(no) }))
  await store.getState().open('p1')
  expect(await store.getState().create('nodes', node('new'))).toBe(false)
  expect(store.getState().content.nodes.new).toBeUndefined()
  const lineRec = { id: 'l1', projectId: 'p1', nodeId: 'n1', character: '', text: 't', sortOrder: 1, version: 0 }
  await store.getState().open('p1')
  store.setState((s) => ({ content: { ...s.content, lines: { l1: lineRec } } }))
  expect(await store.getState().remove('script_lines', 'l1')).toBe(false)
  expect(store.getState().content.lines.l1).toEqual(lineRec)
  expect(store.getState().error).toBe('no')
})

// Protects: after close, an event from the closed project changes nothing and the state is empty.
test('[C12] second-bad-item: close empties the store and ignores later events', async () => {
  let emit: (e: Parameters<Parameters<EditorDoor['subscribe']>[1]>[0]) => void = () => {}
  let closed = false
  const store = createEditorStore(door({ subscribe: (_p, cb) => { emit = cb; return Promise.resolve(async () => { closed = true }) } }))
  await store.getState().open('p1')
  await store.getState().close()
  emit({ kind: 'nodes', action: 'update', record: node('n1', { title: 'late', version: 9 }) })
  expect(closed).toBe(true)
  expect(store.getState().status).toBe('idle')
  expect(store.getState().content.nodes).toEqual({})
})

// Protects: a second open of the same project after a close shows the fresh load.
test('[C13] two-bad-items: reopening loads again', async () => {
  let n = 0
  const store = createEditorStore(door({ load: () => Promise.resolve(content({ nodes: [node('n1', { title: `load${++n}` })] })) }))
  await store.getState().open('p1')
  await store.getState().close()
  await store.getState().open('p1')
  expect(store.getState().content.nodes.n1?.title).toBe('load2')
  expect(store.getState().status).toBe('ready')
})
