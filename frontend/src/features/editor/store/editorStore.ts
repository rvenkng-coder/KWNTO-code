import { useStore, type StoreApi } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
  backend,
  type Backend,
  type ContentKind,
  type ContentRecords,
  type CreatableKind,
  type EditableFields,
  type RemovableKind,
} from '../../../backend'
import { EMPTY_STATE, type ContentState } from '../model/state'
import { createEdits } from './editorEdits'
import { createSession } from './editorSession'
import { appSync, directSync, type EditorSyncPort } from './editorSync'

// The editor's one store. Screens read and change content only through it.
// An edit is applied at once, then written to the outbox, which sends it; a refusal puts it back.
// `editorSession.ts` opens and closes a project; `editorEdits.ts` holds the edits.

export type EditorDoor = Pick<Backend['content'], 'load' | 'get' | 'create' | 'update' | 'remove' | 'subscribe'>

export interface EditorStore {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  /** Door calls in flight (create, update, remove); a screen warns before unload while > 0. */
  saving: number
  content: ContentState
  /** Whether something was copied or cut in this tab; Paste is disabled until then. */
  hasClip: boolean
  open(projectId: string): Promise<void>
  close(): Promise<void>
  /** `onLate` runs if the write resolved true while offline (stored, not answered) and the server refused it later. */
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K], onLate?: () => void): Promise<boolean>
  update<K extends ContentKind>(
    kind: K,
    id: string,
    changes: Partial<EditableFields[K]>,
    onLate?: () => void,
  ): Promise<boolean>
  remove(kind: RemovableKind, id: string, onLate?: () => void): Promise<boolean>
  dismissError(): void
}

export function createEditorStore(door: EditorDoor, sync: EditorSyncPort = directSync(door)): StoreApi<EditorStore> {
  return createStore<EditorStore>((set, get) => ({
    status: 'idle',
    error: null,
    saving: 0,
    content: EMPTY_STATE,
    hasClip: false,
    ...createSession(door, set, sync),
    ...createEdits(door, sync, set, get),
    dismissError() {
      set({ error: null })
    },
  }))
}

// The door is looked up per call, so importing this module opens no connection.
export const editorStore = createEditorStore(
  {
    load: (projectId) => backend.content.load(projectId),
    get: (kind, id) => backend.content.get(kind, id),
    create: (kind, record) => backend.content.create(kind, record),
    update: (kind, id, changes, base, options) => backend.content.update(kind, id, changes, base, options),
    remove: (kind, id) => backend.content.remove(kind, id),
    subscribe: (projectId, onEvent, onReconnect) => backend.content.subscribe(projectId, onEvent, onReconnect),
  },
  appSync(),
)

export function useEditor<T>(selector: (s: EditorStore) => T): T {
  return useStore(editorStore, selector)
}
