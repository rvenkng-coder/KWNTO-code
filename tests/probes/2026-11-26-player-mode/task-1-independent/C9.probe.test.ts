import { expect, test } from 'vitest'
import { back, historyOf } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

const st = story([
  pn('n1', { title: 'Gate', chapterTitle: 'One', choices: [ch('k1', 'Open it', 'n2'), ch('k2', 'Climb', 'n3')] }),
  pn('n2', { title: 'Door', choices: [ch('k3', 'Knock', 'n3'), ch('k4', 'Push', 'n3')] }),
  pn('n3', { title: 'Garden', chapterId: 'c2', chapterTitle: 'Two', choices: [ch('k5', 'Return', 'n1')] }),
])

// Protects: a one-step history is just the start node's title, current.
test('[C9] empty-one-huge: history of the start alone', () => {
  expect(historyOf(st, walk(st))).toEqual([{ text: 'Gate', chapterTitle: 'One', current: true }])
})

// Protects: the label used is the choice taken, not the first choice of the node, and the arrow is the exact one.
test('[C9] second-bad-item: the second choice of a node is the one named', () => {
  const h = historyOf(st, walk(st, 'k2'))
  expect(h.map((e) => e.text)).toEqual(['Gate', 'Climb → Garden'])
  expect(h[1].text).toContain(' → ')
  const two = historyOf(st, walk(st, 'k1', 'k4'))
  expect(two.map((e) => e.text)).toEqual(['Gate', 'Open it → Door', 'Push → Garden'])
})

// Protects: a loop gives one entry per pass, and only the last is current.
test('[C9] relative-of-fixed-case: a loop repeats its entries', () => {
  const h = historyOf(st, walk(st, 'k2', 'k5', 'k2'))
  expect(h.map((e) => e.text)).toEqual(['Gate', 'Climb → Garden', 'Return → Gate', 'Climb → Garden'])
  expect(h.map((e) => e.chapterTitle)).toEqual(['One', 'Two', 'One', 'Two'])
  expect(h.map((e) => e.current)).toEqual([false, false, false, true])
})

// Protects: after back the history is shorter, the new last is current, and the longer history read earlier is unchanged.
test('[C9] stale-after-change: history after back and a new branch', () => {
  const full = walk(st, 'k1', 'k3')
  const before = historyOf(st, full)
  const shorter = historyOf(st, back(full))
  expect(shorter).toEqual([
    { text: 'Gate', chapterTitle: 'One', current: false },
    { text: 'Open it → Door', chapterTitle: 'One', current: true },
  ])
  expect(before).toHaveLength(3)
  expect(before[1].current).toBe(false)
  expect(historyOf(st, walk(st, 'k2')).map((e) => e.text)).toEqual(['Gate', 'Climb → Garden'])
})

// Protects: a long path gives one entry per step with exactly one current entry.
test('[C9] empty-one-huge: two hundred steps', () => {
  const ids: string[] = []
  for (let i = 0; i < 100; i++) ids.push('k2', 'k5')
  const h = historyOf(st, walk(st, ...ids))
  expect(h).toHaveLength(201)
  expect(h.filter((e) => e.current)).toHaveLength(1)
  expect(h[200].current).toBe(true)
})
