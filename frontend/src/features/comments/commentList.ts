import type { Comment, CommentEvent } from '../../backend'

const oldestFirst = (a: Comment, b: Comment): number => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)

/** A create is added once (the author's own echo has the same id); a delete is dropped. Oldest first. */
export function applyCommentEvent(list: Comment[], e: CommentEvent): Comment[] {
  if (e.action === 'delete') return list.filter((c) => c.id !== e.record.id)
  if (list.some((c) => c.id === e.record.id)) return list
  return [...list, e.record].sort(oldestFirst)
}

export function commentsOf(list: Comment[], nodeId: string): Comment[] {
  return list.filter((c) => c.nodeId === nodeId).sort(oldestFirst)
}

export function countLabel(n: number): string {
  return n === 0 ? '' : n === 1 ? '1 comment' : `${n} comments`
}

/** The author deletes their own comment and the team owner any (the server decides too). */
export function canDelete(c: Comment, userId: string, isOwner: boolean): boolean {
  return c.authorId === userId || isOwner
}
