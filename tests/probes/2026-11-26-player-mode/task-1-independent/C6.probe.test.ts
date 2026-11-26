import { expect, test } from 'vitest'
import { back, choose, screenOf } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

const loop = story([pn('n1', { choices: [ch('k1', 'Again', 'n1')] })])
const pingPong = story([
  pn('n1', { choices: [ch('a', 'To two', 'n2')] }),
  pn('n2', { choices: [ch('b', 'To one', 'n1')] }),
])

// Protects: a thousand self-loops stay linear, and back unwinds them one at a time.
test('[C6] empty-one-huge: a thousand loops then back to the start', () => {
  let s = walk(loop)
  for (let i = 0; i < 1000; i++) {
    const next = choose(loop, s, 'k1')
    if (next === null) throw new Error('refused')
    s = next
  }
  expect(s.steps).toHaveLength(1001)
  expect(s.steps.slice(1).every((x) => x.nodeId === 'n1' && x.viaChoiceId === 'k1')).toBe(true)
  for (let i = 0; i < 1000; i++) s = back(s)
  expect(s.steps).toEqual([{ nodeId: 'n1', viaChoiceId: null }])
})

// Protects: each loop pass is an own session; earlier ones stay as they were.
test('[C6] stale-after-change: earlier sessions of a loop are not extended', () => {
  const s1 = walk(loop, 'k1')
  const s2 = choose(loop, s1, 'k1')
  const s3 = choose(loop, s1, 'k1')
  expect(s1.steps).toHaveLength(2)
  expect(s2?.steps).toHaveLength(3)
  expect(s3?.steps).toHaveLength(3)
  expect(s2).not.toBe(s3)
})

// Protects: a loop between two nodes alternates and every screen along it still reports the right position.
test('[C6] relative-of-fixed-case: ping-pong positions and chapter flags', () => {
  const s = walk(pingPong, 'a', 'b', 'a', 'b', 'a', 'b')
  expect(s.steps.map((x) => x.nodeId)).toEqual(['n1', 'n2', 'n1', 'n2', 'n1', 'n2', 'n1'])
  expect(s.steps.map((x) => x.viaChoiceId)).toEqual([null, 'a', 'b', 'a', 'b', 'a', 'b'])
  for (let i = 0; i < s.steps.length; i++) {
    const screen = screenOf(pingPong, { steps: s.steps.slice(0, i + 1) })
    expect(screen.index).toBe(i)
    expect(screen.showChapter).toBe(i === 0)
    expect(screen.isEnd).toBe(false)
  }
})

// Protects: two different choices to the same node are told apart by id in the path.
test('[C6] two-bad-items: two choices to the same target record their own ids', () => {
  const st = story([pn('n1', { choices: [ch('x', 'one', 'n2'), ch('y', 'two', 'n2')] }), pn('n2')])
  expect(walk(st, 'y').steps[1]).toEqual({ nodeId: 'n2', viaChoiceId: 'y' })
  expect(walk(st, 'x').steps[1]).toEqual({ nodeId: 'n2', viaChoiceId: 'x' })
})

// Protects: a loop is never an end, and a chapter changing on a loop between chapters shows each time.
test('[C6] relative-of-fixed-case: loop across two chapters', () => {
  const st = story([
    pn('n1', { chapterId: 'c1', choices: [ch('a', 'x', 'n2')] }),
    pn('n2', { chapterId: 'c2', choices: [ch('b', 'y', 'n1')] }),
  ])
  const flags = [0, 1, 2, 3, 4].map((i) => {
    const full = walk(st, 'a', 'b', 'a', 'b')
    return screenOf(st, { steps: full.steps.slice(0, i + 1) }).showChapter
  })
  expect(flags).toEqual([true, true, true, true, true])
})
