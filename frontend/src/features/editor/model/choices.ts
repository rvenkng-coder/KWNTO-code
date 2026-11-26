import type { Connection } from '../../../backend'
import { newId } from './ids'
import { isLiveNode, type ContentState } from './state'

// Choices (editor cards design, goal 1): a choice is a connection that may have no target.

/** Choice order: when it was made, then id (F2). */
export const byCreated = (a: Connection, b: Connection): number =>
  a.created.localeCompare(b.created) || a.id.localeCompare(b.id)

/** The choices of a node: target empty or a live node; by `created`, then id (F1, F2). */
export function choicesOf(s: ContentState, nodeId: string): Connection[] {
  return Object.values(s.connections)
    .filter((c) => c.fromNodeId === nodeId && (c.toNodeId === null || isLiveNode(s, c.toNodeId)))
    .sort(byCreated)
}

/** Whether `fromId` already has a choice to `toId`, ignoring the choice `exceptId`. */
export function hasChoiceTo(s: ContentState, fromId: string, toId: string, exceptId?: string): boolean {
  return Object.values(s.connections).some((c) => c.id !== exceptId && c.fromNodeId === fromId && c.toNodeId === toId)
}

/** A new choice of `fromNodeId`; `created` is `now` until the server's copy arrives. */
export function newChoice(
  projectId: string,
  fromNodeId: string,
  toNodeId: string | null,
  now: string,
  makeId: () => string = newId,
): Connection {
  return { id: makeId(), projectId, fromNodeId, toNodeId, label: '', created: now, version: 0 }
}

export function duplicateChoiceMessage(targetTitle: string): string {
  return `This node already has a choice to ${targetTitle || 'Untitled'}.`
}
