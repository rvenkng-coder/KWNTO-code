import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { checkPlanFolder, checkTaskFile, defaultPlanFolders } from './check-plan.ts'

const VALID_PLAN = [
  '## Test plan',
  '### Cases',
  '| ID | Behaviour | Layer | Input | Expected | Test |',
  '|---|---|---|---|---|---|',
  '| C1 | empty input | unit | `f("")` | `[]` | scripts/x.test.ts :: empty input |',
  '### Probes',
  '**Probe folder:** `tests/probes/p/t/`',
  '### Breaks',
  '| ID | File | Find | Replace | Tests |',
  '|---|---|---|---|---|',
  '| B1 | scripts/x.ts | `a < b` | `a <= b` | scripts/x.test.ts |',
  '### Flow',
  'none',
  '### Evidence',
  'the check output',
].join('\n')
const LOCAL_BLOCK = [
  '## Sized for the local model',
  '**May touch:** `scripts/x.ts`, `scripts/x.test.ts`',
  '**Must not change:** the exported signature of `f`',
  'Stop and report if you need to touch anything else.',
  '**Model server:** run `npm run ping:model` first',
  '**Checkpoint given:** 1A',
  '',
  '',
].join('\n')
const HEAD = '# Task\n\n**Model tier:** local\n**Interfaces:** none\n\n' + LOCAL_BLOCK
const VALID_TASK = HEAD + VALID_PLAN
const STANDARD = '# Plan\n\n**Standard:** test-plan-v1\n'

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-plan-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('checkTaskFile', () => {
  // Protects: a task with tier, Interfaces and a valid Test plan is accepted.
  test('a task with tier, Interfaces and a valid Test plan passes', () => {
    expect(checkTaskFile('t.md', VALID_TASK)).toEqual([])
  })

  // Protects: each of the three gates is reported on its own, with the file path first.
  test('missing tier, missing Interfaces and missing Test plan are each reported', () => {
    const problems = checkTaskFile('t.md', '# Task\n')
    expect(problems).toHaveLength(3)
    expect(problems.every((problem) => problem.startsWith('t.md'))).toBe(true)
    expect(problems.join('\n')).toMatch(/Model tier/)
    expect(problems.join('\n')).toMatch(/Interfaces/)
    expect(problems.join('\n')).toMatch(/Test plan/)
  })

  // Protects the tier gate: a misspelled tier is a problem, not a missing-line pass.
  test('a bad tier name and a bad checkpoint tier are reported', () => {
    expect(checkTaskFile('t.md', VALID_TASK.replace('local', 'weak')).join('\n')).toMatch(/Model tier/)
    const withCheckpoint = VALID_TASK.replace('\n\n## Test plan', '\n**Checkpoint 2B tier:** wek\n\n## Test plan')
    expect(checkTaskFile('t.md', withCheckpoint).join('\n')).toMatch(/Checkpoint 2B tier/)
  })

  // Protects the local-tier rule: a local model is only given work that is sized for it and says what it may touch.
  test('a local task without the block is a problem', () => {
    const without = VALID_TASK.replace(LOCAL_BLOCK, '')
    const problems = checkTaskFile('t.md', without)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^t\.md: .*Sized for the local model/)
    expect(checkTaskFile('t.md', without.replace('local', 'mid'))).toEqual([])
  })

  // Protects the local-tier rule: a checkpoint given to the local model needs the block even if the task is mid.
  test('a local checkpoint in a mid task also needs the block', () => {
    const mid = VALID_TASK.replace(LOCAL_BLOCK, '').replace(
      '**Model tier:** local',
      '**Model tier:** mid\n**Checkpoint 1A tier:** local',
    )
    expect(checkTaskFile('t.md', mid).join('\n')).toMatch(/Sized for the local model/)
    expect(checkTaskFile('t.md', mid.replace('tier:** local', 'tier:** strong'))).toEqual([])
  })

  // Protects the local-tier rule: a heading alone, or a block missing one of its parts, is named part by part.
  test('a block with missing or empty parts names each one', () => {
    const empty = VALID_TASK.replace(LOCAL_BLOCK, '## Sized for the local model\n\n')
    const problems = checkTaskFile('t.md', empty).join('\n')
    for (const part of ['May touch', 'Must not change', 'Stop and report', 'Model server', 'Checkpoint given'])
      expect(problems).toContain(part)
    const noValue = VALID_TASK.replace('**May touch:** `scripts/x.ts`, `scripts/x.test.ts`', '**May touch:**')
    expect(checkTaskFile('t.md', noValue).join('\n')).toMatch(/May touch/)
  })

  // Protects the local-tier rule: the block counts only when it is a real heading, once, and a comment is not content.
  test('a repeated block, or one only in a comment line, is a problem', () => {
    expect(checkTaskFile('t.md', VALID_TASK.replace(LOCAL_BLOCK, LOCAL_BLOCK + LOCAL_BLOCK)).join('\n')).toMatch(
      /more than once/,
    )
    const commented = VALID_TASK.replace(
      LOCAL_BLOCK,
      LOCAL_BLOCK.split('\n')
        .map((line) => (line ? `<!-- ${line} -->` : line))
        .join('\n'),
    )
    expect(checkTaskFile('t.md', commented).join('\n')).toMatch(/Sized for the local model/)
  })

  // Protects the local-tier rule: a heading inside a code fence is an example, not the block.
  test('a block heading only inside a code fence does not count, and the block may sit after the Test plan', () => {
    const fenced = VALID_TASK.replace(LOCAL_BLOCK, '```\n' + LOCAL_BLOCK + '```\n\n')
    expect(checkTaskFile('t.md', fenced).join('\n')).toMatch(/Sized for the local model/)
    const after = VALID_TASK.replace(LOCAL_BLOCK, '') + '\n\n' + LOCAL_BLOCK
    expect(checkTaskFile('t.md', after)).toEqual([])
  })

  // Protects: problems inside the block reach the caller with the file path.
  test('Test plan problems are reported with the file path', () => {
    const problems = checkTaskFile('t.md', VALID_TASK.replace('### Flow', '### Flows'))
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.every((problem) => problem.startsWith('t.md: '))).toBe(true)
  })
})

