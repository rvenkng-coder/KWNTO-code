import { expect, test } from 'vitest'
import { chapter, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'
import { daysLeft, trashLabel, trashedItems } from '../../../../frontend/src/features/trash/trashList'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 20, 12, 0, 0)

// Protects: probe of plan row C6, days left never go below 0 and round up (design 6.8).
test('[C6] boundary: a few seconds old is still 30 days, exactly 30 days is 0, a bad date is 0', () => {
  expect(daysLeft(new Date(now - 5000).toISOString(), 30, now)).toBe(30)
  expect(daysLeft(new Date(now - 30 * DAY).toISOString(), 30, now)).toBe(0)
  expect(daysLeft(new Date(now - 90 * DAY).toISOString(), 30, now)).toBe(0)
  expect(daysLeft(new Date(now).toISOString(), 0, now)).toBe(0)
})

// Protects: probe of plan row C6, exact copy of the labels.
test('[C6] boundary: labels singular, plural and zero', () => {
  expect(trashLabel(1)).toBe('1 day left')
  expect(trashLabel(2)).toBe('2 days left')
  expect(trashLabel(0)).toBe('Removed tonight')
})

// Protects: probe of plan row C6, live items are not listed and order is newest first.
test('[C6] stale-after-change: live nodes and chapters are not in the trash; trashed ones come newest first', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { deleted: true, deletedAt: '2026-11-10T00:00:00.000Z' })],
    nodes: [
      node('live', { chapterId: 'c1' }),
      node('old', { chapterId: 'c1', deleted: true, deletedAt: '2026-11-01T00:00:00.000Z' }),
      node('new', { chapterId: 'c1', deleted: true, deletedAt: '2026-11-15T00:00:00.000Z' }),
      node('inch', { chapterId: 'c2' }),
    ],
  }))
  const t = trashedItems(s)
  expect(t.chapters.map((c) => c.id)).toEqual(['c2'])
  expect(t.nodes.map((n) => n.node.id)).not.toContain('live')
  expect(t.nodes.find((n) => n.node.id === 'inch')?.chapterTrashed).toBe(true)
  const ids = t.nodes.filter((n) => !n.chapterTrashed).map((n) => n.node.id)
  expect(ids).toEqual(['new', 'old'])
})
