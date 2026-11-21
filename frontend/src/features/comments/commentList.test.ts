import { expect, test } from 'vitest'
import type { Comment } from '../../backend'
import { applyCommentEvent, canDelete, commentLength, commentsOf, countLabel } from './commentList'

const make = (id: string, nodeId: string, created: string, authorId: string | null = 'u1'): Comment => ({
  id, projectId: 'p', nodeId, authorId, authorName: 'Mara', body: id, created,
})

// Protects D13: a comment that arrives twice (the author's own save and its live echo) is
// listed once, a delete removes it, a node's comments come oldest first (ties by id), the
// badge text follows the count, and only the author or the team owner may delete.
test('comments are listed once, in order, and deleted only by author or owner', () => {
  const a = make('a', 'n1', '2026-11-20 10:00:00.000Z')
  const b = make('b', 'n1', '2026-11-20 09:00:00.000Z')
  const c = make('c', 'n2', '2026-11-20 08:00:00.000Z')
  let list = applyCommentEvent([], { action: 'create', record: a })
  list = applyCommentEvent(list, { action: 'create', record: a })
  expect(list).toEqual([a])
  list = applyCommentEvent(list, { action: 'create', record: b })
  list = applyCommentEvent(list, { action: 'create', record: c })
  expect(commentsOf(list, 'n1').map((x) => x.id)).toEqual(['b', 'a'])
  const tie = make('0', 'n1', a.created)
  expect(commentsOf(applyCommentEvent(list, { action: 'create', record: tie }), 'n1').map((x) => x.id)).toEqual(['b', '0', 'a'])
  expect(applyCommentEvent(list, { action: 'delete', record: a }).map((x) => x.id)).toEqual(['c', 'b'])

  expect([countLabel(0), countLabel(1), countLabel(3)]).toEqual(['', '1 comment', '3 comments'])
  expect([canDelete(a, 'u1', false), canDelete(a, 'u2', false), canDelete(a, 'u2', true)]).toEqual([true, false, true])
  expect(canDelete(make('x', 'n1', '', null), 'u1', false)).toBe(false)
})

// Protects review finding L10: the 2000 limit counts characters like the server, so an emoji is one, not two.
test('commentLength counts characters, not UTF-16 units', () => {
  expect(commentLength('abc')).toBe(3)
  expect(commentLength('😀'.repeat(1500))).toBe(1500)
  expect(commentLength('')).toBe(0)
})
