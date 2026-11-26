import { expect, test } from 'vitest'
import { back, screenOf } from '../../../../frontend/src/features/player/session'
import { go, play, pnode, story } from './helpers'

const shown = (st: ReturnType<typeof story>, session: ReturnType<typeof play>) =>
  session.steps.map((_, i) => screenOf(st, { steps: session.steps.slice(0, i + 1) }).showChapter)

// Protects: leaving a chapter and coming back shows the chapter name each time it changes, including the return.
test('[C5] relative-of-fixed-case: chapter one, two, then one again', () => {
  const st = story([pnode('a', 'c1', [go('k1', 'b')]), pnode('b', 'c2', [go('k2', 'c')]), pnode('c', 'c1')])
  expect(shown(st, play(st, 'k1', 'k2'))).toEqual([true, true, true])
})

// Protects: a choice to a node in the same chapter, and a loop inside another chapter, never repeats the banner.
test('[C5] second-bad-item: same chapter twice, then a self loop in another chapter', () => {
  const st = story([
    pnode('a', 'c1', [go('k1', 'b')]),
    pnode('b', 'c1', [go('k2', 'c')]),
    pnode('c', 'c2', [go('k3', 'c')]),
  ])
  expect(shown(st, play(st, 'k1', 'k2', 'k3', 'k3'))).toEqual([true, false, true, false, false])
})

// Protects: after Back the banner follows the earlier step, and at step 0 it always shows.
test('[C5] stale-after-change: back across a chapter change and to the start', () => {
  const st = story([pnode('a', 'c1', [go('k1', 'b')]), pnode('b', 'c2')])
  const full = play(st, 'k1')
  expect(screenOf(st, full).showChapter).toBe(true)
  const start = back(full)
  expect(screenOf(st, start).showChapter).toBe(true)
  expect(screenOf(st, start).index).toBe(0)
})

// Protects: a long path inside one chapter shows the banner once, at the start.
test('[C5] empty-one-huge: 300 steps in one chapter', () => {
  const st = story([pnode('a', 'c1', [go('k', 'a')])])
  const session = play(st, ...Array.from({ length: 300 }, () => 'k'))
  const flags = shown(st, session)
  expect(flags).toHaveLength(301)
  expect(flags.filter(Boolean)).toHaveLength(1)
})
