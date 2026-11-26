import { expect, test } from 'vitest'
import { back, historyOf } from '../../../../frontend/src/features/player/session'
import { go, play, pnode, story } from './helpers'

// Protects: a path that visits the same node twice lists it twice, each with the choice taken, and only the last is current.
test('[C9] relative-of-fixed-case: a loop appears as repeated entries', () => {
  const st = story([pnode('a', 'c1', [go('k1', 'b', 'Open')], 'Gate'), pnode('b', 'c1', [go('k2', 'a', 'Return')], 'Door')])
  const h = historyOf(st, play(st, 'k1', 'k2', 'k1'))
  expect(h.map((e) => e.text)).toEqual(['Gate', 'Open → Door', 'Return → Gate', 'Open → Door'])
  expect(h.map((e) => e.current)).toEqual([false, false, false, true])
})

// Protects: a label with arrows, quotes or markup in it is shown as it is, not split or changed.
test('[C9] case-and-whitespace: a label that contains an arrow and markup', () => {
  const label = 'Go → <b>now</b> "quoted"'
  const st = story([pnode('a', 'c1', [go('k', 'b', label)], 'A'), pnode('b', 'c1', [], 'B')])
  expect(historyOf(st, play(st, 'k')).map((e) => e.text)).toEqual(['A', `${label} → B`])
})

// Protects: Back takes the last entry off the list and the new last one becomes current; at the start there is one current entry.
test('[C9] stale-after-change: history after Back and Back again', () => {
  const st = story([pnode('a', 'c1', [go('k1', 'b')]), pnode('b', 'c2', [go('k2', 'c')]), pnode('c', 'c2')])
  const full = play(st, 'k1', 'k2')
  const one = historyOf(st, back(full))
  expect(one).toHaveLength(2)
  expect(one.at(-1)?.current).toBe(true)
  const zero = historyOf(st, back(back(full)))
  expect(zero).toHaveLength(1)
  expect(zero[0]).toEqual({ text: 'a', chapterTitle: 'chapter c1', current: true })
})

// Protects: a thousand entries are listed in order without losing any.
test('[C9] empty-one-huge: a path of 1,000 steps', () => {
  const st = story([pnode('a', 'c1', [go('k', 'a')], 'Loop')])
  const h = historyOf(st, play(st, ...Array.from({ length: 999 }, () => 'k')))
  expect(h).toHaveLength(1000)
  expect(h.filter((e) => e.current)).toHaveLength(1)
  expect(h[1]?.text).toBe('k → Loop')
})
