import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  type CheckContext,
  defaultSteps,
  parseArgs,
  runCheckTask,
  type Step,
  type StepResult,
  taskNumberOf,
} from './check-task.ts'
import { type CommandResult, runCommand, stopAll } from './lib/run-command.ts'
import type { TestPlan } from './lib/test-plan.ts'

// The runner is tested with fake steps and a fake clock; only the usage test starts a real process.
const SECRET = 'SECRET-PROBE-INPUT-42'
const PLAN: TestPlan = {
  cases: [{ id: 'C1', behaviour: 'b', layer: 'unit', input: SECRET, expected: SECRET, test: 'scripts/x.test.ts :: t' }],
  probeFolder: 'tests/probes/p/t/',
  breaks: [],
  flow: 'none',
  evidence: 'e',
}
function context(deadlineMs = 1_000): CheckContext {
  return {
    base: 'abc',
    taskFile: 'docs/p/task-3-x.md',
    taskNumber: 3,
    builtBy: 'local',
    plan: PLAN,
    changed: [],
    deadlineMs,
  }
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
    const steps = [
      fake('plan', { ok: false, lines: ['task-3-x.md: missing section'] }, ran),
      fake('lint', {}, ran),
      fake('unit', {}, ran),
    ]
    const { ok, report } = await runCheckTask(context(), steps, clock(0))
    expect(ok).toBe(false)
    expect(ran).toEqual(['plan', 'lint', 'unit'])
    expect(report).toContain('FAIL plan')
    expect(report).toContain('task-3-x.md: missing section')
    expect(lastLine(report)).toBe('check:task: FAIL (1 steps)')
  })

  // Protects: the review line is information for the controller, never a reason to fail the task.
  test('an informational step never fails the run', async () => {
    const steps = [
      fake('review', {
        ok: false,
        informational: true,
        lines: ['Review required: yes (task 3 is in the sample (1 in 3))'],
      }),
    ]
    const { ok, report } = await runCheckTask(context(), steps, clock(0))
    expect(ok).toBe(true)
    expect(report).toContain('INFO review: Review required: yes')
    expect(lastLine(report)).toBe('check:task: PASS')
  })

  // Protects: a crashing step is a failure with its message, and the run goes on.
  test('a step that throws is reported as a failure with its message, not a crash', async () => {
    const ran: string[] = []
    const steps = [
      fake('quality', () => Promise.reject(new Error('eslint is missing')), ran),
      fake('coverage', {}, ran),
    ]
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
    const slow = fake(
      'unit',
      () => {
        time = 2_000
        return Promise.resolve({ name: 'unit', ok: true, lines: [] })
      },
      ran,
    )
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

  // Protects: the deadline backstop and the command's own kill race; whichever wins, no process of
  // the step (child or grandchild) may still be alive when the run returns (a break could still be applied).
  test(
    'a real command still running at the deadline is gone, with its children, when the run returns',
    { timeout: 20_000 },
    async () => {
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
        const alive = readFileSync(pids, 'utf8')
          .split(' ')
          .map(Number)
          .filter((pid) => {
            try {
              process.kill(pid, 0)
              return true
            } catch {
              return false
            }
          })
        expect(alive).toEqual([])
        expect(ok).toBe(false)
        expect(report).toContain('killed: time budget used')
        expect(report).toContain('not run: time budget used')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )

  // Protects: no probe input leaks, as the runner prints a step's lines as given and adds nothing from the plan.
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
    for (const name of ['rules', 'e2e', 'container'])
      expect(result.lines).toContain(`${name}: not required by this task's test plan`)
    expect(result.lines.join('\n')).not.toMatch(/passed/)
  })

  // Protects: the steps run in the documented order.
  test('defaultSteps are in the documented order', () => {
    const names = defaultSteps().map((step) => step.name)
    expect(names).toEqual([
      'plan',
      'lint',
      'typecheck',
      'unit',
      'layers',
      'hygiene',
      'quality',
      'coverage',
      'breaks',
      'probes',
      'review',
    ])
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
    expect(parseArgs(['--task', 'docs/plans/p/task-3-x.md'])).toEqual({
      task: 'docs/plans/p/task-3-x.md',
      base: null,
      builtBy: 'local',
      taskNumber: 3,
    })
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

// Fix round 2: after a stop (deadline or signal) no further command may start, so nothing outlives the run.
describe('no command starts after a stop', () => {
  const isAlive = (pid: number | null): boolean => {
    if (pid === null || pid <= 0) return false // never kill(0) or kill(-1): they address groups, not a process
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  const pidOf = (file: string): number | null => {
    try {
      return Number(readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }
  // A command that writes its pid to `file` and lives `ms`.
  const sleeper = (file: string, ms: number): string[] => [
    '-e',
    `require('node:fs').writeFileSync(${JSON.stringify(file)}, String(process.pid)); setTimeout(() => process.exit(0), ${ms})`,
  ]
  // A command that exits at once but leaves a grandchild ignoring SIGTERM; it exits only after the grandchild has
  // installed its handler, so its group really outlives the SIGTERM and its stop waits the whole grace period.
  const leavesStubbornChild = (file: string): string[] => [
    '-e',
    [
      "const c = require('node:child_process').spawn(process.execPath, ['-e', \"process.on('SIGTERM', () => {}); process.send('ready'); setTimeout(() => {}, 20000)\"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })",
      `c.on('message', () => { require('node:fs').writeFileSync(${JSON.stringify(file)}, String(c.pid)); process.exit(0) })`,
    ].join(';'),
  ]
  const settle = (ms: number) => new Promise((done) => setTimeout(done, ms))

  // Protects: a step that runs commands in sequence (like layers) cannot start its next command after the deadline.
  test(
    'the deadline passing during the first command: the second never spawns and nothing is left',
    { timeout: 30_000 },
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'check task seq-'))
      const [a, b] = [join(dir, 'a'), join(dir, 'b')]
      let second: CommandResult | null = null
      const layers: Step = {
        name: 'layers',
        run: async (ctx) => {
          await runCommand(process.execPath, leavesStubbornChild(a), {
            cwd: dir,
            deadlineMs: ctx.deadlineMs,
            graceMs: 1_000,
          })
          second = await runCommand(process.execPath, sleeper(b, 20_000), {
            cwd: dir,
            deadlineMs: ctx.deadlineMs,
            graceMs: 1_000,
          })
          return { name: 'layers', ok: second.code === 0, lines: [second.output] }
        },
      }
      try {
        const { ok, report } = await runCheckTask(context(Date.now() + 600), [layers, fake('probes', {})])
        await settle(500)
        expect(second).toEqual({ code: null, timedOut: true, output: 'not run: time budget used', notStarted: true })
        expect(pidOf(b)).toBeNull()
        expect(isAlive(pidOf(a))).toBe(false)
        expect(ok).toBe(false)
        expect(report).toContain('not run: time budget used')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )

  // Protects: after a Ctrl-C (the handler awaits stopAll) the next step's command never starts.
  test(
    'a signal during the first step: the second step never spawns and nothing is left',
    { timeout: 30_000 },
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'check task seq-'))
      const [a, b] = [join(dir, 'a'), join(dir, 'b')]
      const step = (name: string, file: string): Step => ({
        name,
        run: async (ctx) => {
          const result = await runCommand(process.execPath, sleeper(file, 20_000), {
            cwd: dir,
            deadlineMs: ctx.deadlineMs,
          })
          return { name, ok: result.code === 0, lines: [result.output] }
        },
      })
      try {
        const run = runCheckTask(context(Date.now() + 3_000), [step('lint', a), step('typecheck', b)])
        for (let i = 0; i < 100 && pidOf(a) === null; i++) await settle(25)
        await stopAll() // what the SIGINT/SIGTERM handler does before it exits
        expect(isAlive(pidOf(a))).toBe(false)
        const { ok, report } = await run
        await settle(500)
        expect(pidOf(b)).toBeNull()
        expect(ok).toBe(false)
        expect(report).toContain('FAIL typecheck')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )
})
