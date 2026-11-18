import { expect, test } from 'vitest'
import { chapter } from '../model/fixtures'
import { activeAfterClose, closeTab, EMPTY_TABS, openTab, setTabWidth, visibleTabs } from './tabsView'

const tabs = ['a', 'b', 'c'].map((id, i) => chapter(id, { position: i + 1 }))

// Protects: closing the open tab moves to its right neighbour, else its left; closing another tab keeps the open one.
test('closing a tab picks the next active tab', () => {
  // `visible` is the strip before the close.
  expect(activeAfterClose(tabs, 'b', 'b')).toBe('c')
  expect(activeAfterClose(tabs, 'c', 'c')).toBe('b')
  expect(activeAfterClose([tabs[0]!], 'a', 'a')).toBeNull()
  expect(activeAfterClose(tabs, 'a', 'c')).toBe('c')
  expect(activeAfterClose(tabs, 'a', null)).toBeNull()
})

// Protects: a tab is never narrower than 80 or wider than 320, and nonsense falls back to the default.
test('tab widths stay between the limits', () => {
  const width = (w: number) => setTabWidth(EMPTY_TABS, 'a', w).widths.a
  expect(width(10)).toBe(80)
  expect(width(500)).toBe(320)
  expect(width(200)).toBe(200)
  expect(width(Number.NaN)).toBe(160)
})

// Protects: a trashed or closed chapter has no tab; reopening shows it in position order again.
test('trashed and closed chapters have no tab', () => {
  const all = [chapter('a', { position: 1 }), chapter('b', { position: 2, deleted: true }), chapter('c', { position: 3 })]
  const closed = closeTab(EMPTY_TABS, 'c')
  expect(visibleTabs(all, closed).map((c) => c.id)).toEqual(['a'])
  expect(visibleTabs(all, openTab(closed, 'c')).map((c) => c.id)).toEqual(['a', 'c'])
})

// Protects: the view functions return new objects and never change the one they are given.
test('closing and opening tabs does not change the view it is given', () => {
  const closed = closeTab(EMPTY_TABS, 'a')
  expect(EMPTY_TABS.closed.size).toBe(0)
  openTab(closed, 'a')
  expect(closed.closed.has('a')).toBe(true)
  setTabWidth(closed, 'a', 200)
  expect(closed.widths).toEqual({})
})
