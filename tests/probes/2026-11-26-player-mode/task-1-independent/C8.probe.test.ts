import { expect, test } from 'vitest'
import { back, screenOf } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

// Protects: any number of empty choices still ends the path, and one linked choice among many empty ones does not.
test('[C8] two-bad-items: several empty choices, then one linked', () => {
  const st = story([
    pn('e', { choices: [ch('a', 'x', null), ch('b', 'y', null), ch('c', 'z', null)] }),
    pn('m', { choices: [ch('a', 'x', null), ch('b', 'y', null), ch('c', 'z', 'e')] }),
    pn('m2', { choices: [ch('a', 'x', 'e'), ch('b', 'y', null)] }),
  ], 'e')
  expect(screenOf(st, walk(st)).isEnd).toBe(true)
  expect(screenOf(st, walk({ ...st, startId: 'm' })).isEnd).toBe(false)
  expect(screenOf(st, walk({ ...st, startId: 'm2' })).isEnd).toBe(false)
})

// Protects: a choice back to the same node is a way on, not an end.
test('[C8] relative-of-fixed-case: a self-loop is not an end', () => {
  const st = story([pn('n1', { choices: [ch('k', 'again', 'n1')] })])
  expect(screenOf(st, walk(st)).isEnd).toBe(false)
})

// Protects: isEnd follows the current node as the path moves and as it goes back.
test('[C8] stale-after-change: end flag follows the last step', () => {
  const st = story([pn('n1', { choices: [ch('k', 'go', 'n2')] }), pn('n2')])
  const moved = walk(st, 'k')
  expect(screenOf(st, moved)).toMatchObject({ isEnd: true, canGoBack: true })
  expect(screenOf(st, back(moved)).isEnd).toBe(false)
})

// Protects: a single node with no choices is an end at the very start, with nowhere to go back to.
test('[C8] empty-one-huge: a one-node story', () => {
  const st = story([pn('only')])
  expect(screenOf(st, walk(st))).toMatchObject({ isEnd: true, canGoBack: false, index: 0, showChapter: true })
})

// Protects: a node with many choices that are all linked is not an end.
test('[C8] empty-one-huge: two hundred linked choices', () => {
  const choices = Array.from({ length: 200 }, (_, i) => ch(`k${i}`, `c${i}`, 'n2'))
  const st = story([pn('n1', { choices }), pn('n2')])
  expect(screenOf(st, walk(st)).isEnd).toBe(false)
  expect(screenOf(st, walk(st, 'k199')).isEnd).toBe(true)
})
