import { useStore, type StoreApi } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { backend, type Backend, type ContentKind, type ContentRecords, type CreatableKind, type EditableFields, type RemoteEvent, type RemovableKind } from '../../../backend'
import { errorMessage } from '../../errorMessage'
import { applyRemote } from '../model/remote'
import { dropRecord, EMPTY_STATE, fromContent, getRecord, putRecord, type ContentState } from '../model/state'

// The editor's one store (plan Task 8). Screens read and change content only through it.
// An edit is applied at once, then sent through the door; a refusal puts it back.

export type EditorDoor = Pick<Backend['content'], 'load' | 'create' | 'update' | 'remove' | 'subscribe'>

export interface EditorStore {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  /** Door calls in flight (create, update, remove); a screen warns before unload while > 0. */
  saving: number
  content: ContentState
  open(projectId: string): Promise<void>
  close(): Promise<void>
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K]): Promise<boolean>
  update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>): Promise<boolean>
  remove(kind: RemovableKind, id: string): Promise<boolean>
  dismissError(): void
}

const SAVE_FAILED = 'Could not save this change.'
const OPEN_FAILED = 'This project does not exist or you are not a member of its team.'

type Closer = (() => Promise<void>) | null

function discard(close: Closer): void {
  if (close !== null) void close().catch(() => undefined)
}

// Only the fields the failed edit touched go back, so an edit of another field made
// meanwhile stays.
function restoreFields<K extends ContentKind>(s: ContentState, kind: K, id: string, before: ContentRecords[K], keys: string[]): ContentState {
  const current = getRecord(s, kind, id)
  if (current === undefined) return s
  const restored = { ...current } as Record<string, unknown>
  for (const key of keys) restored[key] = (before as unknown as Record<string, unknown>)[key]
  return putRecord(s, kind, restored as unknown as ContentRecords[K])
}

export function createEditorStore(door: EditorDoor): StoreApi<EditorStore> {
  let openToken = 0
  let closeSubscription: Closer = null

  return createStore<EditorStore>((set, get) => {
    const edit = (change: (s: ContentState) => ContentState) => set((st) => ({ content: change(st.content) }))
    const fail = (err: unknown) => set({ error: errorMessage(err, SAVE_FAILED) })

    // Runs one door call that follows an optimistic change; `undo` puts the change back.
    async function send(call: () => Promise<void>, undo: (s: ContentState) => ContentState): Promise<boolean> {
      set((st) => ({ saving: st.saving + 1 }))
      try {
        await call()
        return true
      } catch (err) {
        edit(undo)
        fail(err)
        return false
      } finally {
        set((st) => ({ saving: st.saving - 1 }))
      }
    }

    // Closing is not waited for: nothing the old project sends is applied once its token is stale.
    function stopSubscription(): void {
      const close = closeSubscription
      closeSubscription = null
      discard(close)
    }

    return {
      status: 'idle', error: null, saving: 0, content: EMPTY_STATE,

      async open(projectId) {
        const token = ++openToken
        stopSubscription()
        set({ status: 'loading', error: null, content: EMPTY_STATE })
        // Changes that arrive before the load is applied wait here (the version check drops stale ones).
        let buffer: RemoteEvent[] | null = []
        const onEvent = (event: RemoteEvent) => {
          if (token !== openToken) return
          if (buffer !== null) buffer.push(event)
          else edit((s) => applyRemote(s, event))
        }
        const [loaded, subscribed] = await Promise.allSettled([door.load(projectId), door.subscribe(projectId, onEvent)])
        const close: Closer = subscribed.status === 'fulfilled' ? subscribed.value : null
        if (token !== openToken) return discard(close)
        if (loaded.status === 'rejected' || subscribed.status === 'rejected') {
          discard(close)
          const reason = loaded.status === 'rejected' ? loaded.reason : (subscribed as PromiseRejectedResult).reason
          set({ status: 'error', error: errorMessage(reason, OPEN_FAILED) })
          return
        }
        closeSubscription = close
        let state = fromContent(loaded.value)
        for (const event of buffer) state = applyRemote(state, event)
        buffer = null
        set({ status: 'ready', content: state })
      },

      close() {
        openToken++
        stopSubscription()
        set({ status: 'idle', error: null, saving: 0, content: EMPTY_STATE })
        return Promise.resolve()
      },

      create(kind, record) {
        edit((s) => putRecord(s, kind, record))
        return send(
          async () => {
            const saved = await door.create(kind, record)
            edit((s) => (saved.version > (getRecord(s, kind, saved.id)?.version ?? -1) ? putRecord(s, kind, saved) : s))
          },
          (s) => dropRecord(s, kind, record.id),
        )
      },

      update(kind, id, changes) {
        const before = getRecord(get().content, kind, id)
        if (before === undefined) return Promise.resolve(false)
        edit((s) => putRecord(s, kind, { ...before, ...changes }))
        return send(
          async () => {
            const saved = await door.update(kind, id, changes, before.version)
            edit((s) => (saved.version > (getRecord(s, kind, id)?.version ?? -1) ? putRecord(s, kind, saved) : s))
          },
          (s) => restoreFields(s, kind, id, before, Object.keys(changes)),
        )
      },

      remove(kind, id) {
        const before = getRecord(get().content, kind, id)
        if (before === undefined) return Promise.resolve(false)
        edit((s) => dropRecord(s, kind, id))
        return send(() => door.remove(kind, id), (s) => putRecord(s, kind, before))
      },

      dismissError() {
        set({ error: null })
      },
    }
  })
}

// The door is looked up per call, so importing this module opens no connection.
export const editorStore = createEditorStore({
  load: (projectId) => backend.content.load(projectId),
  create: (kind, record) => backend.content.create(kind, record),
  update: (kind, id, changes, base) => backend.content.update(kind, id, changes, base),
  remove: (kind, id) => backend.content.remove(kind, id),
  subscribe: (projectId, onEvent) => backend.content.subscribe(projectId, onEvent),
})

export function useEditor<T>(selector: (s: EditorStore) => T): T {
  return useStore(editorStore, selector)
}
