import { expect, test } from 'vitest'
import { chapter } from '../../../../frontend/src/features/editor/model/fixtures'
import { activeAfterClose, closeTab, EMPTY_TABS, openTab, setTabWidth, visibleTabs } from '../../../../frontend/src/features/editor/chapters/tabsView'

const four = ['a', 'b', 'c', 'd'].map((id, i) => chapter(id, { position: i + 1 }))

// Protects: closing the first of several active tabs picks its right neighbour; an unknown id keeps nothing wrong.
test('[C1] empty-one-huge: close the first active tab, and an unknown tab', () => {
  expect(activeAfterClose(four, 'a', 'a')).toBe('b')
  expect(activeAfterClose(four, 'd', 'd')).toBe('c')
  expect(activeAfterClose(four, 'zzz', 'b')).toBe('b')
  expect(activeAfterClose([], 'a', null)).toBeNull()
})

// Protects: a width on the limit stays, Infinity and negative numbers are clamped, and widths are per tab.
test('[C2] two-bad-items: limits, infinity and two tabs at once', () => {
  const v = setTabWidth(setTabWidth(EMPTY_TABS, 'a', Number.POSITIVE_INFINITY), 'b', -50)
  expect(v.widths).toEqual({ a: 320, b: 80 })
  expect(setTabWidth(EMPTY_TABS, 'a', 80).widths.a).toBe(80)
  expect(setTabWidth(EMPTY_TABS, 'a', 320).widths.a).toBe(320)
})

// Protects: closing the same tab twice and opening one never closed are harmless; trashed stays hidden when reopened.
test('[C3] helper-hides-bug: repeated close, open of an open tab, trashed chapter', () => {
  const twice = closeTab(closeTab(EMPTY_TABS, 'b'), 'b')
  expect(visibleTabs(four, twice).map((c) => c.id)).toEqual(['a', 'c', 'd'])
  expect(visibleTabs(four, openTab(EMPTY_TABS, 'b')).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  const trashed = [...four.slice(0, 3), chapter('d', { position: 4, deleted: true })]
  expect(visibleTabs(trashed, openTab(closeTab(EMPTY_TABS, 'd'), 'd')).map((c) => c.id)).toEqual(['a', 'b', 'c'])
})
