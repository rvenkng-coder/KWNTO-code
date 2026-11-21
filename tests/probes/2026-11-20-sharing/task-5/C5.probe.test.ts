import { expect, test } from 'vitest'
import type { Comment } from '../../../../frontend/src/backend'
import { applyCommentEvent, canDelete, commentsOf, countLabel } from '../../../../frontend/src/features/comments/commentList'

const c = (id: string, created: string, extra: Partial<Comment> = {}): Comment =>
  ({ id, projectId: 'p1', nodeId: 'n1', authorId: 'u1', authorName: 'Ana', body: id, created, ...extra })

// Protects: probe of plan row C5, the author's own echo and a repeated event never double a comment.
test('[C5] idempotent: the same create twice, and a create already loaded, leave one comment', () => {
  const a = c('a', '2026-11-20 10:00:00.000Z')
  const once = applyCommentEvent([], { action: 'create', record: a })
  expect(applyCommentEvent(once, { action: 'create', record: a })).toHaveLength(1)
  expect(applyCommentEvent([a], { action: 'create', record: { ...a, body: 'echo' } })).toEqual([a])
})

// Protects: probe of plan row C5, a delete drops only its comment and an unknown delete changes nothing.
test('[C5] equivalence: delete drops that comment; deleting an unknown id keeps the list', () => {
  const list = [c('a', '1'), c('b', '2')]
  expect(applyCommentEvent(list, { action: 'delete', record: list[0]! }).map((x) => x.id)).toEqual(['b'])
  expect(applyCommentEvent(list, { action: 'delete', record: c('zzz', '3') }).map((x) => x.id)).toEqual(['a', 'b'])
  expect(applyCommentEvent([], { action: 'delete', record: c('a', '1') })).toEqual([])
})

// Protects: probe of plan row C5, oldest first, and a tie on `created` is broken by id so the order is stable.
test('[C5] boundary: oldest first, same created broken by id, whatever order events arrive in', () => {
  const late = c('late', '2026-11-20 10:00:02.000Z')
  const tieB = c('b', '2026-11-20 10:00:01.000Z')
  const tieA = c('a', '2026-11-20 10:00:01.000Z')
  let list: Comment[] = []
  for (const record of [late, tieB, tieA]) list = applyCommentEvent(list, { action: 'create', record })
  expect(list.map((x) => x.id)).toEqual(['a', 'b', 'late'])
})

// Protects: probe of plan row C5, only the asked node's comments, and the input list is not changed.
test('[C5] equivalence: commentsOf filters by node, sorts, and leaves its input alone', () => {
  const list = [c('x', '3', { nodeId: 'n2' }), c('b', '2'), c('a', '1')]
  const snapshot = list.map((x) => x.id)
  expect(commentsOf(list, 'n1').map((x) => x.id)).toEqual(['a', 'b'])
  expect(commentsOf(list, 'none')).toEqual([])
  expect(list.map((x) => x.id)).toEqual(snapshot)
})

// Protects: probe of plan row C5, exact copy of the badge label.
test('[C5] boundary: countLabel for 0, 1, 2 and 100', () => {
  expect(countLabel(0)).toBe('')
  expect(countLabel(1)).toBe('1 comment')
  expect(countLabel(2)).toBe('2 comments')
  expect(countLabel(100)).toBe('100 comments')
})

// Protects: probe of plan row C5 / D13, who sees a Delete button; a comment whose author's account is gone is deletable by the owner only.
test('[C5] equivalence: canDelete for author, other member, owner, and an author-less comment', () => {
  const mine = c('a', '1')
  expect(canDelete(mine, 'u1', false)).toBe(true)
  expect(canDelete(mine, 'u2', false)).toBe(false)
  expect(canDelete(mine, 'u2', true)).toBe(true)
  const orphan = c('o', '1', { authorId: null })
  expect(canDelete(orphan, 'u1', false)).toBe(false)
  expect(canDelete(orphan, '', false)).toBe(false)
  expect(canDelete(orphan, 'u1', true)).toBe(true)
})
