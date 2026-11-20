import type { ContentKind, ContentRecords, RemovableKind } from '../../../backend'
import type { BackendError } from '../../../backend/errors'
import { errorMessage } from '../../errorMessage'
import { dropRecord, getRecord, putRecord, type ContentState } from '../model/state'
import type { OutboxEntry } from '../sync/outbox'
import type { EngineEntry, SyncHooks } from '../sync/syncEngine'
import type { EditorSyncPort } from './editorSync'
import type { EditorDoor, EditorStore } from './editorStore'

// The optimistic edits of the store (offline sync plan Task 4, D11): change the state, hand the
// edit to the outbox, and settle when the server has answered. A refusal puts it back.

export const SAVE_FAILED = 'Could not save this change.'

type Set = (partial: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore>)) => void
type Waiter = { finish(ok: boolean): void; undo(s: ContentState): ContentState }

const REMOVABLE: ReadonlySet<ContentKind> = new Set<RemovableKind>(['script_lines', 'cues', 'connections'])

// Only the fields the failed edit touched go back, so an edit of another field made meanwhile stays.
function restoreFields<K extends ContentKind>(s: ContentState, kind: K, id: string, before: ContentRecords[K], keys: string[]): ContentState {
  const current = getRecord(s, kind, id)
  if (current === undefined) return s
  const restored = { ...current } as Record<string, unknown>
  for (const key of keys) restored[key] = (before as unknown as Record<string, unknown>)[key]
  return putRecord(s, kind, restored as unknown as ContentRecords[K])
}

const pick = (record: unknown, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, (record as Record<string, unknown>)[k]]))

/** The waiting edits' resolvers by outbox seq. An answer that comes before `add` returned is remembered. */
function createWaiters() {
  const waiting = new Map<number, Waiter[]>()
  const early = new Map<number, boolean>()
  let adding = 0
  return {
    begin: () => { adding++ },
    end() {
      if (--adding === 0) early.clear()
    },
    attach(seq: number, waiter: Waiter, answered: (ok: boolean, w: Waiter) => void): void {
      const ok = early.get(seq)
      if (ok !== undefined) return answered(ok, waiter)
      waiting.set(seq, [...(waiting.get(seq) ?? []), waiter])
    },
    take(seq: number, ok: boolean): Waiter[] {
      const list = waiting.get(seq) ?? []
      waiting.delete(seq)
      if (list.length === 0 && adding > 0) early.set(seq, ok)
      return list
    },
  }
}

interface Ctx {
  door: EditorDoor
  set: Set
  get: () => EditorStore
  edit(change: (s: ContentState) => ContentState): void
  waiters: ReturnType<typeof createWaiters>
}

const inProject = (c: Ctx, entry: OutboxEntry) => c.get().content.project?.id === entry.projectId

// The saved record replaces the local one only when its version is higher (ours echoes back equal).
function takeSaved(c: Ctx, kind: ContentKind, saved: ContentRecords[ContentKind]): void {
  c.edit((s) => (saved.version > (getRecord(s, kind, saved.id)?.version ?? -1) ? putRecord(s, kind, saved) : s))
}

const showRecord = (kind: ContentKind, id: string, server: ContentRecords[ContentKind] | null) => (s: ContentState) =>
  server === null ? dropRecord(s, kind, id) : putRecord(s, kind, server)

// No copy of the change is left in memory (the page was reloaded): the server's copy is what is true.
async function showServerCopy(c: Ctx, entry: OutboxEntry): Promise<void> {
  const server = await c.door.get(entry.kind, entry.id).catch(() => undefined)
  if (server === undefined || !inProject(c, entry)) return
  c.edit(showRecord(entry.kind, entry.id, server))
}

function createHooks(c: Ctx): SyncHooks {
  return {
    saved(entry, record) {
      if (record !== null && inProject(c, entry)) takeSaved(c, entry.kind, record)
      for (const w of c.waiters.take(entry.seq, true)) w.finish(true)
    },
    refused(entry: OutboxEntry, error: BackendError) {
      const list = c.waiters.take(entry.seq, false)
      if (list.length === 0) return void showServerCopy(c, entry)
      for (const w of [...list].reverse()) {
        c.edit(w.undo)
        w.finish(false)
      }
      c.set({ error: errorMessage(error, SAVE_FAILED) })
    },
    theirs(entry, server) {
      if (inProject(c, entry)) c.edit(showRecord(entry.kind, entry.id, server))
      for (const w of c.waiters.take(entry.seq, false)) w.finish(false)
    },
  }
}

// Hands one edit to the outbox; resolves true when the server accepted it, false when it was refused.
function createSubmit(c: Ctx, sync: EditorSyncPort) {
  return (entry: EngineEntry, undo: (s: ContentState) => ContentState): Promise<boolean> => {
    c.set((st) => ({ saving: st.saving + 1 }))
    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = {
        undo,
        finish(ok) {
          c.set((st) => ({ saving: st.saving - 1 }))
          resolve(ok)
        },
      }
      const answered = (ok: boolean, w: Waiter) => (ok ? w.finish(true) : (c.edit(w.undo), w.finish(false)))
      c.waiters.begin()
      sync.add(entry).then(
        (seq) => (seq === 0 ? waiter.finish(true) : c.waiters.attach(seq, waiter, answered)),
        (err: unknown) => {
          c.edit(undo)
          c.set({ error: errorMessage(err, SAVE_FAILED) })
          waiter.finish(false)
        },
      ).finally(() => c.waiters.end())
    })
  }
}

export function createEdits(door: EditorDoor, sync: EditorSyncPort, set: Set, get: () => EditorStore): Pick<EditorStore, 'create' | 'update' | 'remove'> {
  const edit = (change: (s: ContentState) => ContentState) => set((st) => ({ content: change(st.content) }))
  const c: Ctx = { door, set, get, edit, waiters: createWaiters() }
  sync.register(createHooks(c))
  const submit = createSubmit(c, sync)

  return {
    create(kind, record) {
      edit((s) => putRecord(s, kind, record))
      return submit({ projectId: record.projectId, op: 'create', kind, id: record.id, record }, (s) => dropRecord(s, kind, record.id))
    },

    update(kind, id, changes) {
      const before = getRecord(get().content, kind, id)
      const projectId = get().content.project?.id
      if (before === undefined || projectId === undefined) return Promise.resolve(false)
      const keys = Object.keys(changes)
      // The server stamps the trash time (plan 7 D11); until it answers, a record that just
      // changed its trash state has no time here (the trash lists it as "just now").
      const stamp = 'deleted' in changes ? { deletedAt: null } : {}
      const after = { ...before, ...changes, ...stamp }
      edit((s) => putRecord(s, kind, after))
      const snapshot = REMOVABLE.has(kind) ? (after as ContentRecords[RemovableKind]) : null
      return submit(
        { projectId, op: 'update', kind, id, changes, baseVersion: before.version, baseValues: pick(before, keys), snapshot },
        (s) => restoreFields(s, kind, id, before, keys),
      )
    },

    remove(kind, id) {
      const before = getRecord(get().content, kind, id)
      const projectId = get().content.project?.id
      if (before === undefined || projectId === undefined) return Promise.resolve(false)
      edit((s) => dropRecord(s, kind, id))
      return submit({ projectId, op: 'remove', kind, id, record: before }, (s) => putRecord(s, kind, before))
    },
  }
}
