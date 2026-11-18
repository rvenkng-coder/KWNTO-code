import { expect, test } from 'vitest'
import { chapter } from '../model/fixtures'
import { moveChapter } from './chapterMoves'

const at = (...positions: Array<[string, number]>) => positions.map(([id, position]) => chapter(id, { position }))

// Protects: a chapter swaps with its neighbour by a new position, or the tabs are renumbered when there is no room.
test('moveChapter swaps neighbours and renumbers when there is no room', () => {
  const abc = at(['A', 1], ['B', 2], ['C', 3])
  expect(moveChapter(abc, 'C', 'left')).toEqual({ kind: 'one', id: 'C', position: 1.5 })
  expect(moveChapter(abc, 'B', 'left')).toEqual({ kind: 'one', id: 'B', position: 0 })
  expect(moveChapter(abc, 'A', 'left')).toBeNull()
  expect(moveChapter(abc, 'C', 'right')).toBeNull()
  expect(moveChapter(abc, 'X', 'right')).toBeNull()
  expect(moveChapter(at(['A', 1], ['B', 1], ['C', 3]), 'C', 'left')).toEqual({
    kind: 'renumber',
    positions: [{ id: 'A', position: 1 }, { id: 'C', position: 2 }, { id: 'B', position: 3 }],
  })
})
