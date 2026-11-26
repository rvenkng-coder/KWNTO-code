import type { ContentKind, ContentRecords, CreatableKind, RemovableKind } from '../../../backend'
import { dropRecord, getRecord, putRecord, type ContentState } from '../model/state'

// The outbox's decisions as pure functions: how a new edit joins the waiting ones, how waiting
// edits are laid over fresh server data, and whether a 409 met by an offline edit is a real
// conflict. An edit made online never is one: it is retried silently.

interface EntryBase {
  seq: number
  userId: string
  projectId: string
  id: string
  offline: boolean
  made: number
}
export type OutboxEntry =
  | (EntryBase & { op: 'create'; kind: CreatableKind; record: ContentRecords[CreatableKind] })
  | (EntryBase & {
      op: 'update'
      kind: ContentKind
      changes: Record<string, unknown>
      baseVersion: number
      baseValues: Record<string, unknown>
      snapshot: ContentRecords[RemovableKind] | null
    })
  | (EntryBase & { op: 'remove'; kind: RemovableKind; record: ContentRecords[RemovableKind] })
export type NewEntry = OutboxEntry extends infer E ? (E extends OutboxEntry ? Omit<E, 'seq'> : never) : never
export interface AddPlan {
  append: NewEntry | null
  replace: OutboxEntry | null
  drop: number[]
}
export type ConflictCheck = { type: 'none' } | { type: 'fields'; fields: string[] } | { type: 'deleted' }

const NO_CONFLICT: ConflictCheck = { type: 'none' }

/** JSON comparison: records hold only plain values. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const sameRecord = (a: { kind: ContentKind; id: string }, b: { kind: ContentKind; id: string }): boolean =>
  a.kind === b.kind && a.id === b.id

type UpdateEntry = Extract<OutboxEntry, { op: 'update' }>

// The newer value of a field wins, but the base value and base version stay the older ones: they
// are what the server held before any of these waiting edits.
function mergeInto(last: UpdateEntry, entry: Extract<NewEntry, { op: 'update' }>): UpdateEntry {
  return {
    ...last,
    changes: { ...last.changes, ...entry.changes },
    baseValues: { ...entry.baseValues, ...last.baseValues },
    baseVersion: Math.min(last.baseVersion, entry.baseVersion),
    offline: last.offline || entry.offline,
    snapshot: entry.snapshot,
    made: entry.made,
  }
}

/**
 * An update merges only into the last entry of the queue (an update of the same record), so the order
 * between records is kept. A remove drops the record's waiting edits; if its create was among them,
 * nothing is sent at all. The entry being sent is never changed or dropped.
 */
export function planAdd(queue: OutboxEntry[], entry: NewEntry, sendingSeq: number | null): AddPlan {
  const waiting = queue.filter((q) => q.seq !== sendingSeq)
  if (entry.op === 'update') {
    const last = queue[queue.length - 1]
    if (last !== undefined && last.op === 'update' && sameRecord(last, entry) && last.seq !== sendingSeq) {
      return { append: null, replace: mergeInto(last, entry), drop: [] }
    }
  }
  if (entry.op === 'remove') {
    const mine = waiting.filter((q) => sameRecord(q, entry))
    const drop = mine.map((q) => q.seq)
    const created = mine.some((q) => q.op === 'create')
    return { append: created ? null : entry, replace: null, drop }
  }
  return { append: entry, replace: null, drop: [] }
}

/** The waiting edits of this project laid over `state`, in seq order. */
export function overlay(state: ContentState, queue: OutboxEntry[]): ContentState {
  const projectId = state.project?.id
  return [...queue]
    .sort((a, b) => a.seq - b.seq)
    .reduce((s, entry) => {
      if (entry.projectId !== projectId) return s
      if (entry.op === 'create') {
        if (getRecord(s, entry.kind, entry.id) !== undefined) return s
        return putRecord(s, entry.kind, entry.record)
      }
      if (entry.op === 'update') {
        const current = getRecord(s, entry.kind, entry.id)
        return current === undefined ? s : putRecord(s, entry.kind, { ...current, ...entry.changes })
      }
      return dropRecord(s, entry.kind, entry.id)
    }, state)
}

const REMOVABLE_FIELDS: Record<RemovableKind, string[]> = {
  script_lines: ['character', 'text', 'sortOrder'],
  cues: ['type', 'text', 'sortOrder'],
  connections: ['label', 'toNodeId'],
}

const valueOf = (record: object, field: string): unknown => (record as Record<string, unknown>)[field]

function updateConflict(entry: UpdateEntry, server: object | null): ConflictCheck {
  if (server === null) return { type: 'deleted' }
  const clashing = Object.keys(entry.changes).filter((field) => {
    const serverValue = valueOf(server, field)
    return !sameValue(serverValue, entry.baseValues[field]) && !sameValue(serverValue, entry.changes[field])
  })
  if (clashing.length === 0) return NO_CONFLICT
  const position = clashing.some((f) => f === 'x' || f === 'y')
  const fields = Object.keys(entry.changes).filter(
    (f) => clashing.includes(f) || (position && (f === 'x' || f === 'y')),
  )
  return { type: 'fields', fields }
}

/**
 * A field of an offline update conflicts when the server's value differs both from the value the edit
 * started from and from the edit's own value; x and y count as one attribute.
 */
export function classifyConflict(entry: OutboxEntry, server: ContentRecords[ContentKind] | null): ConflictCheck {
  if (!entry.offline) return NO_CONFLICT
  if (entry.op === 'create') return NO_CONFLICT
  if (entry.op === 'update') return updateConflict(entry, server)
  if (server === null) return NO_CONFLICT
  const fields = REMOVABLE_FIELDS[entry.kind].filter((f) => !sameValue(valueOf(server, f), valueOf(entry.record, f)))
  return fields.length === 0 ? NO_CONFLICT : { type: 'fields', fields }
}