describe('checkPlanFolder and the default scan', () => {
  // Protects the opt-in rule: older plans (no Standard line) are not graded by the new standard.
  test('a folder whose README lacks the Standard line is skipped by the default scan', () => {
    const root = tempDir()
    mkdirSync(join(root, 'old'))
    writeFileSync(join(root, 'old', 'README.md'), '# Plan\n\n**Standard:** not applicable (mentions test-plan-v1)\n')
    writeFileSync(join(root, 'old', 'task-1-a.md'), '# bad task')
    mkdirSync(join(root, 'new'))
    writeFileSync(join(root, 'new', 'README.md'), STANDARD)
    expect(defaultPlanFolders(root)).toEqual([join(root, 'new')])
  })

  // Protects the gate: an opted-in folder with a bad task file fails and names the file.
  test('a folder with the Standard line and a bad task file fails', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'README.md'), STANDARD)
    writeFileSync(join(dir, 'task-1-a.md'), '# bad task')
    const problems = checkPlanFolder(dir)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.every((problem) => problem.startsWith(join(dir, 'task-1-a.md')))).toBe(true)
  })

  // Protects scope: only task-*.md files are graded, so README and notes are not.
  test('a task-*.md file is checked, README.md and other files are not', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'README.md'), STANDARD)
    writeFileSync(join(dir, 'notes.md'), '# no plan here')
    writeFileSync(join(dir, 'task-1-a.md'), VALID_TASK)
    expect(checkPlanFolder(dir)).toEqual([])
    writeFileSync(join(dir, 'task-2-b.md'), '# bad')
    expect(checkPlanFolder(dir).join('\n')).toContain('task-2-b.md')
  })

  // Protects fail-closed: an opted-in folder with nothing to check is not a pass.
  test('an empty folder with the Standard line is a problem (no task files)', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'README.md'), STANDARD)
    expect(checkPlanFolder(dir).join('\n')).toMatch(/no task files/)
  })

  // Protects fail-closed: a folder that cannot be read is a problem, not a pass.
  test('a missing folder is a problem', () => {
    expect(checkPlanFolder(join(tempDir(), 'nope')).join('\n')).toMatch(/cannot read/)
  })
})

describe('the command', () => {
  function run(...args: string[]) {
    return spawnSync(process.execPath, ['scripts/check-plan.ts', ...args], { encoding: 'utf8' })
  }

  // Protects the exit-code contract: 1 with the problems printed, 0 with the count otherwise.
  test('the command exits 1 on a problem and 0 otherwise', () => {
    const good = tempDir()
    writeFileSync(join(good, 'task-1-a.md'), VALID_TASK)
    const ok = run(good)
    expect(ok.status).toBe(0)
    expect(ok.stdout).toContain('check:plan: 1 task files ok')

    const bad = tempDir()
    writeFileSync(join(bad, 'task-1-a.md'), '# bad')
    const failed = run(bad)
    expect(failed.status).toBe(1)
    expect(failed.stdout).toContain('task-1-a.md')
    expect(run(join(bad, 'missing')).status).toBe(1)
  })

  // Protects the exit-code contract: an unreadable plans folder is a clear message and exit 1, not a stack trace.
  test('the default scan with an unreadable plans folder exits 1 with a message', () => {
    const empty = tempDir()
    const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts/check-plan.ts')], {
      encoding: 'utf8',
      cwd: empty,
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/cannot read.*docs\/superpowers\/plans/)
    expect(result.stderr).not.toMatch(/at /)
  })
})

describe('the task template', () => {
  // Protects the template: copied to a folder, it is a task file that passes check:plan, local block included.
  test('the template itself passes check:plan when copied to a temp folder', () => {
    const dir = tempDir()
    copyFileSync(
      join(import.meta.dirname, '..', 'docs', 'superpowers', 'plans', 'TASK-TEMPLATE.md'),
      join(dir, 'task-1-template.md'),
    )
    expect(checkPlanFolder(dir)).toEqual([])
  })
})
