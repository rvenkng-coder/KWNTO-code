import { expect, test } from 'vitest'
import { BackendError } from '../../../backend/errors'
import type { ProjectContent, RemoteEvent, StoryNode } from '../../../backend'
import { content, node } from '../model/fixtures'
import { settle } from '../sync/fakes'
import { createEditorStore, type EditorDoor } from './editorStore'

interface Deferred<T> {
  promise: Promise<T>
  resolve(v: T): void
  reject(e: unknown): void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// A door whose answers the test gives by hand. `loads` and `subscribes` hold one deferred per call.
function fakeDoor() {
  const loads: Array<Deferred<ProjectContent>> = []
  const subscribes: Array<{
    projectId: string
    emit: (e: RemoteEvent) => void
    ready: Deferred<() => Promise<void>>
    closed: boolean
  }> = []
  const updates: Array<{ args: unknown[]; answer: Deferred<StoryNode> }> = []
  const door: EditorDoor = {
    load: () => {
      const d = deferred<ProjectContent>()
      loads.push(d)
      return d.promise
    },
    get: () => Promise.resolve(null),
    subscribe: (projectId, emit) => {
      const sub = { projectId, emit, ready: deferred<() => Promise<void>>(), closed: false }
      subscribes.push(sub)
      return sub.ready.promise.then((close) => async () => {
        sub.closed = true
        await close()
      })
    },
    create: () => Promise.reject(new Error('unused')),
    update: ((...args: unknown[]) => {
      const d = deferred<StoryNode>()
      updates.push({ args, answer: d })
      return d.promise
    }) as EditorDoor['update'],
    remove: () => Promise.reject(new Error('unused')),
  }
  return { door, loads, subscribes, updates }
}

async function opened(
  fake: ReturnType<typeof fakeDoor>,
  c: ProjectContent = content({ nodes: [node('n1', { title: 'A', version: 3 })] }),
) {
  const store = createEditorStore(fake.door)
  const opening = store.getState().open('p1')
  fake.loads[0]?.resolve(c)
  fake.subscribes[0]?.ready.resolve(async () => {})
  await opening
  return store
}

// Protects: an edit shows at once; the answer brings the saved version, and only that.
test('an edit shows at once and takes the saved version', async () => {
  const fake = fakeDoor()
  const store = await opened(fake)
  const saving = store.getState().update('nodes', 'n1', { title: 'B' })
  expect(store.getState().content.nodes.n1?.title).toBe('B')
  expect(store.getState().saving).toBe(1)
  await settle()
  expect(fake.updates[0]?.args).toEqual(['nodes', 'n1', { title: 'B' }, 3])
  fake.updates[0]?.answer.resolve(node('n1', { title: 'B', version: 4 }))
  expect(await saving).toBe(true)
  expect(store.getState().content.nodes.n1?.version).toBe(4)
  expect(store.getState().saving).toBe(0)
})

// Protects: a refused edit puts the old value back and tells the person why.
test('a refused edit is rolled back with its message', async () => {
  const fake = fakeDoor()
  const store = await opened(fake)
  const saving = store.getState().update('nodes', 'n1', { title: 'B' })
  await settle()
  fake.updates[0]?.answer.reject(new BackendError('forbidden', 403, {}, 'm'))
  expect(await saving).toBe(false)
  expect(store.getState().content.nodes.n1?.title).toBe('A')
  expect(store.getState().error).toBe('m')
  store.getState().dismissError()
  expect(store.getState().error).toBeNull()
})

// Protects: a rollback undoes only the failed edit's fields, not a later edit of another field.
test('a rollback keeps edits of other fields made meanwhile', async () => {
  const fake = fakeDoor()
  const store = await opened(fake)
  const first = store.getState().update('nodes', 'n1', { title: 'B' })
  await settle()
  void store.getState().update('nodes', 'n1', { x: 50 })
  await settle()
  fake.updates[0]?.answer.reject(new BackendError('unknown', 0, {}, 'x'))
  await first
  expect(store.getState().content.nodes.n1).toMatchObject({ title: 'A', x: 50 })
})

// Protects: a teammate's newer change shows in the open project.
test("a teammate's change reaches the open project", async () => {
  const fake = fakeDoor()
  const store = await opened(fake)
  fake.subscribes[0]?.emit({ kind: 'nodes', action: 'update', record: node('n1', { title: 'Theirs', version: 4 }) })
  expect(store.getState().content.nodes.n1?.title).toBe('Theirs')
})

// Protects: opening another project, or closing, drops the slow answers of the one that was left.
test('a slow load of a project that was left is ignored', async () => {
  const fake = fakeDoor()
  const store = createEditorStore(fake.door)
  const openA = store.getState().open('A')
  const openB = store.getState().open('B')
  await Promise.resolve()
  fake.loads[1]?.resolve(
    content({
      project: { id: 'B', teamId: 't', name: 'B', startNodeId: null, deleted: false, deletedAt: null, version: 0 },
      nodes: [],
    }),
  )
  fake.subscribes[1]?.ready.resolve(async () => {})
  await openB
  fake.loads[0]?.resolve(content({ nodes: [node('fromA')] }))
  fake.subscribes[0]?.ready.resolve(async () => {})
  await openA
  expect(store.getState().content.project?.id).toBe('B')
  expect(store.getState().content.nodes).toEqual({})
  expect(fake.subscribes[0]?.closed).toBe(true)
  expect(fake.subscribes[1]?.closed).toBe(false)
})

// Protects: a project that cannot be loaded shows an error status, not a half-open editor.
test('a failed load leaves the editor in the error state and closes the subscription', async () => {
  const fake = fakeDoor()
  const store = createEditorStore(fake.door)
  const opening = store.getState().open('p1')
  fake.loads[0]?.reject(new BackendError('not-found', 404, {}, 'gone'))
  fake.subscribes[0]?.ready.resolve(async () => {})
  await opening
  expect(store.getState().status).toBe('error')
  expect(fake.subscribes[0]?.closed).toBe(true)
})

// Protects: events that arrive while the project is still loading are not lost.
test('a change that arrives during the load is applied after it', async () => {
  const fake = fakeDoor()
  const store = createEditorStore(fake.door)
  const opening = store.getState().open('p1')
  fake.subscribes[0]?.ready.resolve(async () => {})
  await Promise.resolve()
  fake.subscribes[0]?.emit({ kind: 'nodes', action: 'update', record: node('n1', { title: 'Early', version: 9 }) })
  fake.loads[0]?.resolve(content({ nodes: [node('n1', { title: 'Old', version: 3 })] }))
  await opening
  expect(store.getState().content.nodes.n1?.title).toBe('Early')
})
