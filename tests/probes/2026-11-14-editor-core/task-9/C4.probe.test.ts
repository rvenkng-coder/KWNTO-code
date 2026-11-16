import { expect, test } from 'vitest'
import { chapter } from '../../../../frontend/src/features/editor/model/fixtures'
import { moveChapter } from '../../../../frontend/src/features/editor/chapters/chapterMoves'

const at = (...p: Array<[string, number]>) => p.map(([id, position]) => chapter(id, { position }))

// Protects: moving right in the middle takes the midpoint of the new neighbours.
test('[C4] two-bad-items: B right between C and D', () => {
  expect(moveChapter(at(['A', 1], ['B', 2], ['C', 3], ['D', 4]), 'B', 'right')).toEqual({ kind: 'one', id: 'B', position: 3.5 })
})

// Protects: one chapter alone and an empty list cannot move either way.
test('[C4] empty-one-huge: nothing to move', () => {
  expect(moveChapter(at(['A', 1]), 'A', 'left')).toBeNull()
  expect(moveChapter(at(['A', 1]), 'A', 'right')).toBeNull()
  expect(moveChapter([], 'A', 'left')).toBeNull()
})

// Protects: a renumber on a move to the right lists every chapter once, in the new order.
test('[C4] helper-hides-bug: renumber to the right keeps every chapter', () => {
  const move = moveChapter(at(['A', 1], ['B', 2], ['C', 3], ['D', 3]), 'B', 'right')
  expect(move).toEqual({
    kind: 'renumber',
    positions: [{ id: 'A', position: 1 }, { id: 'C', position: 2 }, { id: 'B', position: 3 }, { id: 'D', position: 4 }],
  })
})
