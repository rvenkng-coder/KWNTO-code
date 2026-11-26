import type { ContentKind } from '../../../backend'
import { fieldLabel } from './outboxText'
import type { OutboxEntry } from './outbox'
import type { PendingConflict } from './syncEngine'

// The words of the failed list and the conflict dialog.

const THINGS: Partial<Record<ContentKind, string>> = {
  script_lines: 'script line',
  cues: 'cue',
  connections: 'connection',
  nodes: 'node',
  chapters: 'chapter',
}
export const thingOf = (kind: ContentKind): string => THINGS[kind] ?? 'item'

export const conflictHeading = (c: PendingConflict): string =>
  c.deleted
    ? `Someone else deleted this ${thingOf(c.entry.kind)} while you were offline`
    : 'Someone else changed this while you were offline'

/** What a failed entry was: the fields it changed, or that it added or removed something. */
export function describeEntry(entry: OutboxEntry): string {
  if (entry.op === 'create') return `New ${thingOf(entry.kind)}`
  if (entry.op === 'remove') return `Removed ${thingOf(entry.kind)}`
  return [...new Set(Object.keys(entry.changes).map((f) => fieldLabel(entry.kind, f)))].join(', ')
}

type TitleOf = (nodeId: string) => string | undefined

const isEmpty = (v: unknown): boolean => v === '' || v === null || v === undefined

// One value as text: a colour as its name, a choice target as the node's title, `Position` as `x, y`.
function show(field: string, source: Record<string, unknown>, titleOf: TitleOf): string {
  const value = source[field]
  if (field === 'x' || field === 'y') return `${String(source.x)}, ${String(source.y)}`
  if (field === 'toNodeId') return isEmpty(value) ? 'No target' : (titleOf(String(value)) ?? String(value))
  if (field === 'deleted') return value === true ? 'In trash' : 'Not in trash'
  return isEmpty(value) ? '(empty)' : String(value)
}

export interface ConflictRow {
  label: string
  yours: string
  theirs: string
}

export function conflictRows(c: PendingConflict, titleOf: TitleOf): ConflictRow[] {
  const { entry, server } = c
  if (c.deleted || server === null) return []
  const mine: Record<string, unknown> = entry.op === 'update' ? entry.changes : {}
  const seen = new Set<string>()
  const rows: ConflictRow[] = []
  for (const field of c.fields) {
    const label = fieldLabel(entry.kind, field)
    if (seen.has(label)) continue
    seen.add(label)
    const theirs = show(field, server as unknown as Record<string, unknown>, titleOf)
    const yours = entry.op === 'remove' ? 'Removed' : show(field, mine, titleOf)
    rows.push({ label, yours, theirs })
  }
  return rows
}

// The sign-out question is drawn in the page (never `confirm()`: no browser pop-ups), and only when changes are
// waiting.
export const signOutQuestion = (waiting: number): string =>
  waiting === 1
    ? '1 change has not been saved yet. It will be saved the next time you sign in on this browser. Sign out anyway?'
    : `${waiting} changes have not been saved yet. They will be saved the next time you sign in on this browser. Sign out anyway?`
