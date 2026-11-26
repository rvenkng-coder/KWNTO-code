import { describe, expect, test } from 'vitest'
import { formatProbeSummary, parseProbeTitle, summariseProbeRun } from './probes.ts'

const SECRET = 'SECRET-INPUT-123'
const test_ = (title: string, status: string) => ({
  title,
  fullName: title,
  status,
  failureMessages: [`AssertionError: expected '${SECRET}' to be 'x'\n at /w/a.probe.test.ts:9:3`],
})
const file = (assertionResults: unknown[], status = 'failed') => ({
  name: '/w/a.probe.test.ts',
  status,
  message: `Error: ${SECRET}`,
  assertionResults,
})

describe('parseProbeTitle', () => {
  // Protects: the row and kind are read from the documented title form.
  test('parseProbeTitle reads row and kind', () => {
    expect(parseProbeTitle('[C3] second-bad-item: two items')).toEqual({ row: 'C3', kind: 'second-bad-item' })
  })

  // Protects: only a well-formed title is trusted, so free text cannot be printed as a row.
  test('a title without the form gives null', () => {
    expect(parseProbeTitle('two items')).toBeNull()
    expect(parseProbeTitle('[C3] second-bad-item two items')).toBeNull()
    expect(parseProbeTitle('')).toBeNull()
  })

  // Protects: the kind must be a catalogue-style slug.
  test('a kind with spaces or capitals gives null', () => {
    expect(parseProbeTitle('[C3] Second Bad: x')).toBeNull()
    expect(parseProbeTitle('[C3] second bad: x')).toBeNull()
    expect(parseProbeTitle('[C3] Second-bad: x')).toBeNull()
  })
})

describe('summariseProbeRun', () => {
  // Protects: counts of passed and failed probes come straight from the report.
  test('summariseProbeRun counts passed and failed from a sample JSON', () => {
    const report = {
      testResults: [file([test_('[C1] empty-input: a', 'passed'), test_('[C2] boundary: b', 'failed')])],
    }
    expect(summariseProbeRun(report)).toEqual({
      total: 2,
      passed: 1,
      failed: [{ row: 'C2', kind: 'boundary' }],
      unnamedFailures: 0,
      loadErrors: 0,
    })
  })

  // Protects: a failure that cannot be named is still counted, so it cannot hide.
  test('a failure with an unparsable title counts as unnamedFailures', () => {
    const summary = summariseProbeRun({
      testResults: [file([test_('no form', 'failed'), test_('[C1] boundary: x', 'skipped')])],
    })
    expect(summary.unnamedFailures).toBe(1)
    expect(summary.failed).toEqual([{ row: 'C1', kind: 'boundary' }])
    expect(summary.passed).toBe(0)
  })

  // Protects: a file that never loaded (syntax error) is a failure, not an empty pass.
  test('a test file that failed to load counts as loadErrors', () => {
    expect(summariseProbeRun({ testResults: [file([])] }).loadErrors).toBe(1)
  })

  // Protects: no tests at all is total 0, which the command treats as failure.
  test('an empty result is total 0', () => {
    expect(summariseProbeRun({ testResults: [] })).toEqual({
      total: 0,
      passed: 0,
      failed: [],
      unnamedFailures: 0,
      loadErrors: 0,
    })
  })

  // Protects: an unreadable report is an error, never "nothing failed".
  test('a malformed report throws', () => {
    for (const bad of [null, 'x', 5, {}, { testResults: 'x' }, { testResults: [null] }])
      expect(() => summariseProbeRun(bad)).toThrow()
  })
})

describe('formatProbeSummary', () => {
  // Protects: nothing from a failure's message, stack or input reaches the lines.
  test('formatProbeSummary output never contains the failure message, "expected", "received", "Error" or a path with a line number', () => {
    const report = {
      testResults: [file([test_('[C2] boundary: x', 'failed'), test_('free text', 'failed')]), file([])],
    }
    const text = formatProbeSummary(summariseProbeRun(report)).join('\n')
    expect(text).toContain('FAIL C2 (boundary)')
    for (const word of [SECRET, 'expected', 'received', 'Error', 'a.probe.test.ts', ':9:3', 'free text'])
      expect(text).not.toContain(word)
  })

  // Protects: the last line states the totals.
  test('the last line says N of M passed', () => {
    expect(formatProbeSummary({ total: 3, passed: 3, failed: [], unnamedFailures: 0, loadErrors: 0 })).toEqual([
      'probes: 3 of 3 passed',
    ])
  })
})
