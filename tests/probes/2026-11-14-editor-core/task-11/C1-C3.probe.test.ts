import { expect, test } from 'vitest'
import { line } from '../../../../frontend/src/features/editor/model/fixtures'
import { characterSuggestions, SUGGESTION_LIMIT } from '../../../../frontend/src/features/editor/model/characters'

const by = (names: string[]) => names.map((character, i) => line(`l${i}`, { character }))

// Protects: names are trimmed before grouping, and the first trimmed spelling seen is the one shown.
test('[C1] case-and-whitespace: padded and differently cased spellings are one name', () => {
  expect(characterSuggestions(by(['  Anna ', 'ANNA', 'anna', 'Ben']), '')).toEqual(['Anna', 'Ben'])
})

// Protects: the use count covers every spelling, so a name used often in mixed case beats one used twice.
test('[C1] relative-of-fixed-case: counts add up across spellings', () => {
  expect(characterSuggestions(by(['Ben', 'Ben', 'cara', 'CARA', 'Cara']), '')).toEqual(['cara', 'Ben'])
})

// Protects: no lines, only blank names, and a large script all work.
test('[C1] empty-one-huge: no lines, only blank names, many lines', () => {
  expect(characterSuggestions([], '')).toEqual([])
  expect(characterSuggestions(by(['', '   ', '\t']), '')).toEqual([])
  const many = by(Array.from({ length: 5000 }, (_, i) => (i % 3 === 0 ? 'ZOE' : 'YURI')))
  expect(characterSuggestions(many, '')).toEqual(['YURI', 'ZOE'])
})

// Protects: the typed text is compared ignoring case and surrounding spaces, also for non-ASCII letters.
test('[C2] case-and-whitespace: typed text with spaces, capitals and accents', () => {
  const lines = by(['Élise', 'Anna', 'Annabel'])
  expect(characterSuggestions(lines, '  AN ')).toEqual(['Anna', 'Annabel'])
  expect(characterSuggestions(lines, 'é')).toEqual(['Élise'])
  expect(characterSuggestions(lines, ' anna ')).toEqual(['Annabel'])
})

// Protects: a name is offered only when it starts with the typed text, not when it merely contains it.
test('[C2] relative-of-fixed-case: contains is not a prefix match', () => {
  expect(characterSuggestions(by(['Hanna', 'Anna']), 'nn')).toEqual([])
  expect(characterSuggestions(by(['Hanna', 'Anna']), 'h')).toEqual(['Hanna'])
})

// Protects: use count wins over the alphabet, and an explicit limit is honoured.
test('[C3] relative-of-fixed-case: count before alphabet, explicit limit', () => {
  expect(characterSuggestions(by(['ZED', 'ZED', 'AMY']), '')).toEqual(['ZED', 'AMY'])
  const twelve = by(['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'])
  expect(characterSuggestions(twelve, '', 3)).toEqual(['A', 'B', 'C'])
  expect(SUGGESTION_LIMIT).toBe(8)
  expect(characterSuggestions(twelve, '')).toHaveLength(8)
})
