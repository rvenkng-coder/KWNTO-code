// Reads Vitest's JSON report for a probe run and keeps only what may be shown: the row and the kind
// from each failing title. A message, a stack, a value or a path is never copied out of the report.

export interface ProbeSummary {
  total: number
  passed: number
  failed: { row: string; kind: string }[]
  unnamedFailures: number
  loadErrors: number
}

// "[C3] second-bad-item: two items" -> { row: "C3", kind: "second-bad-item" }. The characters allowed in
// row and kind are the only ones that can ever be printed from a title.
const TITLE = /^\[([A-Za-z0-9][A-Za-z0-9._-]*)\] ([a-z0-9]+(?:-[a-z0-9]+)*): /

export function parseProbeTitle(title: string): { row: string; kind: string } | null {
  const match = TITLE.exec(title)
  return match ? { row: match[1], kind: match[2] } : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const malformed = (): Error => new Error('the vitest report is malformed')

function addTest(summary: ProbeSummary, test: unknown): void {
  summary.total += 1
  if (isRecord(test) && test.status === 'passed') {
    summary.passed += 1
    return
  }
  const named = isRecord(test) && typeof test.title === 'string' ? parseProbeTitle(test.title) : null
  if (named) summary.failed.push(named)
  else summary.unnamedFailures += 1
}

function addFile(summary: ProbeSummary, file: unknown): void {
  if (!isRecord(file)) throw malformed()
  const tests = file.assertionResults
  if (Array.isArray(tests) && tests.length > 0) {
    for (const test of tests) addTest(summary, test)
  } else if (file.status !== 'passed') {
    // A file with no tests that is not a pass failed to load (syntax error, bad import).
    summary.loadErrors += 1
  }
}

// Throws on anything that is not a Vitest JSON report: an unreadable report must never look like "no failures".
export function summariseProbeRun(vitestJson: unknown): ProbeSummary {
  if (!isRecord(vitestJson) || !Array.isArray(vitestJson.testResults)) throw malformed()
  const summary: ProbeSummary = { total: 0, passed: 0, failed: [], unnamedFailures: 0, loadErrors: 0 }
  for (const file of vitestJson.testResults) addFile(summary, file)
  return summary
}

export function formatProbeSummary(s: ProbeSummary): string[] {
  const lines = s.failed.map((failure) => `FAIL ${failure.row} (${failure.kind})`)
  if (s.unnamedFailures > 0) lines.push(`FAIL ${s.unnamedFailures} probe(s) without a [row] kind: title`)
  if (s.loadErrors > 0) lines.push(`FAIL ${s.loadErrors} probe file(s) could not be loaded`)
  lines.push(`probes: ${s.passed} of ${s.total} passed`)
  return lines
}
