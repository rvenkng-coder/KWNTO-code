import { useStore, type StoreApi } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { backend, type Backend, type ContentKind, type ContentRecords, type CreatableKind, type EditableFields, type RemovableKind } from '../../../backend'
import { EMPTY_STATE, type ContentState } from '../model/state'
import { createEdits } from './editorEdits'
import { createSession } from './editorSession'

// The editor's one store (plan Task 8). Screens read and change content only through it.
// An edit is applied at once, then sent through the door; a refusal puts it back.
// `editorSession.ts` opens and closes a project; `editorEdits.ts` holds the edits.

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

export function createEditorStore(door: EditorDoor): StoreApi<EditorStore> {
  return createStore<EditorStore>((set, get) => ({
    status: 'idle',
    error: null,
    saving: 0,
    content: EMPTY_STATE,
    ...createSession(door, set),
    ...createEdits(door, set, get),
    dismissError() {
      set({ error: null })
    },
  }))
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
