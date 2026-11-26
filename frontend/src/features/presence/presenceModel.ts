import type { PresenceRow } from '../../backend'

// Who is editing what, from the rows this browser has received.

/**
 * The rows of other people that are still fresh. `seenAt` is when THIS browser last received
 * each row (its own clock), so a machine with a wrong clock cannot make a row stale or eternal.
 */
export function activeEditors(
  rows: PresenceRow[],
  seenAt: Record<string, number>,
  nowMs: number,
  timeoutMs: number,
  selfId: string,
): PresenceRow[] {
  return rows.filter((r) => r.userId !== selfId && seenAt[r.id] !== undefined && nowMs - seenAt[r.id]! < timeoutMs)
}

/** The sorted names of the people editing a node, or one field of it. */
export function editorsOf(active: PresenceRow[], nodeId: string, field?: string): string[] {
  return active
    .filter((r) => r.nodeId === nodeId && (field === undefined || r.field === field))
    .map((r) => r.userName)
    .sort()
}

export function editingLabel(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is editing`
  if (names.length === 2) return `${names[0]} and ${names[1]} are editing`
  return `${names[0]} and ${names.length - 1} others are editing`
}
