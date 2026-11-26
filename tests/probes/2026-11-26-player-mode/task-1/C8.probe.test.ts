import { expect, test } from 'vitest'
import { screenOf, startSession } from '../../../../frontend/src/features/player/session'
import { go, pnode, story } from './helpers'

const isEnd = (nodes: ReturnType<typeof pnode>[]) => {
  const st = story(nodes)
  return screenOf(st, startSession(st)!).isEnd
}

// Protects: a hundred unlinked choices are still an end; one linked choice at the end of them is not.
test('[C8] second-bad-item: a hundred empty choices, then one linked', () => {
  const empties = Array.from({ length: 100 }, (_, i) => go(`e${i}`, null))
  expect(isEnd([pnode('a', 'c1', empties)])).toBe(true)
  expect(isEnd([pnode('a', 'c1', [...empties, go('ok', 'b')]), pnode('b', 'c1')])).toBe(false)
})

// Protects: the linked choice may come first or last; the order of choices does not decide the end.
test('[C8] relative-of-fixed-case: linked first, empty last', () => {
  expect(isEnd([pnode('a', 'c1', [go('ok', 'b'), go('e', null)]), pnode('b', 'c1')])).toBe(false)
  expect(isEnd([pnode('a', 'c1', [go('e', null), go('ok', 'b')]), pnode('b', 'c1')])).toBe(false)
})

// Protects: a choice to the node itself is a linked choice, so such a node is not an end.
test('[C8] empty-one-huge: only a self link', () => {
  expect(isEnd([pnode('a', 'c1', [go('k', 'a')])])).toBe(false)
  expect(isEnd([pnode('a', 'c1')])).toBe(true)
})
