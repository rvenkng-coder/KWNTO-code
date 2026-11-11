import { expect, test } from 'vitest'
import { findCoverageProblems } from './coverage.ts'

// Protects docs/security.md section 2: "A test fails if any collection has no tested rule",
// and deny by default: a public rule must be a recorded decision, never an accident.
const locked = { system: false, listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

test('collection without a test file is reported', () => {
  expect(findCoverageProblems([{ ...locked, name: 'nodes' }], [], [])).toEqual(['nodes: no rule test file (expected tests/rules/nodes.rules.test.ts)'])
})

test('public rule not on the allowlist is reported', () => {
  expect(findCoverageProblems([{ ...locked, name: 'nodes', listRule: '' }], ['nodes.rules.test.ts'], [])).toEqual(['nodes.listRule is public ("") and not in PUBLIC_RULES'])
})

test('allowlisted public rule and locked rules pass', () => {
  expect(findCoverageProblems([{ ...locked, name: 'users', createRule: '' }], ['users.rules.test.ts'], ['users.createRule'])).toEqual([])
})

test('system collections are skipped; view collections (no write rules) are still checked', () => {
  expect(findCoverageProblems([{ ...locked, name: '_superusers', system: true, listRule: '' }], [], [])).toEqual([])
  expect(findCoverageProblems([{ name: 'stats', system: false, listRule: '', viewRule: null }], ['stats.rules.test.ts'], [])).toEqual(['stats.listRule is public ("") and not in PUBLIC_RULES'])
})
