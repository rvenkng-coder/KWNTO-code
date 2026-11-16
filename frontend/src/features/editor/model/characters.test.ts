import { expect, test } from 'vitest'
import type { ScriptLine } from '../../../backend'
import { characterSuggestions, SUGGESTION_LIMIT } from './characters'

// Protects: C1 — names grouped case-insensitively and ordered by use count descending.
test('names are grouped ignoring case and ordered by use', () => {
  const lines: ScriptLine[] = [
    { id: 'l1', projectId: 'p1', nodeId: 'n1', character: 'ANNA', text: '', sortOrder: 1, version: 0 },
    { id: 'l2', projectId: 'p1', nodeId: 'n1', character: 'ANNA', text: '', sortOrder: 2, version: 0 },
    { id: 'l3', projectId: 'p1', nodeId: 'n1', character: 'ANNA', text: '', sortOrder: 3, version: 0 },
    { id: 'l4', projectId: 'p1', nodeId: 'n1', character: 'anna', text: '', sortOrder: 4, version: 0 },
    { id: 'l5', projectId: 'p1', nodeId: 'n1', character: 'Ben', text: '', sortOrder: 5, version: 0 },
    { id: 'l6', projectId: 'p1', nodeId: 'n1', character: 'Ben', text: '', sortOrder: 6, version: 0 },
    { id: 'l7', projectId: 'p1', nodeId: 'n1', character: '  ', text: '', sortOrder: 7, version: 0 },
  ]
  expect(characterSuggestions(lines, '')).toEqual(['ANNA', 'Ben'])
})

// Protects: C2 — prefix matching is case-insensitive, exact matches are excluded.
test('suggestions start with what was typed and leave out an exact match', () => {
  const lines: ScriptLine[] = [
    { id: 'l1', projectId: 'p1', nodeId: 'n1', character: 'ANNA', text: '', sortOrder: 1, version: 0 },
    { id: 'l2', projectId: 'p1', nodeId: 'n1', character: 'Ben', text: '', sortOrder: 2, version: 0 },
  ]

  // typed ' an' (with surrounding space) should match ANNA (trimmed to 'an')
  expect(characterSuggestions(lines, ' an')).toEqual(['ANNA'])

  // exact match 'ANNA' is left out
  expect(characterSuggestions(lines, 'ANNA')).toEqual([])

  // no name starts with 'x'
  expect(characterSuggestions(lines, 'x')).toEqual([])
})

// Protects: C3 — suggestions are capped at SUGGESTION_LIMIT (8), ties broken alphabetically.
test('at most eight suggestions, ties alphabetical', () => {
  const lines: ScriptLine[] = Array.from({ length: 12 }, (_, i) => ({
    id: `l${i}`,
    projectId: 'p1',
    nodeId: 'n1',
    character: `Name${String(i).padStart(2, '0')}`,
    text: '',
    sortOrder: i,
    version: 0,
  }))
  const result = characterSuggestions(lines, '')
  expect(result).toHaveLength(SUGGESTION_LIMIT)
  // All used once, so alphabetical order
  expect(result).toEqual(['Name00', 'Name01', 'Name02', 'Name03', 'Name04', 'Name05', 'Name06', 'Name07'])
})

// Protects: C3 — equal counts are ordered alphabetically even when the lines come in reverse order.
test('ties are alphabetical whatever order the lines come in', () => {
  const lines: ScriptLine[] = ['Cara', 'Ben', 'Anna'].map((character, i) => ({
    id: `l${i}`, projectId: 'p1', nodeId: 'n1', character, text: '', sortOrder: i, version: 0,
  }))
  expect(characterSuggestions(lines, '')).toEqual(['Anna', 'Ben', 'Cara'])
})
