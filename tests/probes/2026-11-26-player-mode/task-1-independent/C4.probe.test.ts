import { expect, test } from 'vitest'
import { choose, startSession } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

const st = story([
  pn('n1', { choices: [ch('k1', 'Go', 'n2'), ch('k2', 'Empty', null), ch('k3', 'Ghost', 'ghost')] }),
  pn('n2', { choices: [ch('m1', 'Next', 'n3'), ch('m2', 'Home', 'n1')] }),
  pn('n3'),
])

// Protects: a choice of another node is refused, and only the current (last) node's choices count.
test('[C4] wrong-actor: choice of a node that is not the current one', () => {
  const start = walk(st)
  expect(choose(st, start, 'm1')).toBeNull()
  const atN2 = walk(st, 'k1')
  expect(choose(st, atN2, 'k1')).toBeNull()
  expect(choose(st, atN2, 'm1')).toEqual({
    steps: [{ nodeId: 'n1', viaChoiceId: null }, { nodeId: 'n2', viaChoiceId: 'k1' }, { nodeId: 'n3', viaChoiceId: 'm1' }],
  })
})

// Protects: choice ids match exactly, including the empty string and prototype names.
test('[C4] case-and-whitespace: near-miss and odd choice ids', () => {
  const s = walk(st)
  for (const id of ['K1', ' k1', 'k1 ', '', 'constructor', '__proto__', 'length', '0']) {
    expect(choose(st, s, id)).toBeNull()
  }
})

// Protects: a target named like a prototype member is not in the story.
test('[C4] relative-of-fixed-case: target that is a prototype name', () => {
  const odd = story([pn('n1', { choices: [ch('k1', 'x', 'constructor'), ch('k2', 'y', 'toString')] })])
  expect(choose(odd, walk(odd), 'k1')).toBeNull()
  expect(choose(odd, walk(odd), 'k2')).toBeNull()
})

// Protects: refusals and moves leave the session given untouched, even when it is frozen.
test('[C4] stale-after-change: the input session is never changed', () => {
  const s = walk(st)
  Object.freeze(s)
  Object.freeze(s.steps)
  const snapshot = structuredClone(s)
  expect(choose(st, s, 'k2')).toBeNull()
  expect(choose(st, s, 'k3')).toBeNull()
  const moved = choose(st, s, 'k1')
  expect(moved?.steps).toHaveLength(2)
  expect(moved).not.toBe(s)
  expect(moved?.steps).not.toBe(s.steps)
  expect(s).toEqual(snapshot)
})

// Protects: the same choice taken twice from one session gives two equal, separate results.
test('[C4] race-and-parallel: choosing twice from one session', () => {
  const s = startSession(st)
  if (s === null) throw new Error('no session')
  const a = choose(st, s, 'k1')
  const b = choose(st, s, 'k1')
  expect(a).toEqual(b)
  expect(a).not.toBe(b)
  a?.steps.push({ nodeId: 'n3', viaChoiceId: 'x' })
  expect(b?.steps).toHaveLength(2)
  expect(s.steps).toHaveLength(1)
})
