import type { ContentKind, ContentRecords } from '../../../backend'
import { errorMessage } from '../../errorMessage'
import { dropRecord, getRecord, putRecord, type ContentState } from '../model/state'
import type { EditorDoor, EditorStore } from './editorStore'

// The optimistic edits of the store: change the state, send through the door, undo on a refusal.

export const SAVE_FAILED = 'Could not save this change.'

type Set = (partial: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore>)) => void

// Only the fields the failed edit touched go back, so an edit of another field made meanwhile stays.
function restoreFields<K extends ContentKind>(s: ContentState, kind: K, id: string, before: ContentRecords[K], keys: string[]): ContentState {
  const current = getRecord(s, kind, id)
  if (current === undefined) return s
  const restored = { ...current } as Record<string, unknown>
  for (const key of keys) restored[key] = (before as unknown as Record<string, unknown>)[key]
  return putRecord(s, kind, restored as unknown as ContentRecords[K])
}

export function createEdits(door: EditorDoor, set: Set, get: () => EditorStore): Pick<EditorStore, 'create' | 'update' | 'remove'> {
  const edit = (change: (s: ContentState) => ContentState) => set((st) => ({ content: change(st.content) }))

  // The saved record replaces the local one only when its version is higher (ours echoes back equal).
  function takeSaved<K extends ContentKind>(kind: K, saved: ContentRecords[K]): void {
    edit((s) => (saved.version > (getRecord(s, kind, saved.id)?.version ?? -1) ? putRecord(s, kind, saved) : s))
  }

  // One door call that follows an optimistic change; `undo` puts the change back on a refusal.
  async function send(call: () => Promise<void>, undo: (s: ContentState) => ContentState): Promise<boolean> {
    set((st) => ({ saving: st.saving + 1 }))
    try {
      await call()
      return true
    } catch (err) {
      edit(undo)
      set({ error: errorMessage(err, SAVE_FAILED) })
      return false
    } finally {
      set((st) => ({ saving: st.saving - 1 }))
    }
  }

  return {
    create(kind, record) {
      edit((s) => putRecord(s, kind, record))
      return send(
        async () => takeSaved(kind, await door.create(kind, record)),
        (s) => dropRecord(s, kind, record.id),
      )
    },

    update(kind, id, changes) {
      const before = getRecord(get().content, kind, id)
      if (before === undefined) return Promise.resolve(false)
      edit((s) => putRecord(s, kind, { ...before, ...changes }))
      return send(
        async () => takeSaved(kind, await door.update(kind, id, changes, before.version)),
        (s) => restoreFields(s, kind, id, before, Object.keys(changes)),
      )
    },

    remove(kind, id) {
      const before = getRecord(get().content, kind, id)
      if (before === undefined) return Promise.resolve(false)
      edit((s) => dropRecord(s, kind, id))
      return send(() => door.remove(kind, id), (s) => putRecord(s, kind, before))
    },
  }
}
