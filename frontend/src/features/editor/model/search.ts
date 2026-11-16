import type { ContentState } from './state'
import { liveChapters, liveNodes } from './state'

export interface SearchHit { nodeId: string; chapterId: string; chapterTitle: string; title: string }
export const SEARCH_LIMIT = 20

// NFD decompose, strip combining marks (U+0300–U+036F), lowercase, trim, collapse whitespace.
export function normalizeTitle(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function makeHit(nodeId: string, chapterId: string, chapterTitle: string, title: string): SearchHit {
  return { nodeId, chapterId, chapterTitle, title }
}

function sortHits(hits: SearchHit[], chapterOrder: Map<string, number>): void {
  hits.sort((a, b) => {
    const ca = chapterOrder.get(a.chapterId) ?? 9999
    const cb = chapterOrder.get(b.chapterId) ?? 9999
    if (ca !== cb) return ca - cb
    const ta = a.title.toLowerCase()
    const tb = b.title.toLowerCase()
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0
  })
}

function buildHits(
  nodes: ReturnType<typeof liveNodes>,
  chapters: ReturnType<typeof liveChapters>,
  q: string,
  excludeChapterId?: string,
): { prefix: SearchHit[]; suffix: SearchHit[] } {
  const prefix: SearchHit[] = []
  const suffix: SearchHit[] = []

  for (const n of nodes) {
    if (excludeChapterId && n.chapterId === excludeChapterId) continue
    const title = normalizeTitle(n.title)
    if (!title.includes(q)) continue
    const chapter = chapters.find((c) => c.id === n.chapterId)
    const hit = makeHit(n.id, n.chapterId, chapter?.title ?? '', n.title)
    const starts = title.startsWith(q)
    if (starts) prefix.push(hit)
    else suffix.push(hit)
  }

  return { prefix, suffix }
}

export function searchNodes(
  s: ContentState,
  query: string,
  options?: { limit?: number; excludeChapterId?: string },
): SearchHit[] {
  const q = normalizeTitle(query)
  if (!q) return []

  const limit = options?.limit ?? SEARCH_LIMIT
  const chapters = liveChapters(s)
  const chapterOrder = new Map(chapters.map((ch, i) => [ch.id, i]))
  const nodes = liveNodes(s)

  const { prefix, suffix } = buildHits(nodes, chapters, q, options?.excludeChapterId)

  sortHits(prefix, chapterOrder)
  sortHits(suffix, chapterOrder)

  return [...prefix, ...suffix].slice(0, limit)
}
