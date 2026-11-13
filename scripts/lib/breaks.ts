// Deliberate breaks (design 6.3, docs/developer/test-plan-format.md): apply a one-line change to the code,
// run the tests the plan names for it, and require them to fail. The file is always put back.
import { isBreakablePath } from './test-plan.ts'
import type { BreakRow } from './test-plan.ts'

export { isBreakablePath } from './test-plan.ts'

export interface BreakDeps {
  read(path: string): string
  write(path: string, content: string): void
  runTests(testPaths: string[]): Promise<boolean> // true = the tests passed
}
export interface BreakResult { id: string; status: 'caught' | 'survived' | 'invalid'; detail: string }

// Literal occurrences of `find`, overlapping ones included (in "aaa", "aa" occurs twice).
function countOccurrences(source: string, find: string): number {
  let count = 0
  for (let at = source.indexOf(find); at !== -1; at = source.indexOf(find, at + 1)) count++
  return count
}

// Plain text in, plain text out: no regular expression and no `$&`-style replacement patterns.
export function applyBreak(source: string, find: string, replace: string): string | null {
  if (find === '' || countOccurrences(source, find) !== 1) return null
  const at = source.indexOf(find)
  return source.slice(0, at) + replace + source.slice(at + find.length)
}

const invalid = (id: string, detail: string): BreakResult => ({ id, status: 'invalid', detail })

// Reads the file and applies the break. Returns the original and broken text, or why the break cannot run.
function prepare(row: BreakRow, deps: BreakDeps): { original: string; broken: string } | BreakResult {
  if (!isBreakablePath(row.file)) return invalid(row.id, `${row.file} is not breakable (only frontend/src/, scripts/ or backend/pb_hooks/lib/, never a test file)`)
  if (row.tests.length === 0) return invalid(row.id, 'no tests are named for this break')
  if (row.find === row.replace) return invalid(row.id, 'Replace is the same as Find')
  let original: string
  try {
    original = deps.read(row.file)
  } catch {
    return invalid(row.id, `cannot read ${row.file}`)
  }
  const broken = applyBreak(original, row.find, row.replace)
  if (broken === null) return invalid(row.id, `Find must occur exactly once in ${row.file}; it occurs ${countOccurrences(original, row.find)} times`)
  return { original, broken }
}

async function runOne(row: BreakRow, deps: BreakDeps): Promise<BreakResult> {
  const prepared = prepare(row, deps)
  if ('status' in prepared) return prepared
  let passed: boolean
  try {
    deps.write(row.file, prepared.broken)
    passed = await deps.runTests(row.tests)
  } finally {
    // The exact text that was read, whatever happened above: a left-over break is a broken file for the developer.
    deps.write(row.file, prepared.original)
  }
  if (passed) return { id: row.id, status: 'survived', detail: `the tests did not notice ${row.file}: ${row.find} -> ${row.replace}` }
  return { id: row.id, status: 'caught', detail: '' }
}

export async function runBreaks(breaks: BreakRow[], deps: BreakDeps): Promise<{ baselinePassed: boolean; results: BreakResult[] }> {
  // An empty test list would make Vitest run every test, so no breaks means nothing to run.
  if (breaks.length === 0) return { baselinePassed: true, results: [] }
  const union = [...new Set(breaks.flatMap((row) => row.tests))]
  if (!(await deps.runTests(union))) return { baselinePassed: false, results: [] }
  const results: BreakResult[] = []
  for (const row of breaks) results.push(await runOne(row, deps))
  return { baselinePassed: true, results }
}
