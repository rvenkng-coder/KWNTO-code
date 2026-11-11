import { expect, test } from 'vitest'
import { findBadPerfComments } from './check-perf-comments.ts'

// Protects docs/engineering.md section 1: a PERF: comment must explain What, Why and Trade-off.
test('complete block comment passes', () => {
  expect(findBadPerfComments('/* PERF: What: a. Why: b. Trade-off: c. */')).toEqual([])
})

// Protects the same rule: a comment missing a part is found, and the line says where.
test('missing part is reported by line number', () => {
  expect(findBadPerfComments('const a = 1\n// PERF: What: a. Why: b.\nconst b = 2')).toEqual([2])
})

// Protects readable multi-line comments: the three parts may sit on separate // lines.
test('consecutive line comments count as one comment', () => {
  expect(findBadPerfComments('// PERF: What: a.\n// Why: b.\n// Trade-off: c.')).toEqual([])
})

// Protects against one good comment hiding a bad one elsewhere in the file.
test('each PERF comment is judged on its own', () => {
  expect(findBadPerfComments('// PERF: What: a. Why: b. Trade-off: c.\nx()\n// PERF: fast')).toEqual([3])
})
