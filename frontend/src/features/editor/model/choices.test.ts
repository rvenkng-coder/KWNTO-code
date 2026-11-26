import { expect, test } from 'vitest'
import { choicesOf, hasChoiceTo, newChoice } from './choices'
import { chapter, connection, content, node } from './fixtures'
import { fromContent, putRecord } from './state'

const T1 = '2026-11-18T10:00:01.000Z'
const T2 = '2026-11-18T10:00:02.000Z'

const state = () =>
  fromContent(
    content({
      chapters: [chapter('c1'), chapter('gone', { deleted: true })],
      nodes: [node('a'), node('b'), node('c'), node('t', { deleted: true })],
      connections: [
        connection('late', 'a', 'b', { created: T2 }),
        connection('y2', 'a', null, { created: T1 }),
        connection('x1', 'a', 'c', { created: T1 }),
        connection('other', 'b', 'c'),
        connection('toTrash', 'a', 't', { created: T1 }),
      ],
    }),
  )

// Protects: editor cards design 1 (choices in the order they were made, empty ones included; F1 and F2).
test("choicesOf lists a node's choices by when they were made, empty ones included", () => {
  expect(choicesOf(state(), 'a').map((c) => c.id)).toEqual(['x1', 'y2', 'late'])
})

// Protects: plan Review Focus 3: a re-link must not reorder the list.
test('choicesOf keeps the order when a choice is re-linked', () => {
  const s = state()
  const before = choicesOf(s, 'a').map((c) => c.id)
  const relinked = putRecord(s, 'connections', { ...s.connections.late!, toNodeId: 'c', version: 1 })
  expect(choicesOf(relinked, 'a').map((c) => c.id)).toEqual(before)
  const unlinked = putRecord(s, 'connections', { ...s.connections.x1!, toNodeId: null, version: 1 })
  expect(choicesOf(unlinked, 'a').map((c) => c.id)).toEqual(before)
})

// Protects: plan Review Focus 4: one choice per target, but a choice never clashes with itself.
test('hasChoiceTo finds a duplicate target but not the choice itself', () => {
  const s = state()
  expect(hasChoiceTo(s, 'a', 'b')).toBe(true)
  expect(hasChoiceTo(s, 'a', 'b', 'late')).toBe(false)
  expect(hasChoiceTo(s, 'b', 'a')).toBe(false)
  expect(hasChoiceTo(s, 'a', 'a')).toBe(false)
})

// Protects: editor cards design 1: a new choice starts at version 0 with the time it was made.
test('newChoice makes an empty or linked choice at version 0', () => {
  expect(newChoice('p', 'a', null, '2026-11-18T10:00:00.000Z', () => 'id1')).toEqual({
    id: 'id1',
    projectId: 'p',
    fromNodeId: 'a',
    toNodeId: null,
    label: '',
    created: '2026-11-18T10:00:00.000Z',
    version: 0,
  })
})
