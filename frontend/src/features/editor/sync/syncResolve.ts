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
