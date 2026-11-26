import type { ContentKind, ContentRecords, CreatableKind } from '../../../backend'
import type { OutboxEntry } from './outbox'
import type { OutboxStorage } from './outboxStorage'
import type { Answer } from './syncAnswers'
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
    return {
      seq,
      userId,
      projectId,
      id,
      offline,
      made,
      op: 'create',
      kind: kind as CreatableKind,
      record: entry.snapshot,
    }
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

const NO_COPY = 'The record was deleted and no copy of your change is left to restore it.'

/** Writes the answer to a conflict into the outbox. Returns what to tell the screens, or null when the entry will be sent again. */
export async function applyChoice(
  storage: OutboxStorage,
  conflict: PendingConflict,
  choice: 'mine' | 'theirs',
): Promise<Answer | null> {
  const { entry, server } = conflict
  // Keeping theirs still sends the fields that did not conflict.
  const replacement = choice === 'mine' ? mineEntry(conflict) : theirsEntry(conflict)
  if (replacement !== null) await storage.put(replacement)
  else if (choice === 'theirs') await storage.remove([entry.seq])
  else await storage.fail(entry, NO_COPY)
  if (choice === 'theirs') return { seq: entry.seq, type: 'theirs', server }
  return replacement === null ? { seq: entry.seq, type: 'refused', message: NO_COPY } : null
}
