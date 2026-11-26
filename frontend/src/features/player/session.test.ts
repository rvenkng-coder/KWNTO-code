import { expect, test } from 'vitest'
import { back, choose, historyOf, screenOf, startSession, type Session } from './session'
import type { PlayChoice, PlayNode, Story } from './story'

function pnode(id: string, chapterId: string, choices: PlayChoice[] = [], title = id): PlayNode {
  return { id, title, chapterId, chapterTitle: chapterId === 'c1' ? 'One' : 'Two', lines: [], media: [], choices }
}
const go = (id: string, targetId: string | null, label = id): PlayChoice => ({ id, label, targetId })
function story(nodes: PlayNode[], startId: string | null = nodes[0]?.id ?? null): Story {
  return { projectName: 'Story', startId, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}
function play(st: Story, ...choiceIds: string[]): Session {
  let session = startSession(st)
  if (session === null) throw new Error('no start')
  for (const id of choiceIds) {
    const next = choose(st, session, id)
    if (next === null) throw new Error(`cannot choose ${id}`)
    session = next
  }
  return session
}
const THREE = story([
  pnode('n1', 'c1', [go('k1', 'n2')]),
  pnode('n2', 'c1', [go('k2', 'n3')]),
  pnode('n3', 'c2'),
])

// Protects Review Focus 1: a story with no start, or a start that is not in the story, has nothing to play.
test('a session starts only at a real start node', () => {
  expect(startSession(story([pnode('n1', 'c1')], null))).toBeNull()
  expect(startSession(story([pnode('n1', 'c1')], 'x'))).toBeNull()
  expect(startSession(story([pnode('n1', 'c1')], 'n1'))).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }] })
})

// Protects Review Focus 2: an empty choice, one to a node not in the story and an unknown id do not move
// anything, and a session is never changed in place.
test('an empty or unknown choice returns null and changes nothing', () => {
  const st = story([pnode('n1', 'c1', [go('k1', 'n2'), go('k2', null), go('k3', 'ghost')]), pnode('n2', 'c1')])
  const start = startSession(st)!
  expect(choose(st, start, 'k1')).toEqual({ steps: [{ nodeId: 'n1', viaChoiceId: null }, { nodeId: 'n2', viaChoiceId: 'k1' }] })
  expect(choose(st, start, 'k2')).toBeNull()
  expect(choose(st, start, 'k3')).toBeNull()
  expect(choose(st, start, 'nope')).toBeNull()
  expect(start.steps).toHaveLength(1)
})

// Protects design 6.4: the chapter name shows at the start and whenever it changes, and is worked out again after Back.
test('the chapter name shows when it changes', () => {
  const session = play(THREE, 'k1', 'k2')
  const shown = session.steps.map((_, i) => screenOf(THREE, { steps: session.steps.slice(0, i + 1) }).showChapter)
  expect(shown).toEqual([true, false, true])
  const earlier = screenOf(THREE, back(session))
  expect(earlier.node.id).toBe('n2')
  expect(earlier.showChapter).toBe(false)
})

// Protects Review Focus 4: a choice to the same node and a loop between two nodes are just more steps.
test('a loop is just more steps', () => {
  const self = story([pnode('n1', 'c1', [go('k1', 'n1')])])
  const selfPath = play(self, 'k1', 'k1', 'k1')
  expect(selfPath.steps.map((s) => s.nodeId)).toEqual(['n1', 'n1', 'n1', 'n1'])
  expect(selfPath.steps.slice(1).every((s) => s.viaChoiceId === 'k1')).toBe(true)

  const pair = story([pnode('n1', 'c1', [go('a', 'n2')]), pnode('n2', 'c1', [go('b', 'n1')])])
  const path = play(pair, 'a', 'b', 'a', 'b', 'a', 'b')
  expect(path.steps.map((s) => s.nodeId)).toEqual(['n1', 'n2', 'n1', 'n2', 'n1', 'n2', 'n1'])
  expect(path.steps.slice(1).every((_, i) => !screenOf(pair, { steps: path.steps.slice(0, i + 2) }).showChapter)).toBe(true)
})

// Protects Review Focus 4: Back removes exactly one step, never goes below the start, leaves the old session as it was.
test('back removes one step and never goes below the start', () => {
  const full = play(THREE, 'k1', 'k2')
  const one = back(full)
  expect(one.steps).toEqual(full.steps.slice(0, 2))
  expect(full.steps).toHaveLength(3)
  const start = back(one)
  expect(start.steps).toEqual(full.steps.slice(0, 1))
  expect(back(start).steps).toHaveLength(1)
  expect(screenOf(THREE, start).canGoBack).toBe(false)
  expect(screenOf(THREE, one).canGoBack).toBe(true)
  expect(startSession(THREE)?.steps).toHaveLength(1)
})

// Protects D5: a node is an end when no choice has a target, even if it has written, unlinked choices.
test('the end is a node with no linked choice', () => {
  const st = story([
    pnode('a', 'c1'),
    pnode('b', 'c1', [go('k1', null)]),
    pnode('c', 'c1', [go('k2', 'a'), go('k3', null)]),
  ])
  const end = (id: string) => screenOf(st, { steps: [{ nodeId: id, viaChoiceId: null }] }).isEnd
  expect([end('a'), end('b'), end('c')]).toEqual([true, true, false])
})

// Protects D6: the history reads as the path, with the choice taken to reach each node.
test('the history lists the path with the choices taken', () => {
  const st = story([
    pnode('n1', 'c1', [go('k1', 'n2', 'Open it')], 'Gate'),
    pnode('n2', 'c1', [go('k5', 'n3', 'Knock')], 'Door'),
    pnode('n3', 'c2', [], 'Garden'),
  ])
  const session = play(st, 'k1', 'k5')
  const history = historyOf(st, session)
  expect(history.map((h) => h.text)).toEqual(['Gate', 'Open it → Door', 'Knock → Garden'])
  expect(history.map((h) => h.chapterTitle)).toEqual(['One', 'One', 'Two'])
  expect(history.map((h) => h.current)).toEqual([false, false, true])
  const earlier = historyOf(st, back(session))
  expect(earlier).toHaveLength(2)
  expect(earlier.map((h) => h.current)).toEqual([false, true])
})
