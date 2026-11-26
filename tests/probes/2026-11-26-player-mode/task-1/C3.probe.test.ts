import { expect, test } from 'vitest'
import { startSession } from '../../../../frontend/src/features/player/session'
import { pnode, story } from './helpers'

// Protects: a story with no nodes at all, and one whose start names an absent node, have nothing to play.
test('[C3] empty-one-huge: no nodes, and a start that is not among them', () => {
  expect(startSession(story([], null))).toBeNull()
  expect(startSession(story([], 'n1'))).toBeNull()
  expect(startSession({ projectName: '', startId: '', nodes: {} })).toBeNull()
})

// Protects: the start is the project's start node, not the first node of the list.
test('[C3] relative-of-fixed-case: the start is not the first node', () => {
  const st = story([pnode('a', 'c1'), pnode('b', 'c1')], 'b')
  expect(startSession(st)).toEqual({ steps: [{ nodeId: 'b', viaChoiceId: null }] })
})

// Protects: two sessions are separate objects, so moving one cannot change the other.
test('[C3] race-and-parallel: two starts do not share their steps', () => {
  const st = story([pnode('a', 'c1')])
  const one = startSession(st)!
  const two = startSession(st)!
  expect(one.steps).not.toBe(two.steps)
  one.steps.push({ nodeId: 'x', viaChoiceId: 'y' })
  expect(two.steps).toHaveLength(1)
  expect(startSession(st)?.steps).toHaveLength(1)
})
