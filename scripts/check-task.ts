// check:task, the self-check every task ends with (docs/developer/check-task.md).
// npm run check:task -- --task <task file> [--base <sha>] [--built-by local|strong]
// Runs every step even after a failure, so the report is complete; exit 0 only if every
// non-informational step passed. The whole run has a 10-minute budget.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { changedFiles, repoRoot, resolveBase } from './lib/changed-files.ts'
import { defaultSteps } from './lib/check-steps.ts'
import { isMain } from './lib/is-main.ts'
import { isClosing, openRun, stopAll } from './lib/run-command.ts'
import { parseTestPlan, type TestPlan } from './lib/test-plan.ts'

export { defaultSteps } from './lib/check-steps.ts'

export interface StepResult {
  name: string
  ok: boolean
  informational?: boolean
  lines: string[]
}
export interface CheckContext {
  base: string
  taskFile: string
  taskNumber: number
  builtBy: 'local' | 'strong'
  plan: TestPlan | null
  changed: string[]
  deadlineMs: number
}
export interface Step {
  name: string
  run(ctx: CheckContext): Promise<StepResult>
}

export const BUDGET_MS = 600_000
const USAGE = 'usage: npm run check:task -- --task <task file> [--base <sha>] [--built-by local|strong]'

const failed = (name: string, line: string): StepResult => ({ name, ok: false, lines: [line] })

// Resolves to the step's result, or to a failure when the deadline comes first. When the deadline wins, the run
// is closed (no command starts after it) and every process group a step started is stopped and gone (stopAll
// waits for it) before the runner moves on, so check:task never returns while a command, or a deliberate
// break, is still live.
function withDeadline(step: Step, ctx: CheckContext, waitMs: number): Promise<StepResult> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<StepResult>((done) => {
    timer = setTimeout(() => {
      void stopAll().then(() => done(failed(step.name, 'killed: time budget used')))
    }, waitMs)
  })
  return Promise.race([step.run(ctx), deadline]).finally(() => clearTimeout(timer))
}

async function runStep(step: Step, ctx: CheckContext, now: () => number): Promise<StepResult> {
  const left = ctx.deadlineMs - now()
  if (left <= 0) return failed(step.name, 'not run: time budget used')
  if (isClosing()) return failed(step.name, 'not run: check:task is stopping')
  try {
    const result = await withDeadline(step, ctx, left)
    return { ...result, name: step.name }
  } catch (error) {
    // The message only, never a stack: the report is read by a model that should learn the class, not the trace.
    return failed(step.name, `step crashed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function tag(result: StepResult): string {
  if (result.informational) return 'INFO'
  return result.ok ? 'PASS' : 'FAIL'
}

export function formatReport(results: StepResult[]): { ok: boolean; report: string } {
  const failures = results.filter((result) => !result.informational && !result.ok)
  const lines = results.map((result) => {
    const shown = tag(result) === 'FAIL' || result.lines.length === 0 ? '' : `: ${result.lines.join('; ')}`
    return `${tag(result)} ${result.name}${shown}`
  })
  for (const result of failures) lines.push('', `FAIL ${result.name}:`, ...result.lines.map((line) => `  ${line}`))
  lines.push('', failures.length === 0 ? 'check:task: PASS' : `check:task: FAIL (${failures.length} steps)`)
  return { ok: failures.length === 0, report: lines.join('\n') }
}

export async function runCheckTask(
  ctx: CheckContext,
  steps: Step[],
  now: () => number = Date.now,
): Promise<{ ok: boolean; report: string }> {
  openRun()
  const results: StepResult[] = []
  for (const step of steps) results.push(await runStep(step, ctx, now))
  return formatReport(results)
}

// task-<N>-<anything>.md, by file name only.
export function taskNumberOf(path: string): number | null {
  const match = /^task-(\d+)-.*\.md$/.exec(basename(path))
  return match ? Number(match[1]) : null
}

export interface Args {
  task: string
  base: string | null
  builtBy: 'local' | 'strong'
  taskNumber: number
}

// Each option once, each with a value that does not start with "-" (so a value is never read as an option).
function readOptions(argv: string[]): Map<string, string> | string {
  const options = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]]
    if (!['--task', '--base', '--built-by'].includes(name)) return `unknown argument "${name}"`
    if (options.has(name)) return `${name} given twice`
    if (value === undefined || value === '' || value.startsWith('-'))
      return `${name} needs a value that does not start with "-"`
    options.set(name, value)
  }
  return options
}

export function parseArgs(argv: string[]): Args | { error: string } {
  const options = readOptions(argv)
  if (typeof options === 'string') return { error: options }
  const task = options.get('--task')
  if (task === undefined) return { error: '--task is required' }
  const taskNumber = taskNumberOf(task)
  if (taskNumber === null)
    return { error: `cannot read a task number from "${basename(task)}" (expected task-<N>-<name>.md)` }
  const builtBy = options.get('--built-by') ?? 'local'
  if (builtBy !== 'local' && builtBy !== 'strong')
    return { error: `--built-by must be local or strong, not "${builtBy}"` }
  return { task, base: options.get('--base') ?? null, builtBy, taskNumber }
}

function mergeBaseWithMain(root: string): string {
  const result = spawnSync('git', ['merge-base', 'HEAD', 'main'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`cannot find the merge base with main (pass --base <sha>): ${result.stderr.trim()}`)
  return result.stdout.trim()
}

// Everything the steps share. Throws with a message when the command cannot do its job.
function buildContext(args: Args, now: () => number): { ctx: CheckContext; root: string } {
  const root = repoRoot()
  const base = resolveBase(args.base ?? mergeBaseWithMain(root), root)
  let markdown: string
  try {
    markdown = readFileSync(args.task, 'utf8')
  } catch {
    throw new Error(`cannot read ${args.task}`)
  }
  // A plan with any problem fails the plan step; the steps that need it then say it could not be read.
  const parsed = parseTestPlan(markdown)
  const plan = parsed.problems.length === 0 ? parsed.plan : null
  const changed = changedFiles(base, root).flatMap((change) =>
    change.oldPath ? [change.path, change.oldPath] : [change.path],
  )
  const ctx = {
    base,
    taskFile: args.task,
    taskNumber: args.taskNumber,
    builtBy: args.builtBy,
    plan,
    changed,
    deadlineMs: now() + BUDGET_MS,
  }
  return { ctx, root }
}

// SIGTERM to every command group (run-breaks restores its file on SIGTERM), SIGKILL after the grace period,
// and exit only once the groups are gone. stopAll also closes the run, so no later step starts a command.
// A second signal while stopping is ignored. `stopping` lets main wait for this exit instead of exiting
// with the report's code when the runner finishes first.
let stopping: Promise<void> | null = null

function installSignalHandlers(): void {
  for (const [signal, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const) {
    process.on(signal, () => {
      if (stopping) return
      stopping = stopAll().then(() => {
        console.log(
          `check:task: ${signal}; stopped. Run git status and put back any source file you did not edit (git checkout -- <file>).`,
        )
        process.exit(code)
      })
    })
  }
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if ('error' in args) {
    console.log(`check:task: ${args.error}\n${USAGE}`)
    return 2
  }
  try {
    const { ctx, root } = buildContext(args, Date.now)
    installSignalHandlers()
    const { ok, report } = await runCheckTask(ctx, defaultSteps(root))
    if (stopping) await stopping // exits 130 or 143; the steps after the signal did not run
    console.log(report)
    return ok ? 0 : 1
  } catch (error) {
    console.log(`check:task: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (isMain(import.meta.filename)) process.exit(await main(process.argv.slice(2)))
