import { expect, test } from 'vitest'
import { back, choose, screenOf, startSession } from '../../../../frontend/src/features/player/session'
import { go, play, pnode, story } from './helpers'

const st = story([pnode('a', 'c1', [go('k1', 'b'), go('k2', 'c')]), pnode('b', 'c1'), pnode('c', 'c1')])

// Protects: many Backs in a row stop at the start and stay there, and the start screen cannot go back.
test('[C7] empty-one-huge: ten Backs from a three-step path', () => {
  let session = play(story([pnode('a', 'c1', [go('k', 'a')])]), 'k', 'k')
  for (let i = 0; i < 10; i++) session = back(session)
  expect(session.steps).toEqual([{ nodeId: 'a', viaChoiceId: null }])
  expect(screenOf(story([pnode('a', 'c1', [go('k', 'a')])]), session).canGoBack).toBe(false)
})

// Protects: after Back a different choice makes a new branch, and the old branch is gone from the path.
test('[C7] stale-after-change: back, then the other choice', () => {
  const first = play(st, 'k1')
  const again = choose(st, back(first), 'k2')
  expect(again?.steps.map((s) => s.nodeId)).toEqual(['a', 'c'])
  expect(again?.steps[1]?.viaChoiceId).toBe('k2')
  expect(first.steps.map((s) => s.nodeId)).toEqual(['a', 'b'])
})

// Protects: Back on the start returns a usable session that still starts at the start node.
test('[C7] relative-of-fixed-case: back at the start, then a choice', () => {
  const start = startSession(st)!
  const same = back(start)
  expect(same.steps).toEqual(start.steps)
  expect(choose(st, same, 'k1')?.steps).toHaveLength(2)
})
