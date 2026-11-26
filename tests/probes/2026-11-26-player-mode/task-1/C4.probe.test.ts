import { expect, test } from 'vitest'
import { choose, startSession } from '../../../../frontend/src/features/player/session'
import { go, play, pnode, story } from './helpers'

// Protects: a choice id belongs to the node on screen; one from another node, an empty id and a different case all move nothing.
test('[C4] wrong-actor: a choice of another node, an empty id, a wrong-case id', () => {
  const st = story([pnode('n1', 'c1', [go('k1', 'n2')]), pnode('n2', 'c1', [go('k2', 'n1')])])
  const start = startSession(st)!
  expect(choose(st, start, 'k2')).toBeNull()
  expect(choose(st, start, '')).toBeNull()
  expect(choose(st, start, 'K1')).toBeNull()
  const deeper = play(st, 'k1')
  expect(choose(st, deeper, 'k1')).toBeNull()
  expect(choose(st, deeper, 'k2')?.steps).toHaveLength(3)
})

// Protects: after a refused choice the next good one still works, and the earlier session is untouched.
test('[C4] second-bad-item: a refused choice, then a good one', () => {
  const st = story([pnode('n1', 'c1', [go('bad', null), go('ok', 'n2')]), pnode('n2', 'c1')])
  const start = startSession(st)!
  expect(choose(st, start, 'bad')).toBeNull()
  const moved = choose(st, start, 'ok')
  expect(moved?.steps.map((s) => s.nodeId)).toEqual(['n1', 'n2'])
  expect(start.steps).toHaveLength(1)
})

// Protects: a choice whose target is not in the story is refused even when the target id is a real-looking one.
test('[C4] stale-after-change: the target left the story', () => {
  const st = story([pnode('n1', 'c1', [go('k1', 'n9')])])
  expect(choose(st, startSession(st)!, 'k1')).toBeNull()
})

// Protects: a node with no choices, and one with a hundred empty ones, never moves.
test('[C4] empty-one-huge: no choices and a hundred empty choices', () => {
  const empties = Array.from({ length: 100 }, (_, i) => go(`e${i}`, null))
  const st = story([pnode('a', 'c1'), pnode('b', 'c1', empties)], 'a')
  expect(choose(st, startSession(st)!, 'e1')).toBeNull()
  const atB = story([pnode('b', 'c1', empties)])
  expect(empties.every((c) => choose(atB, startSession(atB)!, c.id) === null)).toBe(true)
})
