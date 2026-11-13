import { describe, expect, test } from 'vitest'
import { coverageProblems, layersNeeded } from './coverage.ts'
import type { CaseRow, Layer, TestPlan } from './test-plan.ts'

// Coverage turns a Test plan's "path :: title" references into problems when the test is not there.
function row(id: string, layer: Layer, test: string): CaseRow {
  return { id, behaviour: 'b', layer, input: 'i', expected: 'e', test }
}
function plan(cases: CaseRow[], flow = 'none'): TestPlan {
  return { cases, probeFolder: null, breaks: [], flow, evidence: 'e' }
}
const FILE = [
  "import { describe, test, it } from 'vitest'",
  "describe('group', () => {",
  "  test('empty input', () => {})",
  '  it(`two items`, () => {})',
  "  test.each([[1], [2]])('each case %i', () => {})",
  '})',
  "// test('only in a comment', () => {})",
  "const note = 'loose string'",
].join('\n')
const files: Record<string, string> = { 'scripts/x.test.ts': FILE }
const read = (path: string): string | null => files[path] ?? null

describe('coverageProblems', () => {
  // Protects: a case whose named test exists produces no problem (the passing path).
  test('a case whose test title exists in the named file is covered', () => {
    const cases = [row('C1', 'unit', 'scripts/x.test.ts :: empty input'), row('C2', 'unit', 'scripts/x.test.ts :: two items'), row('C3', 'unit', 'scripts/x.test.ts :: each case %i')]
    expect(coverageProblems(plan(cases), read)).toEqual([])
  })

  // Protects: a reference to a file that does not exist is a problem naming the row, never skipped.
  test('a case whose file does not exist is reported with its row id', () => {
    const problems = coverageProblems(plan([row('C7', 'unit', 'scripts/missing.test.ts :: empty input')]), read)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('C7')
    expect(problems[0]).toContain('scripts/missing.test.ts')
  })

  // Protects: a misspelled or renamed test title is caught.
  test('a case whose title is not in the file is reported', () => {
    const problems = coverageProblems(plan([row('C2', 'unit', 'scripts/x.test.ts :: empty inputs')]), read)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('C2')
    expect(problems[0]).toContain('empty inputs')
  })

  // Protects: a title that is only in a comment or a loose string is not a test, so it does not count.
  test('a title found only in a comment is reported (the check looks for it as a test name: after test(, it(, test.each( or in a string argument)', () => {
    const cases = [row('C4', 'unit', 'scripts/x.test.ts :: only in a comment'), row('C5', 'unit', 'scripts/x.test.ts :: loose string')]
    const problems = coverageProblems(plan(cases), read)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('C4')
    expect(problems[1]).toContain('C5')
  })

  // Protects: one test may cover several rows; that is allowed, not a duplicate error.
  test('two cases may point at the same test', () => {
    const cases = [row('C1', 'unit', 'scripts/x.test.ts :: empty input'), row('C2', 'unit', 'scripts/x.test.ts :: empty input')]
    expect(coverageProblems(plan(cases), read)).toEqual([])
  })

  // Protects: a manual case is evidence by hand, so the task must describe the Flow to follow.
  test('a manual case needs a Flow that is not none', () => {
    const cases = [row('M1', 'manual', '')]
    const problems = coverageProblems(plan(cases, 'none'), read)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('M1')
    expect(coverageProblems(plan(cases, '`none`'), read)).toHaveLength(1)
    expect(coverageProblems(plan(cases, 'Open the map and drag a node.'), read)).toEqual([])
  })

  // Protects: fail closed; an empty case list is not "everything covered".
  test('an empty case list is not covered silently (it is already a plan problem; coverageProblems returns a problem too)', () => {
    const problems = coverageProblems(plan([]), read)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('no cases')
  })

  // Protects: a file that does not parse cannot be searched reliably, so it is a problem, not a match.
  test('a test file that does not parse is reported', () => {
    const broken: Record<string, string> = { 'scripts/b.test.ts': "test('empty input', () => {" }
    const problems = coverageProblems(plan([row('C1', 'unit', 'scripts/b.test.ts :: empty input')]), (path) => broken[path] ?? null)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('C1')
  })

  // Protects: a reference that leaves the repository (absolute, ..) or reads as an option is refused, not read.
  test('a test path outside the repository is reported without reading it', () => {
    const asked: string[] = []
    const spy = (path: string): string | null => { asked.push(path); return FILE }
    const cases = [row('C1', 'unit', '../x.test.ts :: empty input'), row('C2', 'unit', '/etc/x.test.ts :: empty input'), row('C3', 'unit', '-x.test.ts :: empty input')]
    expect(coverageProblems(plan(cases), spy)).toHaveLength(3)
    expect(asked).toEqual([])
  })
})

describe('layersNeeded', () => {
  // Protects: the layers step runs exactly the layers the plan names; manual is never a test layer.
  test('layersNeeded ignores manual and returns the set', () => {
    const cases = [row('C1', 'unit', 'a :: b'), row('C2', 'rules', 'a :: b'), row('C3', 'rules', 'a :: b'), row('M1', 'manual', '')]
    expect(layersNeeded(plan(cases))).toEqual(new Set(['unit', 'rules']))
    expect(layersNeeded(plan([]))).toEqual(new Set())
  })
})
