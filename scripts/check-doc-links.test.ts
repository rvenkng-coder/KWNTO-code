import { expect, test } from 'vitest'
import { findBrokenLinks } from './check-doc-links.ts'

// Protects design 8b.7: markdown links in the docs must resolve.
const exists = (p: string) => ['/r/docs/a.md', '/r/docs/my file.md'].includes(p)

test('existing relative link passes, missing one is reported', () => {
  expect(findBrokenLinks('[a](a.md) [b](b.md)', '/r/docs', exists)).toEqual(['b.md'])
})

test('anchors are ignored when checking the file', () => {
  expect(findBrokenLinks('[a](a.md#part) [top](#here)', '/r/docs', exists)).toEqual([])
})

test('external and mail links are skipped', () => {
  expect(findBrokenLinks('[x](https://example.com) [m](mailto:a@example.com)', '/r/docs', exists)).toEqual([])
})

test('encoded spaces are decoded', () => {
  expect(findBrokenLinks('[f](my%20file.md)', '/r/docs', exists)).toEqual([])
})

test('links inside fenced code blocks are ignored', () => {
  expect(findBrokenLinks('```\n[b](b.md)\n```', '/r/docs', exists)).toEqual([])
})
