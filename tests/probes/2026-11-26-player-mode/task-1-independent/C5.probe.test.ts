import { expect, test } from 'vitest'
import { back, screenOf } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

const shows = (st: ReturnType<typeof story>, ...ids: string[]): boolean[] => {
  const full = walk(st, ...ids)
  return full.steps.map((_, i) => screenOf(st, { steps: full.steps.slice(0, i + 1) }).showChapter)
}

// Protects: the chapter is compared by id, not by title: same title with another id shows, same id with another node title does not.
test('[C5] case-and-whitespace: same title different chapter, same chapter different title', () => {
  const st = story([
    pn('n1', { chapterId: 'c1', chapterTitle: 'One', choices: [ch('k1', 'a', 'n2')] }),
    pn('n2', { chapterId: 'c2', chapterTitle: 'One', choices: [ch('k2', 'b', 'n3')] }),
    pn('n3', { chapterId: 'c2', chapterTitle: 'Other', title: 'Different' }),
  ])
  expect(shows(st, 'k1', 'k2')).toEqual([true, true, false])
})

// Protects: coming back to an earlier chapter shows its name again.
test('[C5] relative-of-fixed-case: leaving and returning to a chapter', () => {
  const st = story([
    pn('n1', { chapterId: 'c1', choices: [ch('k1', 'a', 'n2')] }),
    pn('n2', { chapterId: 'c2', choices: [ch('k2', 'b', 'n3')] }),
    pn('n3', { chapterId: 'c1', choices: [ch('k3', 'c', 'n4')] }),
    pn('n4', { chapterId: 'c1' }),
  ])
  expect(shows(st, 'k1', 'k2', 'k3')).toEqual([true, true, true, false])
})

// Protects: a one-step session shows the chapter, also straight after a back to the start.
test('[C5] empty-one-huge: single step and back to the start', () => {
  const st = story([pn('n1', { choices: [ch('k1', 'a', 'n2')] }), pn('n2')])
  expect(screenOf(st, walk(st)).showChapter).toBe(true)
  const s = back(walk(st, 'k1'))
  expect(s.steps).toHaveLength(1)
  const screen = screenOf(st, s)
  expect(screen.showChapter).toBe(true)
  expect(screen.index).toBe(0)
  expect(screen.node.id).toBe('n1')
})

// Protects: after a back across a chapter change the previous screen compares with its own predecessor, not a stale one.
test('[C5] stale-after-change: back over a chapter boundary and forward again', () => {
  const st = story([
    pn('n1', { chapterId: 'c1', choices: [ch('k1', 'a', 'n2')] }),
    pn('n2', { chapterId: 'c1', choices: [ch('k2', 'b', 'n3')] }),
    pn('n3', { chapterId: 'c2', choices: [ch('k3', 'c', 'n2')] }),
  ])
  const three = walk(st, 'k1', 'k2')
  expect(screenOf(st, three).showChapter).toBe(true)
  const two = back(three)
  expect(screenOf(st, two).showChapter).toBe(false)
  const again = walk(st, 'k1', 'k2', 'k3')
  expect(screenOf(st, again)).toMatchObject({ index: 3, showChapter: true, canGoBack: true })
  expect(screenOf(st, again).node.id).toBe('n2')
})

// Protects: the screen reports the last step's position, node and back availability.
test('[C5] relative-of-fixed-case: index, node and canGoBack per step', () => {
  const st = story([pn('n1', { choices: [ch('k1', 'a', 'n2')] }), pn('n2')])
  expect(screenOf(st, walk(st))).toMatchObject({ index: 0, canGoBack: false })
  const last = screenOf(st, walk(st, 'k1'))
  expect(last).toMatchObject({ index: 1, canGoBack: true })
  expect(last.node).toBe(st.nodes.n2)
})
