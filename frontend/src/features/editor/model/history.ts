import type { ContentKind, ContentRecords, RemovableKind } from '../../../backend'
import { getRecord, type ContentState } from './state'

// Undo history (design 6.1 and 8b): this person's own edits only, 100 steps per open
// project. A step is undone by applying its inverse; a change someone else has touched since
// is never forced (`canApply`).

export type Change =
  | { type: 'update'; kind: ContentKind; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  | { type: 'create'; kind: RemovableKind; record: ContentRecords[RemovableKind] }
  | { type: 'remove'; kind: RemovableKind; record: ContentRecords[RemovableKind] }
// Creating a chapter or node is recorded as an update of `deleted` from true to false, so undo trashes it and redo restores it.
export interface Step {
  label: string
  changes: Change[]
}
export interface History {
  past: Step[]
  future: Step[]
}

export const HISTORY_DEPTH = 100
export const EMPTY_HISTORY: History = { past: [], future: [] }
export const UNDO_BLOCKED = "Can't undo: someone else changed this since."
export const REDO_BLOCKED = "Can't redo: someone else changed this since."

// The fields a person edits on the kinds that can be removed outright (EditableFields in content-types).
const EDITABLE: Record<RemovableKind, string[]> = {
  script_lines: ['character', 'text', 'sortOrder'],
  cues: ['type', 'text', 'sortOrder'],
  connections: ['label'],
}

export function recordStep(h: History, step: Step): History {
  if (step.changes.length === 0) return h
  const past = [...h.past, step]
  return { past: past.slice(-HISTORY_DEPTH), future: [] }
}

/** The history without one change (a write the server refused after it was recorded); a step left empty goes too. */
export function withoutChange(h: History, change: Change): History {
  const strip = (steps: Step[]) =>
    steps
      .map((st) => ({ ...st, changes: st.changes.filter((c) => c !== change) }))
      .filter((st) => st.changes.length > 0)
  return { past: strip(h.past), future: strip(h.future) }
}

function invertChange(c: Change): Change {
  if (c.type === 'update') return { ...c, before: c.after, after: c.before }
  return { type: c.type === 'create' ? 'remove' : 'create', kind: c.kind, record: c.record }
}

export function invert(step: Step): Step {
  return { label: step.label, changes: [...step.changes].reverse().map(invertChange) }
}

export function takeUndo(h: History): { history: History; step: Step } | null {
  const step = h.past.at(-1)
  if (step === undefined) return null
  return { history: { past: h.past.slice(0, -1), future: [step, ...h.future] }, step: invert(step) }
}

export function takeRedo(h: History): { history: History; step: Step } | null {
  const step = h.future[0]
  if (step === undefined) return null
  return { history: { past: [...h.past, step], future: h.future.slice(1) }, step }
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export function canApply(change: Change, s: ContentState): boolean {
  if (change.type === 'create') return getRecord(s, change.kind, change.record.id) === undefined
  if (change.type === 'remove') {
    const current = getRecord(s, change.kind, change.record.id) as Record<string, unknown> | undefined
    const recorded = change.record as unknown as Record<string, unknown>
    return current !== undefined && EDITABLE[change.kind].every((key) => sameValue(current[key], recorded[key]))
  }
  const current = getRecord(s, change.kind, change.id) as Record<string, unknown> | undefined
  if (current === undefined) return false
  return Object.keys(change.before).every((key) => sameValue(current[key], change.before[key]))
}
