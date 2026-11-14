// Runs a task's deliberate breaks (docs/developer/test-plan-format.md, "Running the breaks").
// node scripts/run-breaks.ts [--cwd <dir>] <task.md>
// Each break is applied to its file, the named unit tests run, and the exact original bytes are written
// back: in a finally, and on SIGINT or SIGTERM while a break is applied.
import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type BreakDeps, type BreakResult, runBreaks } from './lib/breaks.ts'
import { type BreakRow, parseTestPlan, type TestPlan } from './lib/test-plan.ts'
import { isMain } from './lib/is-main.ts'
import { spawnVitest } from './lib/vitest-bin.ts'

const USAGE = 'usage: node scripts/run-breaks.ts [--cwd <dir>] <task.md>'

// What a signal handler needs: the file a break is applied to (with its original text) and the Vitest run.
export interface InFlight { path: string | null; original: string; child: ChildProcess | null; output: string }

export function parseArgs(argv: string[]): { cwd: string; task: string } | null {
  const rest = [...argv]
  let cwd = process.cwd()
  const at = rest.indexOf('--cwd')
  if (at !== -1) {
    if (at + 1 >= rest.length) return null
    cwd = resolve(rest[at + 1])
    rest.splice(at, 2)
  }
  if (rest.length !== 1 || rest[0].startsWith('-')) return null
  return { cwd, task: rest[0] }
}

// Files are read and written as latin1, one character per byte, so any file (CRLF, a BOM, bytes that are
// not valid UTF-8) is restored byte for byte. Find and Replace are turned into the same form.
const asBytes = (text: string): string => Buffer.from(text, 'utf8').toString('latin1')
const toFileForm = (row: BreakRow): BreakRow => ({ ...row, find: asBytes(row.find), replace: asBytes(row.replace) })

const realOrSame = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

// The test files Vitest actually ran, from its JSON report. No readable report means we cannot tell: an error.
function filesThatRan(reportPath: string): Set<string> {
  let results: unknown
  try {
    results = (JSON.parse(readFileSync(reportPath, 'utf8')) as { testResults?: unknown }).testResults
  } catch {
    throw new Error('vitest wrote no test report, so it cannot be told which tests ran')
  }
  if (!Array.isArray(results)) throw new Error('the vitest test report has no testResults')
  const names = results.map((result: { name?: unknown }) => (typeof result.name === 'string' ? realOrSame(result.name) : ''))
  return new Set(names)
}

// Fails closed: a test file that never ran (misspelled, or outside the `unit` project) makes Vitest exit 1
// with "No test files found", which would otherwise pass for a caught break.
async function runVitest(cwd: string, paths: string[], state: InFlight): Promise<boolean> {
  const missing = paths.filter((path) => path.startsWith('-') || !existsSync(join(cwd, path)))
  if (missing.length > 0) throw new Error(`named test file not found: ${missing.join(', ')}`)
  const reportDir = mkdtempSync(join(tmpdir(), 'run-breaks-'))
  const reportPath = join(reportDir, 'report.json')
  try {
    const args = ['run', '--project', 'unit', '--reporter=default', '--reporter=json', `--outputFile.json=${reportPath}`, ...paths]
    const code = await spawnVitest(cwd, args, state) // output kept in state for the baseline message
    const ran = filesThatRan(reportPath)
    const notRun = paths.filter((path) => !ran.has(realOrSame(join(cwd, path))))
    if (notRun.length > 0) throw new Error(`named test file did not run in the unit project: ${notRun.join(', ')} (Breaks may name only unit tests)`)
    return code === 0
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}

export function makeDeps(cwd: string, state: InFlight): BreakDeps {
  const originals = new Map<string, string>()
  return {
    read(path) {
      const text = readFileSync(join(cwd, path), 'latin1')
      originals.set(path, text)
      return text
    },
    write(path, content) {
      const original = originals.get(path)
      if (original === undefined) throw new Error(`refusing to write ${path}: it was never read`)
      const restoring = content === original
      // Marked in flight before the broken text lands, cleared only after the original is back.
      if (!restoring) Object.assign(state, { path, original })
      writeFileSync(join(cwd, path), content, 'latin1')
      if (restoring) state.path = null
    },
    runTests: (paths) => runVitest(cwd, paths, state),
  }
}

export function installSignalHandlers(cwd: string, state: InFlight): void {
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
    process.on(signal, () => {
      if (state.path !== null) {
        writeFileSync(join(cwd, state.path), state.original, 'latin1')
        console.log(`run-breaks: ${signal}; restored ${state.path}`)
        state.path = null
      }
      state.child?.kill('SIGTERM')
      process.exit(code)
    })
  }
}

export function formatResult(result: BreakResult, row: BreakRow | undefined): string {
  if (result.status === 'caught') return `${result.id} caught`
  if (result.status === 'invalid') return `${result.id} invalid: ${result.detail}`
  // Printed from the plan's own row: the detail holds the byte form of Find and Replace.
  const change = row ? `${row.file}: ${row.find} -> ${row.replace}` : result.detail
  return `${result.id} SURVIVED: the tests did not notice ${change}`
}

function noBreaks(plan: TestPlan): number {
  const unitIds = plan.cases.filter((row) => row.layer === 'unit').map((row) => row.id)
  if (unitIds.length > 0) {
    console.log(`run-breaks: the task has unit cases (${unitIds.join(', ')}) but lists no breaks`)
    return 1
  }
  console.log('run-breaks: no breaks listed')
  return 0
}

async function runPlan(plan: TestPlan, cwd: string): Promise<number> {
  const state: InFlight = { path: null, original: '', child: null, output: '' }
  installSignalHandlers(cwd, state)
  const outcome = await runBreaks(plan.breaks.map(toFileForm), makeDeps(cwd, state))
  if (!outcome.baselinePassed) {
    console.log(`${state.output}\nrun-breaks: the named tests fail before any break (baseline); fix them first`)
    return 1
  }
  for (const result of outcome.results) console.log(formatResult(result, plan.breaks.find((row) => row.id === result.id)))
  const failed = outcome.results.filter((result) => result.status !== 'caught').length
  console.log(failed === 0 ? `run-breaks: ${outcome.results.length} caught` : `run-breaks: ${failed} of ${outcome.results.length} breaks not caught`)
  return failed === 0 ? 0 : 1
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args === null) { console.log(USAGE); return 1 }
  let markdown: string
  try {
    markdown = readFileSync(args.task, 'utf8')
  } catch {
    console.log(`run-breaks: cannot read ${args.task}`)
    return 1
  }
  const { plan, problems } = parseTestPlan(markdown)
  if (plan === null || problems.length > 0) {
    console.log([...problems, 'run-breaks: fix the Test plan first (npm run check:plan)'].join('\n'))
    return 1
  }
  if (plan.breaks.length === 0) return noBreaks(plan)
  try {
    return await runPlan(plan, args.cwd)
  } catch (error) {
    console.log(`run-breaks: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (isMain(import.meta.filename)) process.exit(await main(process.argv.slice(2)))
