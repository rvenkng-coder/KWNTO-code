import { expect, test } from 'vitest'
import { chapter, content, node } from './fixtures'
import { fromContent } from './state'
import { normalizeTitle, searchNodes, SEARCH_LIMIT } from './search'

// Protects: title normalization strips accents, folds case and collapses whitespace.
test('normalizeTitle strips accents, lower-cases and trims', () => {
  expect(normalizeTitle('Café Scene')).toBe('cafe scene')
  expect(normalizeTitle('  THE  DOOR  ')).toBe('the door')
  expect(normalizeTitle('SCÈNE')).toBe('scene')
})

// Protects: search ignores case, accents and extra spaces.
test('search ignores case, accents and extra spaces', () => {
  const s = fromContent(content({
    chapters: [chapter('c1')],
    nodes: [node('a', { title: 'Café Scene' }), node('b', { title: 'THE  door' })],
  }))
  expect(searchNodes(s, 'cafe').map((h) => h.title)).toEqual(['Café Scene'])
  expect(searchNodes(s, ' the door ').map((h) => h.title)).toEqual(['THE  door'])
  expect(searchNodes(s, 'SCÈNE').map((h) => h.title)).toEqual(['Café Scene'])
})

// Protects: titles that start with the query come first, then contains matches.
test('titles that start with the query come first', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2')],
    nodes: [node('a', { title: 'The Door', chapterId: 'c1' }), node('b', { title: 'Door', chapterId: 'c2' }), node('c', { title: 'Doorway', chapterId: 'c1' })],
  }))
  const hits = searchNodes(s, 'door')
  expect(hits.map((h) => h.title)).toEqual(['Doorway', 'Door', 'The Door'])
})

// Protects: trashed nodes, nodes in trashed chapters, untitled nodes and blank queries return nothing.
test('trashed and untitled nodes and blank queries find nothing', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2', { deleted: true })],
    nodes: [node('a', { title: 'Found' }), node('b', { title: 'Trash', deleted: true }), node('c', { title: 'InTrash', chapterId: 'c2' }), node('d', { title: '' })],
  }))
  expect(searchNodes(s, 'found').map((h) => h.title)).toEqual(['Found'])
  expect(searchNodes(s, 'trash')).toEqual([])
  expect(searchNodes(s, '  ')).toEqual([])
})

// Protects: results are limited to SEARCH_LIMIT and excludeChapterId filters out a chapter.
test('results are limited and a chapter can be left out', () => {
  const s = fromContent(content({
    chapters: [chapter('c1'), chapter('c2')],
    nodes: Array.from({ length: 30 }, (_, i) => node(`n${i}`, { title: `Node ${i}` })),
  }))
  // Patch first 20 nodes into c1, rest into c2 for deterministic chapter split
  const patched = { ...s }
  const entries = Object.entries(s.nodes) as [string, typeof s.nodes[string]][]
  patched.nodes = Object.fromEntries(
    entries.map(([id, n], idx) => [id, idx < 20 ? { ...n, chapterId: 'c1' } : { ...n, chapterId: 'c2' }])
  )
  const hitsAll = searchNodes(patched, 'node')
  expect(hitsAll.length).toBe(20)
  expect(hitsAll.length).toBe(SEARCH_LIMIT)
  const hitsExcl = searchNodes(patched, 'node', { excludeChapterId: 'c1' })
  expect(hitsExcl.length).toBe(10)
  expect(hitsExcl.every((h) => h.chapterId !== 'c1')).toBe(true)
})
