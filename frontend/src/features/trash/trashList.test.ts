import { expect, test } from 'vitest'
import { fromContent } from '../editor/model/state'
import { chapter, content, node } from '../editor/model/fixtures'
import { daysLeft, trashedItems, trashLabel } from './trashList'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 20, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()

// Protects design 6.8: the trash shows how long an item can still be restored (never
// below 0, rounded up so "0 days" only appears on the purge night) and lists the newest
// trashed items first, with a node of a trashed chapter marked as such and dated by its chapter.
test('the trash lists items newest first with the days left', () => {
  expect(daysLeft(iso(NOW), 30, NOW)).toBe(30)
  expect(daysLeft(iso(NOW - 29.5 * DAY), 30, NOW)).toBe(1)
  expect(daysLeft(iso(NOW - 31 * DAY), 30, NOW)).toBe(0)

  expect(trashLabel(1)).toBe('1 day left')
  expect(trashLabel(5)).toBe('5 days left')
  expect(trashLabel(0)).toBe('Removed tonight')

  const state = fromContent(
    content({
      chapters: [chapter('c1'), chapter('c2', { deleted: true, deletedAt: iso(NOW - 2 * DAY) })],
      nodes: [
        node('inChapter', { chapterId: 'c2' }),
        node('newer', { chapterId: 'c1', deleted: true, deletedAt: iso(NOW - 1 * DAY) }),
        node('older', { chapterId: 'c1', deleted: true, deletedAt: iso(NOW - 5 * DAY) }),
      ],
    }),
  )
  const items = trashedItems(state)
  expect(items.chapters.map((c) => c.id)).toEqual(['c2'])
  expect(items.nodes.map((n) => [n.node.id, n.chapterTrashed])).toEqual([
    ['newer', false],
    ['inChapter', true],
    ['older', false],
  ])
})
