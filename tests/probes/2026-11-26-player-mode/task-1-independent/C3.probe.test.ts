import { expect, test } from 'vitest'
import { startSession } from '../../../../frontend/src/features/player/session'
import { ch, pn, story } from './helpers'

// Protects: an empty-string or differently-cased start id names no node.
test('[C3] case-and-whitespace: start id that nearly matches', () => {
  expect(startSession(story([pn('n1')], ''))).toBeNull()
  expect(startSession(story([pn('n1')], 'N1'))).toBeNull()
  expect(startSession(story([pn('n1')], ' n1'))).toBeNull()
})

// Protects: a story with no nodes at all has nothing to start, whatever the start id says.
test('[C3] empty-one-huge: empty story and single-node story', () => {
  expect(startSession(story([], 'n1'))).toBeNull()
  expect(startSession(story([], null))).toBeNull()
  expect(startSession(story([pn('n1')], 'n1'))).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }] })
})

// Protects: the start is the story's start node, not the first or the only listed node.
test('[C3] relative-of-fixed-case: start in the middle of several nodes', () => {
  const st = story([pn('a', { choices: [ch('k', 'x', 'b')] }), pn('b'), pn('c')], 'c')
  expect(startSession(st)).toEqual({ steps: [{ nodeId: 'c', viaChoiceId: null }] })
})

// Protects: an id that exists on every plain object (a prototype name) is not mistaken for a node.
test('[C3] relative-of-fixed-case: prototype names are not nodes', () => {
  expect(startSession(story([pn('n1')], 'constructor'))).toBeNull()
  expect(startSession(story([pn('n1')], 'toString'))).toBeNull()
  expect(startSession(story([pn('n1')], '__proto__'))).toBeNull()
})

// Protects: each start is a fresh session; changing one never shows in another or in the story.
test('[C3] race-and-parallel: two starts are independent', () => {
  const st = story([pn('n1')])
  const a = startSession(st)
  const b = startSession(st)
  expect(a).not.toBe(b)
  expect(a?.steps).not.toBe(b?.steps)
  a?.steps.push({ nodeId: 'n1', viaChoiceId: 'z' })
  expect(b).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }] })
  expect(startSession(st)).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }] })
})
