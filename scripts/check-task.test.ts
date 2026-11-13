import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { type CheckContext, defaultSteps, parseArgs, runCheckTask, type Step, type StepResult, taskNumberOf } from './check-task.ts'
import { runCommand } from './lib/run-command.ts'
import type { TestPlan } from './lib/test-plan.ts'

// The runner is tested with fake steps and a fake clock; only the usage test starts a real process.
const SECRET = 'SECRET-PROBE-INPUT-42'
const PLAN: TestPlan = {
  cases: [{ id: 'C1', behaviour: 'b', layer: 'unit', input: SECRET, expected: SECRET, test: 'scripts/x.test.ts :: t' }],
  probeFolder: 'tests/probes/p/t/', breaks: [], flow: 'none', evidence: 'e',
}
function context(deadlineMs = 1_000): CheckContext {
  return { base: 'abc', taskFile: 'docs/p/task-3-x.md', taskNumber: 3, builtBy: 'local', plan: PLAN, changed: [], deadlineMs }
}
function fake(name: string, result: Partial<StepResult> | (() => Promise<StepResult>), ran: string[] = []): Step {
  return {
    name,
    run: async () => {
      ran.push(name)
      if (typeof result === 'function') return result()
      return { name, ok: true, lines: [], ...result }
    },
  }
}
const clock = (time: number) => (): number => time
const lastLine = (report: string): string => report.trimEnd().split('\n').at(-1) ?? ''

