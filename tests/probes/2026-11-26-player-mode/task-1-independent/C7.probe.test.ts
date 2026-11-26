import { expect, test } from 'vitest'
import { back, choose, screenOf, startSession } from '../../../../frontend/src/features/player/session'
import { ch, pn, story, walk } from './helpers'

const st = story([
  pn('n1', { choices: [ch('k1', 'a', 'n2'), ch('k4', 'd', 'n4')] }),
  pn('n2', { choices: [ch('k2', 'b', 'n3')] }),
  pn('n3', { choices: [ch('k3', 'c', 'n1')] }),
  pn('n4'),
])

// Protects: back keeps the via ids of the steps that remain and leaves the longer sessions as they were, even frozen.
test('[C7] stale-after-change: back never changes the session it was given', () => {
  const three = walk(st, 'k1', 'k2')
  Object.freeze(three)
  Object.freeze(three.steps)
  const snapshot = structuredClone(three)
  const two = back(three)
  expect(two.steps).toEqual([{ nodeId: 'n1', viaChoiceId: null }, { nodeId: 'n2', viaChoiceId: 'k1' }])
  expect(three).toEqual(snapshot)
  expect(two).not.toBe(three)
})

// Protects: a choice after a back replaces the undone step, so the undone node is gone from the path.
test('[C7] relative-of-fixed-case: branch after back', () => {
  const two = walk(st, 'k1')
  const first = back(two)
  const branched = choose(st, first, 'k4')
  expect(branched?.steps).toEqual([{ nodeId: 'n1', viaChoiceId: null }, { nodeId: 'n4', viaChoiceId: 'k4' }])
  expect(two.steps).toHaveLength(2)
  expect(two.steps[1].nodeId).toBe('n2')
})

// Protects: back at the start stays at the start however many times it is pressed, and canGoBack stays false.
test('[C7] empty-one-huge: many backs from one step and from a long path', () => {
  let s = walk(st)
  for (let i = 0; i < 50; i++) s = back(s)
  expect(s.steps).toEqual([{ nodeId: 'n1', viaChoiceId: null }])
  expect(screenOf(st, s).canGoBack).toBe(false)

  let long = walk(st, 'k1', 'k2', 'k3', 'k1', 'k2', 'k3')
  expect(long.steps).toHaveLength(7)
  for (let i = 0; i < 6; i++) long = back(long)
  expect(long.steps).toEqual([{ nodeId: 'n1', viaChoiceId: null }])
  expect(screenOf(st, long).canGoBack).toBe(false)
})

// Protects: the screen after each back reflects exactly the remaining last step.
test('[C7] relative-of-fixed-case: screen after each back', () => {
  const three = walk(st, 'k1', 'k2')
  expect(screenOf(st, three)).toMatchObject({ index: 2, canGoBack: true })
  expect(screenOf(st, three).node.id).toBe('n3')
  const two = back(three)
  expect(screenOf(st, two)).toMatchObject({ index: 1, canGoBack: true })
  expect(screenOf(st, two).node.id).toBe('n2')
  const one = back(two)
  expect(screenOf(st, one)).toMatchObject({ index: 0, canGoBack: false })
  expect(screenOf(st, one).node.id).toBe('n1')
})

// Protects: restarting is a fresh start and does not reach into the old path.
test('[C7] race-and-parallel: restart after moving and back', () => {
  const moved = walk(st, 'k1', 'k2')
  const fresh = startSession(st)
  expect(fresh).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }] })
  expect(moved.steps).toHaveLength(3)
  expect(back(moved).steps).toHaveLength(2)
  expect(fresh?.steps).not.toBe(moved.steps)
})
