// Does every case row of a Test plan point at a test that exists? (check:task, step "coverage")
// Titles are found with the TypeScript parser (scripts/lib/test-ast.ts), so a title that appears only in a
// comment or in a loose string is not a test, and a file that does not parse is a problem, never a match.
import { parseTestFile } from './test-ast.ts'
import type { TestPlan } from './test-plan.ts'

type TestLayer = 'unit' | 'rules' | 'e2e' | 'container'

const SEPARATOR = ' :: '

// A test path must stay inside the repository and must not read as an option.
function unsafePath(path: string): boolean {
  return (
    path === '' ||
    path.startsWith('-') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split(/[\\/]/).includes('..')
  )
}

function isNone(flow: string): boolean {
  return (
    flow
      .trim()
      .replace(/^`(.*)`$/, '$1')
      .trim()
      .toLowerCase() === 'none'
  )
}

// The problem with one "path :: title" reference, or null when the test exists.
function referenceProblem(id: string, reference: string, readFile: (path: string) => string | null): string | null {
  const at = reference.indexOf(SEPARATOR)
  if (at === -1) return `${id}: Test must read "path :: title" (found "${reference}")`
  const path = reference.slice(0, at).trim()
  const title = reference.slice(at + SEPARATOR.length).trim()
  if (unsafePath(path)) return `${id}: test path "${path}" must be relative and stay inside the repository`
  const source = readFile(path)
  if (source === null) return `${id}: test file ${path} does not exist or cannot be read`
  const parsed = parseTestFile(path, source)
  if (!parsed.ok)
    return `${id}: ${path} does not parse (${parsed.error ?? 'syntax error'}), so its tests cannot be found`
  if (!parsed.declarations.some((declaration) => declaration.title === title))
    return `${id}: no test titled "${title}" in ${path}`
  return null
}

export function coverageProblems(plan: TestPlan, readFile: (path: string) => string | null): string[] {
  if (plan.cases.length === 0) return ['the Test plan has no cases, so nothing is covered']
  const problems: string[] = []
  for (const row of plan.cases) {
    if (row.layer === 'manual') {
      if (isNone(plan.flow))
        problems.push(`${row.id}: a manual case needs a Flow section that describes what to do (Flow is "none")`)
      continue
    }
    const problem = referenceProblem(row.id, row.test, readFile)
    if (problem !== null) problems.push(problem)
  }
  return problems
}

export function layersNeeded(plan: TestPlan): Set<TestLayer> {
  const layers = new Set<TestLayer>()
  for (const row of plan.cases) if (row.layer !== 'manual') layers.add(row.layer)
  return layers
}