describe('runCheckTask', () => {
  // Protects the passing path: every step passed, the verdict is PASS and the command exits 0.
  test('all steps passing gives PASS and exit code 0', async () => {
    const { ok, report } = await runCheckTask(context(), [fake('plan', {}), fake('lint', {})], clock(0))
    expect(ok).toBe(true)
    expect(report).toContain('PASS plan')
    expect(report).toContain('PASS lint')
    expect(lastLine(report)).toBe('check:task: PASS')
  })

  // Protects: one failure fails the run and is named, and the report is still complete.
  test('one failing step gives FAIL and names it, and the later steps still run', async () => {
    const ran: string[] = []
    const steps = [fake('plan', { ok: false, lines: ['task-3-x.md: missing section'] }, ran), fake('lint', {}, ran), fake('unit', {}, ran)]
    const { ok, report } = await runCheckTask(context(), steps, clock(0))
    expect(ok).toBe(false)
    expect(ran).toEqual(['plan', 'lint', 'unit'])
    expect(report).toContain('FAIL plan')
    expect(report).toContain('task-3-x.md: missing section')
    expect(lastLine(report)).toBe('check:task: FAIL (1 steps)')
  })

  // Protects: the review line is information for the controller, never a reason to fail the task.
  test('an informational step never fails the run', async () => {
    const steps = [fake('review', { ok: false, informational: true, lines: ['Review required: yes (task 3 is in the sample (1 in 3))'] })]
    const { ok, report } = await runCheckTask(context(), steps, clock(0))
    expect(ok).toBe(true)
    expect(report).toContain('INFO review: Review required: yes')
    expect(lastLine(report)).toBe('check:task: PASS')
  })

  // Protects: a crashing step is a failure with its message, and the run goes on.
  test('a step that throws is reported as a failure with its message, not a crash', async () => {
    const ran: string[] = []
    const steps = [fake('quality', () => Promise.reject(new Error('eslint is missing')), ran), fake('coverage', {}, ran)]
    const { ok, report } = await runCheckTask(context(), steps, clock(0))
    expect(ok).toBe(false)
    expect(ran).toEqual(['quality', 'coverage'])
    expect(report).toContain('FAIL quality')
    expect(report).toContain('eslint is missing')
    expect(report).not.toContain('    at ')
  })

  // Protects: a step the budget did not reach is a failure, never silently skipped.
  test('when the budget is used up before a step the step fails with "not run: time budget used"', async () => {
    let time = 0
    const ran: string[] = []
    const slow = fake('unit', () => { time = 2_000; return Promise.resolve({ name: 'unit', ok: true, lines: [] }) }, ran)
    const { ok, report } = await runCheckTask(context(1_000), [slow, fake('breaks', {}, ran)], () => time)
    expect(ran).toEqual(['unit'])
    expect(ok).toBe(false)
    expect(report).toContain('FAIL breaks')
    expect(report).toContain('not run: time budget used')
    expect(lastLine(report)).toBe('check:task: FAIL (1 steps)')
  })

  // Protects: a step that is still running when the budget ends is stopped and fails; the run does not hang.
  test('a step still running at the deadline is killed and fails', async () => {
    const hang = fake('layers', () => new Promise<StepResult>(() => {}))
    const { ok, report } = await runCheckTask(context(50), [hang], clock(0))
    expect(ok).toBe(false)
    expect(report).toContain('FAIL layers')
    expect(report).toContain('killed: time budget used')
  })

  // Protects fix round 1: the deadline backstop and the command's own kill race; whichever wins, no process of
  // the step (child or grandchild) may still be alive when the run returns (a break could still be applied).
  test('a real command still running at the deadline is gone, with its children, when the run returns', { timeout: 20_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'check task race-'))
    const pids = join(dir, 'pids')
    const script = `const c = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' }); require('node:fs').writeFileSync(${JSON.stringify(pids)}, process.pid + ' ' + c.pid); setTimeout(() => {}, 30000)`
    const real: Step = {
      name: 'breaks',
      run: async (ctx) => {
        const result = await runCommand(process.execPath, ['-e', script], { cwd: dir, deadlineMs: ctx.deadlineMs })
        return { name: 'breaks', ok: result.code === 0, lines: result.timedOut ? ['killed: time budget used'] : [] }
      },
    }
    try {
      const { ok, report } = await runCheckTask(context(Date.now() + 600), [real, fake('probes', {})])
      const alive = readFileSync(pids, 'utf8').split(' ').map(Number).filter((pid) => {
        try { process.kill(pid, 0); return true } catch { return false }
      })
      expect(alive).toEqual([])
      expect(ok).toBe(false)
      expect(report).toContain('killed: time budget used')
      expect(report).toContain('not run: time budget used')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // Protects Review Focus 3: the runner prints a step's lines as given and adds nothing from the plan's cases.
  test('the report lists failing row ids and kinds and never a probe input', async () => {
    const probes = fake('probes', { ok: false, lines: ['FAIL C1 (boundary)', 'probes: 0 of 1 passed'] })
    const { report } = await runCheckTask(context(), [probes], clock(0))
    expect(report).toContain('FAIL C1 (boundary)')
    expect(report).not.toContain(SECRET)
  })
})

describe('the layers step', () => {
  // Protects: a layer the plan does not name is stated as not required, not reported as a pass for something unrun.
  test('a layer not named by the plan is reported as not required, not as passed', async () => {
    const layers = defaultSteps().find((step) => step.name === 'layers')
    if (!layers) throw new Error('no layers step')
    const result = await layers.run(context(Date.now() + 60_000))
    expect(result.ok).toBe(true)
    for (const name of ['rules', 'e2e', 'container']) expect(result.lines).toContain(`${name}: not required by this task's test plan`)
    expect(result.lines.join('\n')).not.toMatch(/passed/)
  })

  // Protects: the steps run in the documented order.
  test('defaultSteps are in the documented order', () => {
    const names = defaultSteps().map((step) => step.name)
    expect(names).toEqual(['plan', 'lint', 'typecheck', 'unit', 'layers', 'hygiene', 'quality', 'coverage', 'breaks', 'probes', 'review'])
  })
})

describe('command line', () => {
  // Protects: the review sample uses the task number, so it must come from the file name or stop the command.
  test('the task number is read from task-3-x.md and a file name without it is a usage error', () => {
    expect(taskNumberOf('docs/plans/p/task-3-x.md')).toBe(3)
    expect(taskNumberOf('task-12-long-name.md')).toBe(12)
    expect(taskNumberOf('docs/plans/p/notes.md')).toBeNull()
    expect(taskNumberOf('docs/task-3/README.md')).toBeNull()
    expect(parseArgs(['--task', 'docs/plans/p/notes.md'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'docs/plans/p/task-3-x.md'])).toEqual({ task: 'docs/plans/p/task-3-x.md', base: null, builtBy: 'local', taskNumber: 3 })
  })

  // Protects: a typo in --built-by must not silently choose a tier.
  test('--built-by with another value is a usage error', () => {
    expect(parseArgs(['--task', 'task-3-x.md', '--built-by', 'mid'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--built-by'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--built-by', 'strong'])).toMatchObject({ builtBy: 'strong' })
  })

  // Protects: a value that starts with "-" is never read as a path or a commit, and unknown options are refused.
  test('an option value starting with - or an unknown option is a usage error', () => {
    expect(parseArgs(['--task', '-task-3-x.md'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--base', '--all'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--verbose'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--task', 'task-4-y.md'])).toHaveProperty('error')
    expect(parseArgs(['--task', 'task-3-x.md', '--base', 'abc123'])).toMatchObject({ base: 'abc123' })
  })

  // Protects: the command without its one required argument prints usage and exits 2, not a stack.
  test('missing --task prints usage and exits 2', () => {
    const result = spawnSync(process.execPath, [join(import.meta.dirname, 'check-task.ts')], { encoding: 'utf8' })
    expect(result.stdout).toContain('usage: npm run check:task -- --task <task file>')
    expect(result.stdout + result.stderr).not.toContain('    at ')
    expect(result.status).toBe(2)
  })
})
