import { expect, test } from 'vitest'
import { chapter, content, node } from '../../../../frontend/src/features/editor/model/fixtures'
import { normalizeTitle, SEARCH_LIMIT, searchNodes } from '../../../../frontend/src/features/editor/model/search'
import { fromContent } from '../../../../frontend/src/features/editor/model/state'

const titles = (hits: { title: string }[]) => hits.map((h) => h.title)

// Protects: tabs, newlines and several accents on one letter are folded the same way as spaces and single accents.
test('[C1] case-and-whitespace: tabs, newlines and stacked accents', () => {
  expect(normalizeTitle('  Ünïcödé\t\n  Títle  ')).toBe('unicode title')
  expect(normalizeTitle('')).toBe('')
  const s = fromContent(content({ nodes: [node('a', { title: 'Naïve\tPlan' })] }))
  expect(titles(searchNodes(s, 'NAIVE p'))).toEqual(['Naïve\tPlan'])
})

// Protects: a hit carries the original title and its chapter's title, not the normalized text.
test('[C1] relative-of-fixed-case: the hit has the shown title and chapter', () => {
  const s = fromContent(content({ chapters: [chapter('c1', { title: 'Opening' })], nodes: [node('a', { title: 'Café' })] }))
  expect(searchNodes(s, 'cafe')).toEqual([{ nodeId: 'a', chapterId: 'c1', chapterTitle: 'Opening', title: 'Café' }])
})

// Protects: chapter order is the chapter position, not the id; ties fall back to title then id.
test('[C2] relative-of-fixed-case: chapter position, then title, then id', () => {
  const s = fromContent(content({
    chapters: [chapter('c1', { position: 2 }), chapter('c2', { position: 1 })],
    nodes: [node('n1', { chapterId: 'c1', title: 'Door' }), node('n2', { chapterId: 'c2', title: 'Door B' }),
      node('n4', { chapterId: 'c2', title: 'Door' }), node('n3', { chapterId: 'c2', title: 'Door' })],
  }))
  expect(searchNodes(s, 'door').map((h) => h.nodeId)).toEqual(['n3', 'n4', 'n2', 'n1'])
})

// Protects: a title matching only after accents are removed still lands in the starts-with group.
test('[C2] case-and-whitespace: accented start counts as starting with the query', () => {
  const s = fromContent(content({ nodes: [node('a', { title: 'The Éclair' }), node('b', { title: 'Éclair' })] }))
  expect(titles(searchNodes(s, 'eclair'))).toEqual(['Éclair', 'The Éclair'])
})

// Protects: a chapter that was trashed and a whitespace-only query find nothing; the start of a live title still does.
test('[C3] stale-after-change: trashed chapter, tab-only query', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('a', { title: 'Gate' }), node('b', { chapterId: 'c2', title: 'Gate' }), node('c', { title: '' })],
  }))
  expect(searchNodes(s, 'gate').map((h) => h.nodeId)).toEqual(['a'])
  expect(searchNodes(s, '\t \n')).toEqual([])
})

// Protects: the limit option, the default of 20 and the exclusion work together.
test('[C4] empty-one-huge: explicit limit, exactly the default, exclusion of the only chapter', () => {
  const nodes = Array.from({ length: 25 }, (_, i) => node(`n${String(i).padStart(2, '0')}`, { title: `Room ${i}` }))
  const s = fromContent(content({ nodes }))
  expect(searchNodes(s, 'room', { limit: 5 })).toHaveLength(5)
  expect(searchNodes(s, 'room')).toHaveLength(SEARCH_LIMIT)
  expect(searchNodes(s, 'room', { excludeChapterId: 'c1' })).toEqual([])
  expect(searchNodes(fromContent(content()), 'room')).toEqual([])
})
