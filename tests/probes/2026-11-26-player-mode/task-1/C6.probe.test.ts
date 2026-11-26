import { expect, test } from 'vitest'
import { historyOf, screenOf } from '../../../../frontend/src/features/player/session'
import { go, play, pnode, story } from './helpers'

// Protects: a thousand moves around a loop are a thousand and one steps, quickly, and the screen and history still work at the end.
test('[C6] empty-one-huge: 1,000 trips round a two-node loop', () => {
  const st = story([pnode('a', 'c1', [go('ab', 'b')]), pnode('b', 'c1', [go('ba', 'a')])])
  const started = Date.now()
  const session = play(st, ...Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 'ab' : 'ba')))
  expect(session.steps).toHaveLength(1001)
  expect(screenOf(st, session).node.id).toBe('a')
  expect(historyOf(st, session)).toHaveLength(1001)
  expect(Date.now() - started).toBeLessThan(2000)
})

// Protects: ping-ponging between two chapters shows the chapter name on every step, since it changes every time.
test('[C6] relative-of-fixed-case: a loop that crosses chapters each move', () => {
  const st = story([pnode('a', 'c1', [go('ab', 'b')]), pnode('b', 'c2', [go('ba', 'a')])])
  const session = play(st, 'ab', 'ba', 'ab')
  const flags = session.steps.map((_, i) => screenOf(st, { steps: session.steps.slice(0, i + 1) }).showChapter)
  expect(flags).toEqual([true, true, true, true])
})

// Protects: a loop does not touch the choices of the story or the earlier sessions.
test('[C6] stale-after-change: the story and an earlier session are the same after looping', () => {
  const st = story([pnode('a', 'c1', [go('k', 'a')])])
  const before = JSON.stringify(st)
  const one = play(st, 'k')
  const three = play(st, 'k', 'k', 'k')
  expect(one.steps).toHaveLength(2)
  expect(three.steps).toHaveLength(4)
  expect(JSON.stringify(st)).toBe(before)
})
