import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import type { CheckContext } from '../check-task.ts'
import type { TestPlan } from './test-plan.ts'
import { makeRepo } from './temp-repo.ts'
import { defaultSteps, escapeRateFor, reviewStep } from './check-steps.ts'

// The in-process steps of check:task. The spawned ones (lint, unit, breaks, probes) are proven by the
// end-to-end runs recorded in the Task 8 report, not here, to keep the unit layer fast.
const PLAN: TestPlan = { cases: [], probeFolder: null, breaks: [], flow: 'none', evidence: 'e' }
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function root(progress?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'check steps-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'docs', 'plans', 'p'), { recursive: true })
  if (progress !== undefined) {
    mkdirSync(join(dir, '.planning', 'p'), { recursive: true })
    writeFileSync(join(dir, '.planning', 'p', 'progress.md'), progress)
  }
  return dir
}
function context(dir: string, extra: Partial<CheckContext> = {}): CheckContext {
  return { base: 'x', taskFile: join(dir, 'docs', 'plans', 'p', 'task-4-x.md'), taskNumber: 4, builtBy: 'local', plan: PLAN, changed: ['scripts/a.ts'], deadlineMs: Date.now() + 60_000, ...extra }
}
const TRACKED = '| Task | Built by | Review | Escaped |\n|---|---|---|---|\n| Task 1 | local | yes | 1 |\n| Task 2 | local | no | 0 |\n'

describe('escapeRateFor', () => {
  // Protects ruling 4: a plan with no progress file, or one that does not track escapes, reads as rate 0 and says so.
  test('a missing file or a file without the tracking table is rate 0, stated', () => {
    expect(escapeRateFor(null, 'p.md')).toEqual({ rate: 0, note: 'no p.md; escape rate 0' })
    const untracked = escapeRateFor('| Date | Task |\n|---|---|\n| d | t |\n', 'p.md')
    expect(untracked.rate).toBe(0)
    expect(untracked.note).toContain('does not track escapes')
  })

  // Protects fail closed: a malformed table or an unreadable file is shown and counts as rate 1 (review everything).
  test('a malformed Escaped cell or an unreadable file is shown and counts as rate 1', () => {
    const bad = escapeRateFor('| Task | Built by | Review | Escaped |\n|---|---|---|---|\n| T1 | local | no | 1x |\n', 'p.md')
    expect(bad.rate).toBe(1)
    expect(bad.note).toContain('"Escaped" must be a whole number')
    expect(escapeRateFor('', 'p.md').rate).toBe(1)
    expect(escapeRateFor(new Error('EISDIR'), 'p.md')).toEqual({ rate: 1, note: 'cannot read p.md (EISDIR); escape rate taken as 1' })
  })

  // Protects: a valid table gives the measured rate.
  test('a valid table gives the measured rate', () => {
    expect(escapeRateFor(TRACKED, 'p.md')).toEqual({ rate: 0.5, note: 'escape rate 1 of 2 local tasks' })
  })
})

describe('review step', () => {
  // Protects: the review line is informational and reads the plan folder's own progress file.
  test('reads .planning/<plan>/progress.md and prints Review required with the reason', async () => {
    const dir = root(TRACKED)
    const result = await reviewStep(dir).run(context(dir))
    expect(result.informational).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.lines[0]).toBe('Review required: yes (escape rate 0.5 is above 0.25; every local task is reviewed)')
    expect(result.lines[1]).toBe('escape rate 1 of 2 local tasks')
  })

  // Protects: no progress file means rate 0, and task 4 is then outside the 1-in-3 sample.
  test('with no progress file the rate is 0 and the line says so', async () => {
    const dir = root()
    const result = await reviewStep(dir).run(context(dir))
    expect(result.lines).toEqual(['Review required: no (not in the sample (1 in 3))', `no ${join('.planning', 'p', 'progress.md')}; escape rate 0`])
  })
})

describe('plan and probes steps', () => {
  // Protects: an unreadable task file fails the plan step with a message, not a crash.
  test('the plan step fails when the task file cannot be read', async () => {
    const dir = root()
    const plan = defaultSteps(dir).find((step) => step.name === 'plan')
    const result = await plan?.run(context(dir))
    expect(result).toEqual({ name: 'plan', ok: false, lines: [`cannot read ${context(dir).taskFile}`] })
  })

  // Protects: a plan that says `none` for probes is stated, not counted as probes that ran.
  test('the probes step with no probe folder says so and runs nothing', async () => {
    const dir = root()
    const probes = defaultSteps(dir).find((step) => step.name === 'probes')
    const result = await probes?.run(context(dir))
    expect(result).toEqual({ name: 'probes', ok: true, lines: ['the Test plan names no probe folder (none)'] })
  })

  // Protects: coverage fails closed on an empty case list and names a missing test with its row.
  test('the coverage step fails on a missing test and names the row', async () => {
    const dir = root()
    const coverage = defaultSteps(dir).find((step) => step.name === 'coverage')
    const cases = [{ id: 'C9', behaviour: 'b', layer: 'unit' as const, input: 'i', expected: 'e', test: 'scripts/none.test.ts :: t' }]
    const result = await coverage?.run(context(dir, { plan: { ...PLAN, cases } }))
    expect(result?.ok).toBe(false)
    expect(result?.lines).toEqual(['C9: test file scripts/none.test.ts does not exist or cannot be read'])
  })
})

describe('fix round 1', () => {
  // Protects: a Test plan that could not be read is never described (no probe folder, layer not required) as a pass.
  test('the steps that need the Test plan fail with "not run" when it could not be read', async () => {
    const dir = root()
    const steps = defaultSteps(dir).filter((step) => ['layers', 'coverage', 'breaks', 'probes'].includes(step.name))
    expect(steps).toHaveLength(4)
    for (const step of steps) {
      const result = await step.run(context(dir, { plan: null }))
      expect(result).toEqual({ name: step.name, ok: false, lines: ['not run: the Test plan could not be read (see the plan step)'] })
    }
  })

  // Protects: ESLint gets the remaining budget as a timeout; running out is an error with a clear message, never a pass.
  test('the quality step fails when ESLint cannot finish in the remaining budget', async () => {
    const { cwd, base } = makeRepo({ 'scripts/a.ts': 'export const a = 1\n' })
    dirs.push(cwd)
    writeFileSync(join(cwd, 'scripts', 'b.ts'), 'export const b = 2\n')
    const quality = defaultSteps(cwd).find((step) => step.name === 'quality')
    await expect(quality?.run(context(cwd, { base, deadlineMs: Date.now() + 1 }))).rejects.toThrow('ESLint did not finish within the time budget')
  })

  // Protects: an in-process step that ends after the deadline is a failure, not a pass.
  test('an in-process step that ends after the deadline fails', async () => {
    const { cwd, base } = makeRepo({ 'scripts/a.ts': 'export const a = 1\n' })
    dirs.push(cwd)
    const hygiene = defaultSteps(cwd).find((step) => step.name === 'hygiene')
    const result = await hygiene?.run(context(cwd, { base, deadlineMs: Date.now() - 1 }))
    expect(result?.ok).toBe(false)
    expect(result?.lines[0]).toBe('overran: time budget used (finished after the deadline)')
  })
})
