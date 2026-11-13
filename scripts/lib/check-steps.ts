// The real steps of check:task (docs/developer/check-task.md). Fast checks run in this process through the
// exported functions of Tasks 2 to 7; npm scripts, breaks and probes run as child processes with a deadline.
import { readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { CheckContext, Step, StepResult } from '../check-task.ts'
import { checkTaskFile } from '../check-plan.ts'
import { checkChanged } from '../check-changed-quality.ts'
import { checkHygiene } from '../check-test-hygiene.ts'
import { escapeRate, MISSING_TABLE, parseProgress } from '../escape-rate.ts'
import { needsReview } from '../review-sample.ts'
import { coverageProblems, layersNeeded } from './coverage.ts'
import { lastLines, runCommand } from './run-command.ts'
import type { TestPlan } from './test-plan.ts'

const TAIL = 40
const SCRIPTS = join(import.meta.dirname, '..')
const KILLED = 'killed: time budget used'
const NO_PLAN = 'not run: the Test plan could not be read (see the plan step)'

const pass = (name: string, lines: string[] = []): StepResult => ({ name, ok: true, lines })
const fail = (name: string, lines: string[]): StepResult => ({ name, ok: false, lines })

// One command; on failure the last lines of its output (a test runner's own report) are kept.
// `summary` keeps the last line of a passing run (run-breaks and run-probes end with a count).
async function command(name: string, cmd: string[], root: string, ctx: CheckContext, summary = false): Promise<StepResult> {
  const result = await runCommand(cmd[0], cmd.slice(1), { cwd: root, deadlineMs: ctx.deadlineMs })
  if (result.notStarted) return fail(name, [result.output])
  if (result.timedOut) return fail(name, [KILLED, ...lastLines(result.output, TAIL)])
  if (result.code === 0) return pass(name, summary ? lastLines(result.output, 1) : [])
  return fail(name, [`exit code ${String(result.code)}`, ...lastLines(result.output, TAIL)])
}

const npmStep = (name: string, script: string, root: string): Step => ({
  name,
  run: (ctx) => command(name, ['npm', 'run', '--silent', script], root, ctx),
})

// A step that reads the Test plan says nothing about a plan that could not be read: it does not pass.
function needsPlan(name: string, run: (ctx: CheckContext, plan: TestPlan) => Promise<StepResult>): Step {
  return {
    name,
    run: (ctx) => (ctx.plan === null ? Promise.resolve(fail(name, [NO_PLAN])) : run(ctx, ctx.plan)),
  }
}

// In-process steps cannot be interrupted (their git calls are synchronous); one that ends after the deadline
// is a failure, never a pass.
function inTime(name: string, ctx: CheckContext, result: StepResult): StepResult {
  if (Date.now() <= ctx.deadlineMs) return result
  return fail(name, ['overran: time budget used (finished after the deadline)', ...result.lines])
}

function planStep(): Step {
  return {
    name: 'plan',
    run: async (ctx) => {
      let markdown: string
      try {
        markdown = readFileSync(resolve(ctx.taskFile), 'utf8')
      } catch {
        return fail('plan', [`cannot read ${ctx.taskFile}`])
      }
      const problems = checkTaskFile(ctx.taskFile, markdown)
      return problems.length === 0 ? pass('plan') : fail('plan', problems)
    },
  }
}

const TEST_LAYERS = ['rules', 'e2e', 'container'] as const

// The unit layer is the `unit` step; the others run only when the Test plan names them.
function layersStep(root: string): Step {
  return needsPlan('layers', async (ctx, plan) => {
    const needed = layersNeeded(plan)
    const lines: string[] = []
    let ok = true
    for (const layer of TEST_LAYERS) {
      if (!needed.has(layer)) { lines.push(`${layer}: not required by this task's test plan`); continue }
      const result = await command(layer, ['npm', 'run', '--silent', `test:${layer}`], root, ctx)
      ok = ok && result.ok
      lines.push(result.ok ? `${layer}: passed` : `${layer}: FAILED`, ...(result.ok ? [] : result.lines))
    }
    return { name: 'layers', ok, lines }
  })
}

// Fail closed: with no changed file the hygiene and quality steps would pass on nothing.
const nothingChanged = (name: string, ctx: CheckContext): StepResult | null =>
  ctx.changed.length === 0 ? fail(name, [`nothing changed since ${ctx.base}; pass --base <the commit the task started from>`]) : null

function hygieneStep(root: string): Step {
  return {
    name: 'hygiene',
    run: async (ctx) => {
      const empty = nothingChanged('hygiene', ctx)
      if (empty) return empty
      const problems = checkHygiene(ctx.base, root)
      const result = problems.length === 0 ? pass('hygiene') : fail('hygiene', problems.map((p) => `${p.file}: ${p.rule}: ${p.detail}`))
      return inTime('hygiene', ctx, result)
    },
  }
}

// The task's own changed files against the task's base, never the whole branch against main.
// ESLint gets the remaining budget as its timeout; running out is an error, so the step fails.
function qualityStep(root: string): Step {
  return {
    name: 'quality',
    run: async (ctx) => {
      const empty = nothingChanged('quality', ctx)
      if (empty) return empty
      const { code, output } = checkChanged(ctx.base, root, Math.max(1, ctx.deadlineMs - Date.now()))
      return inTime('quality', ctx, code === 0 ? pass('quality', [output]) : fail('quality', lastLines(output, TAIL)))
    },
  }
}

function coverageStep(root: string): Step {
  const readFile = (path: string): string | null => {
    try {
      return readFileSync(join(root, path), 'utf8')
    } catch {
      return null
    }
  }
  return needsPlan('coverage', async (ctx, plan) => {
    const problems = coverageProblems(plan, readFile)
    const result = problems.length === 0 ? pass('coverage', [`${plan.cases.length} cases point at tests that exist`]) : fail('coverage', problems)
    return inTime('coverage', ctx, result)
  })
}

function breaksStep(root: string): Step {
  return needsPlan('breaks', (ctx) => command('breaks', [process.execPath, join(SCRIPTS, 'run-breaks.ts'), '--cwd', root, resolve(ctx.taskFile)], root, ctx, true))
}

// run-probes prints only rows and kinds, so its lines are safe to show; a missing or empty folder fails there.
function probesStep(root: string): Step {
  return needsPlan('probes', async (ctx, plan) => {
    if (plan.probeFolder === null) return pass('probes', ['the Test plan names no probe folder (none)'])
    return command('probes', [process.execPath, join(SCRIPTS, 'run-probes.ts'), '--cwd', root, plan.probeFolder], root, ctx, true)
  })
}

// Escape rate for the review line (ruling of Task 8): no file or no tracking table means 0, said so;
// any other problem is shown and counts as 1, so every local task is reviewed (fail closed).
// `markdown` is null when the file does not exist, an Error when it exists but cannot be read.
export function escapeRateFor(markdown: string | null | Error, path: string): { rate: number; note: string } {
  if (markdown === null) return { rate: 0, note: `no ${path}; escape rate 0` }
  if (markdown instanceof Error) return { rate: 1, note: `cannot read ${path} (${markdown.message}); escape rate taken as 1` }
  const { rows, problems } = parseProgress(markdown)
  if (problems.length === 1 && problems[0] === MISSING_TABLE) return { rate: 0, note: `${path} does not track escapes; escape rate 0` }
  if (problems.length > 0) return { rate: 1, note: `${path}: ${problems.join('; ')}; escape rate taken as 1` }
  const measured = escapeRate(rows)
  return { rate: measured.rate, note: `escape rate ${measured.escapedTasks} of ${measured.localTasks} local tasks` }
}

function readProgress(path: string): string | null | Error {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code === 'ENOENT' ? null : new Error(code ?? 'unknown error')
  }
}

export function reviewStep(root: string): Step {
  return {
    name: 'review',
    run: async (ctx) => {
      const path = join('.planning', basename(dirname(resolve(ctx.taskFile))), 'progress.md')
      const { rate, note } = escapeRateFor(readProgress(join(root, path)), path)
      const review = needsReview({ changedFiles: ctx.changed, taskNumber: ctx.taskNumber, builtBy: ctx.builtBy, escapeRate: rate })
      return { name: 'review', ok: true, informational: true, lines: [`Review required: ${review.required ? 'yes' : 'no'} (${review.reason})`, note] }
    },
  }
}

export function defaultSteps(root: string = process.cwd()): Step[] {
  return [
    planStep(), npmStep('lint', 'lint', root), npmStep('typecheck', 'typecheck', root), npmStep('unit', 'test:unit', root),
    layersStep(root), hygieneStep(root), qualityStep(root), coverageStep(root), breaksStep(root), probesStep(root), reviewStep(root),
  ]
}
