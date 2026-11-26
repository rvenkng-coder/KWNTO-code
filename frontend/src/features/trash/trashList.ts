import type { Chapter, StoryNode } from '../../backend'
import type { ContentState } from '../editor/model/state'

// The pure parts of the trash screens (design 6.8, plan 7 Task 1).

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days left to restore an item trashed at `deletedAtIso`: rounded up, so the label
 * says `Removed tonight` only on the last day, and never below 0.
 */
export function daysLeft(deletedAtIso: string, retentionDays: number, nowMs: number): number {
  const removeAtMs = new Date(deletedAtIso).getTime() + retentionDays * DAY_MS
  return Math.max(0, Math.ceil((removeAtMs - nowMs) / DAY_MS))
}

export function trashLabel(days: number): string {
  if (days === 0) return 'Removed tonight'
  return days === 1 ? '1 day left' : `${days} days left`
}

export interface TrashedNode {
  node: StoryNode
  chapterTrashed: boolean
}

// A just-trashed record in this tab has no server time yet; it counts as the newest.
function timeOf(deletedAt: string | null): number {
  return deletedAt === null ? Number.POSITIVE_INFINITY : new Date(deletedAt).getTime()
}

/** Trashed chapters, and trashed nodes plus the nodes of trashed chapters, newest deleted first. */
export function trashedItems(s: ContentState): { chapters: Chapter[]; nodes: TrashedNode[] } {
  const chapters = Object.values(s.chapters)
    .filter((c) => c.deleted)
    .sort((a, b) => timeOf(b.deletedAt) - timeOf(a.deletedAt))

  const nodes: (TrashedNode & { at: number })[] = []
  for (const node of Object.values(s.nodes)) {
    const chapter = s.chapters[node.chapterId]
    const chapterTrashed = chapter !== undefined && chapter.deleted
    if (!node.deleted && !chapterTrashed) continue
    // A node of a trashed chapter is dated by its own trash time, else by its chapter's.
    const at = node.deleted ? timeOf(node.deletedAt) : timeOf(chapter?.deletedAt ?? null)
    nodes.push({ node, chapterTrashed, at })
  }
  nodes.sort((a, b) => b.at - a.at)
  return { chapters, nodes: nodes.map(({ node, chapterTrashed }) => ({ node, chapterTrashed })) }
}
