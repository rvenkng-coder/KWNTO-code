import { expect, test } from 'vitest'
import { fromSelectChanges } from './selectionChanges'

const sel = (nodeIds: string[], connectionId: string | null = null) => ({ nodeIds, connectionId })

// Protects: a click, Ctrl-click or box select on the canvas changes the selection by exactly what React Flow reports.
test('node select changes add and remove nodes', () => {
  expect(fromSelectChanges(sel([]), [{ type: 'select', id: 'a', selected: true }], [])).toEqual(sel(['a']))
  expect(fromSelectChanges(sel(['a']), [{ type: 'select', id: 'b', selected: true }, { type: 'select', id: 'a', selected: false }], [])).toEqual(sel(['b']))
  expect(fromSelectChanges(sel(['a'], null), [{ type: 'position', id: 'a' }], [])).toBeNull()
})

// Protects: a connection is selected only when no node is; selecting a node drops it.
test('a connection is selected only without nodes', () => {
  expect(fromSelectChanges(sel(['a']), [{ type: 'select', id: 'a', selected: false }], [{ type: 'select', id: 'k', selected: true }])).toEqual(sel([], 'k'))
  expect(fromSelectChanges(sel([], 'k'), [{ type: 'select', id: 'a', selected: true }], [{ type: 'select', id: 'k', selected: false }])).toEqual(sel(['a']))
  expect(fromSelectChanges(sel([], 'k'), [], [{ type: 'select', id: 'k', selected: false }])).toEqual(sel([]))
  expect(fromSelectChanges(sel(['a']), [], [{ type: 'select', id: 'k', selected: true }])).toEqual(sel(['a']))
})

// Protects: after switching chapters, a click selects only nodes of the canvas shown, not one left selected in another chapter.
test('nodes of another chapter drop out on a select change', () => {
  const shown = new Set(['b'])
  expect(fromSelectChanges(sel(['old']), [{ type: 'select', id: 'b', selected: true }], [], shown)).toEqual(sel(['b']))
})
