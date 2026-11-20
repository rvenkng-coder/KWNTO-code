import type { ContentKind, ContentRecords, CreatableKind } from '../../../backend'
import type { OutboxEntry } from './outbox'
import type { PendingConflict } from './syncEngine'

// What `Keep mine` turns the conflicting entry into (offline sync plan Task 3, D4, D12).

const valueOf = (record: object, field: string): unknown => (record as Record<string, unknown>)[field]

/** The entry to send now, or null when it cannot be sent (a deleted record with no copy to re-create). */
export function mineEntry(conflict: PendingConflict): OutboxEntry | null {
  const { entry, server } = conflict
  if (entry.op === 'remove') return { ...entry, offline: false }
  if (entry.op !== 'update') return entry
  if (conflict.deleted || server === null) {
    if (entry.snapshot === null) return null
    const { seq, userId, projectId, id, offline, made, kind } = entry
    return { seq, userId, projectId, id, offline, made, op: 'create', kind: kind as CreatableKind, record: entry.snapshot }
  }
  const baseValues = { ...entry.baseValues }
  for (const field of conflict.fields) baseValues[field] = valueOf(server as ContentRecords[ContentKind], field)
  return { ...entry, baseVersion: server.version, baseValues }
}

/**
 * What is left to send after `Keep theirs` (D12): the fields of an update that did not conflict, on the
 * server's version. Null when nothing is left (a remove, a deleted record, or every field conflicted).
 */
export function theirsEntry(conflict: PendingConflict): OutboxEntry | null {
  const { entry, server } = conflict
  if (entry.op !== 'update' || conflict.deleted || server === null) return null
  const rest = Object.keys(entry.changes).filter((f) => !conflict.fields.includes(f))
  if (rest.length === 0) return null
  const pickOf = (from: Record<string, unknown>) => Object.fromEntries(rest.map((f) => [f, from[f]]))
  return { ...entry, changes: pickOf(entry.changes), baseValues: pickOf(entry.baseValues), baseVersion: server.version }
}
