import type { StoreApi } from 'zustand'
import type { ContentKind, ContentRecords, CreatableKind, EditableFields, RemovableKind } from '../../../backend'
import { buildPaste, copySelection, type Clip } from '../model/clipboard'
import {
  canApply, EMPTY_HISTORY, recordStep, REDO_BLOCKED, takeRedo, takeUndo, UNDO_BLOCKED, type Change, type History, type Step,
} from '../model/history'
import { newId } from '../model/ids'
import { getRecord } from '../model/state'
import { editorStore, type EditorStore } from './editorStore'
import { pendingEdits } from './pendingEdits'

// Every content change a screen makes goes through here (plan Task 12), so it lands in the
// undo history (D5). A step is recorded only after its writes succeed. Undo and redo write
// ordinary guarded updates and never force a change someone else has touched since.

type Edits = {
  create<K extends CreatableKind>(kind: K, record: ContentRecords[K], label: string): Promise<boolean>
  update<K extends ContentKind>(kind: K, id: string, changes: Partial<EditableFields[K]>, label: string): Promise<boolean>
  remove(kind: RemovableKind, id: string, label: string): Promise<boolean>
  group(label: string, run: () => Promise<void>): Promise<void>
  undo(): Promise<void>
  redo(): Promise<void>
  copy(nodeIds: string[]): void
  paste(chapterId: string): Promise<void>
  reset(): void
}

const isTrashable = (kind: CreatableKind): kind is 'chapters' | 'nodes' => kind === 'chapters' || kind === 'nodes'

// The current values of the fields an update is about to change.
function pick(record: unknown, keys: string[]): Record<string, unknown> {
  const source = record as Record<string, unknown>
  return Object.fromEntries(keys.map((k) => [k, source[k]]))
}

/** Applies one change through the store; resolves false when the door refused it. */
function applyChange(store: StoreApi<EditorStore>, c: Change): Promise<boolean> {
  const s = store.getState()
  if (c.type === 'update') return s.update(c.kind, c.id, c.after as never)
  // A record made again starts over at version 0, as the server's copy does.
  if (c.type === 'create') return s.create(c.kind, { ...c.record, version: 0 })
  return s.remove(c.kind, c.record.id)
}

type Recorder = Pick<Edits, 'group' | 'undo' | 'redo' | 'reset'> & {
  /** The group open right now; an edit captures it before its write. */
  openGroup(): Change[] | null
  record(group: Change[] | null, label: string, change: Change): void
}

// The history: recording, groups, undo and redo.
function createRecorder(store: StoreApi<EditorStore>, flush: () => void): Recorder {
  let history: History = EMPTY_HISTORY
  let collecting: Change[] | null = null

  // Applies a step if every change still fits the state; otherwise skips it with `blocked`.
  async function play(taken: { history: History; step: Step } | null, blocked: string, skipped: History | null): Promise<void> {
    flush()
    if (taken === null) return
    const content = store.getState().content
    if (!taken.step.changes.every((c) => canApply(c, content))) {
      history = skipped ?? taken.history
      store.setState({ error: blocked })
      return
    }
    history = taken.history
    for (const c of taken.step.changes) if (!(await applyChange(store, c))) return
  }

  return {
    openGroup: () => collecting,
    // `group` is the group open when the edit started, so an edit that finishes while some
    // later group is open is not counted into that group.
    record(group, label, change) {
      if (group !== null) group.push(change)
      else history = recordStep(history, { label, changes: [change] })
    },
    async group(label, run) {
      if (collecting !== null) return run()
      collecting = []
      try {
        await run()
      } finally {
        const changes = collecting
        collecting = null
        history = recordStep(history, { label, changes })
      }
    },
    undo() {
      const taken = takeUndo(history)
      return play(taken, UNDO_BLOCKED, taken === null ? null : { past: taken.history.past, future: history.future })
    },
    redo() {
      const taken = takeRedo(history)
      return play(taken, REDO_BLOCKED, taken === null ? null : { past: history.past, future: taken.history.future })
    },
    reset() {
      history = EMPTY_HISTORY
    },
  }
}

// The three writes, each recorded once it succeeded.
function createWrites(store: StoreApi<EditorStore>, rec: Recorder): Pick<Edits, 'create' | 'update' | 'remove'> {
  return {
    async create(kind, record, label) {
      const into = rec.openGroup()
      if (!(await store.getState().create(kind, record))) return false
      if (isTrashable(kind)) rec.record(into, label, { type: 'update', kind, id: record.id, before: { deleted: true }, after: { deleted: false } })
      else rec.record(into, label, { type: 'create', kind: kind as RemovableKind, record: record as ContentRecords[RemovableKind] })
      return true
    },
    async update(kind, id, changes, label) {
      const before = pick(getRecord(store.getState().content, kind, id), Object.keys(changes))
      const into = rec.openGroup()
      const ok = await store.getState().update(kind, id, changes)
      if (ok) rec.record(into, label, { type: 'update', kind, id, before, after: { ...changes } })
      return ok
    },
    async remove(kind, id, label) {
      const current = getRecord(store.getState().content, kind, id)
      const into = rec.openGroup()
      const ok = current !== undefined && (await store.getState().remove(kind, id))
      if (ok) rec.record(into, label, { type: 'remove', kind, record: current })
      return ok
    },
  }
}

// Copy and paste (D11); a paste is one step.
function createClipboard(store: StoreApi<EditorStore>, writes: Pick<Edits, 'create'>, group: Edits['group']): Pick<Edits, 'copy' | 'paste'> {
  let clip: Clip | null = null
  let pasteCount = 0
  return {
    copy(nodeIds) {
      clip = copySelection(store.getState().content, nodeIds)
      pasteCount = 0
    },
    async paste(chapterId) {
      const projectId = store.getState().content.project?.id
      if (clip === null || projectId === undefined) return
      const p = buildPaste(clip, { projectId, chapterId }, ++pasteCount, () => newId())
      const label = p.nodes.length === 1 ? 'Paste 1 node' : `Paste ${p.nodes.length} nodes`
      await group(label, async () => {
        for (const n of p.nodes) await writes.create('nodes', n, label)
        await Promise.all([
          ...p.lines.map((l) => writes.create('script_lines', l, label)),
          ...p.cues.map((c) => writes.create('cues', c, label)),
        ])
        await Promise.all(p.connections.map((c) => writes.create('connections', c, label)))
      })
    },
  }
}

export function createEdits(store: StoreApi<EditorStore>, flush: () => void): Edits {
  const rec = createRecorder(store, flush)
  const writes = createWrites(store, rec)
  const { group, undo, redo, reset } = rec
  return { ...writes, group, undo, redo, reset, ...createClipboard(store, writes, group) }
}

/** The app's one instance, on the editor store; undo and redo save waiting text first. */
export const edits = createEdits(editorStore, () => pendingEdits.flushAll())
