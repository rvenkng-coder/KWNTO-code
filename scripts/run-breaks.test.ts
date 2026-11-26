import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { git, makeRepo, writeIn } from './lib/temp-repo.ts'

// Each test builds a throwaway git repository holding a tiny project (isAdult, its Vitest tests and a
// Vitest config with a `unit` project) plus a task file, and runs the real command against it.
const SCRIPT = join(import.meta.dirname, 'run-breaks.ts')
const SOURCE = 'export function isAdult(age: number): boolean {\n  return age >= 18\n}\n'
const CONFIG =
  "export default { test: { projects: [{ test: { name: 'unit', globals: true, include: ['frontend/src/**/*.test.ts'] } }] } }\n"
const SLOW = 60_000

function testsFor(ages: number[], slow = false): string {
  const cases = ages.map((age) => `test('age ${age}', () => { expect(isAdult(${age})).toBe(${age >= 18}) })`)
  // A slow test keeps Vitest busy long enough for the interrupt tests to catch a break in flight.
  if (slow) cases.push("test('slow', async () => { await new Promise((done) => setTimeout(done, 4000)) }, 30000)")
  return `import { isAdult } from './a.ts'\n${cases.join('\n')}\n`
}

function task(breaks: string, caseLayer = 'unit'): string {
  const test = caseLayer === 'unit' ? 'frontend/src/a.test.ts :: age 18' : 'e2e/a.spec.ts :: adult flow'
  return [
    '# Task',
    '',
    '**Model tier:** mid',
    '**Interfaces:** none',
    '',
    '## Test plan',
    '### Cases',
    '| ID | Behaviour | Layer | Input | Expected | Test |',
    '|---|---|---|---|---|---|',
    `| C1 | 18 is adult | ${caseLayer} | \`18\` | \`true\` | ${test} |`,
    '### Probes',
    '**Probe folder:** none',
    '### Breaks',
    breaks,
    '### Flow',
    'none',
    '### Evidence',
    'the output',
    '',
  ].join('\n')
}
const TABLE = '| ID | File | Find | Replace | Tests |\n|---|---|---|---|---|\n'
const BOUNDARY = `${TABLE}| B1 | frontend/src/a.ts | \`age >= 18\` | \`age > 18\` | frontend/src/a.test.ts |`

const repos: string[] = []
function fixture(files: Record<string, string>): string {
  const { cwd } = makeRepo({
    '.gitignore': 'node_modules/\n',
    'vitest.config.js': CONFIG,
    'frontend/src/a.ts': SOURCE,
    ...files,
  })
  repos.push(cwd)
  return cwd
}
afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function run(cwd: string, ...args: string[]): { code: number | null; out: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
  return { code: result.status, out: result.stdout + result.stderr }
}

describe('run-breaks command', () => {
  // Protects the passing path: tests that pin the boundary catch the break, and the command says so.
  test('a break the tests catch exits 0', { timeout: SLOW }, () => {
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 18, 19]), 'task.md': task(BOUNDARY) })
    const { code, out } = run(cwd, 'task.md')
    expect(out).toContain('B1 caught')
    expect(code).toBe(0)
  })

  // Protects the point of the command: tests that never try the boundary fail the task.
  test('a break the tests miss (tests only try 17 and 19) exits 1 and says SURVIVED', { timeout: SLOW }, () => {
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 19]), 'task.md': task(BOUNDARY) })
    const { code, out } = run(cwd, 'task.md')
    expect(out).toContain('B1 SURVIVED: the tests did not notice frontend/src/a.ts: age >= 18 -> age > 18')
    expect(code).toBe(1)
  })

  // Protects: a caught and a surviving break both leave the working tree as it was.
  test('after the run the fixture files are unchanged (git diff empty)', { timeout: SLOW }, () => {
    const breaks = `${BOUNDARY}\n| B2 | frontend/src/a.ts | \`18\` | \`21\` | frontend/src/a.test.ts |`
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 19]), 'task.md': task(breaks) })
    const { out } = run(cwd, 'task.md')
    expect(out).toContain('B1 SURVIVED')
    expect(out).toContain('B2 caught')
    expect(git(cwd, 'status', '--porcelain')).toBe('')
  })

  // Protects: bytes the editor wrote (CRLF, non-ASCII, no final newline) come back exactly.
  test('the restored file is byte-identical, CRLF and non-ASCII included', { timeout: SLOW }, () => {
    const source = '// âge limite\r\nexport function isAdult(age: number): boolean {\r\n  return age >= 18\r\n}'
    const cwd = fixture({
      'frontend/src/a.ts': source,
      'frontend/src/a.test.ts': testsFor([17, 18, 19]),
      'task.md': task(BOUNDARY),
    })
    expect(run(cwd, 'task.md').out).toContain('B1 caught')
    expect(readFileSync(join(cwd, 'frontend/src/a.ts')).equals(Buffer.from(source, 'utf8'))).toBe(true)
  })

  for (const [signal, exitCode] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const) {
    const title =
      signal === 'SIGINT'
        ? 'killing the command with SIGINT mid-run restores the file'
        : 'killing the command with SIGTERM mid-run restores the file'
    // Protects: Ctrl-C (or a kill) while a break is applied still restores the file.
    test(title, { timeout: SLOW }, async () => {
      const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 18, 19], true), 'task.md': task(BOUNDARY) })
      const child = spawn(process.execPath, [SCRIPT, 'task.md'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString()
      })
      let running = true
      const exited = new Promise<number | null>((done) =>
        child.on('close', (code) => {
          running = false
          done(code)
        }),
      )
      const deadline = Date.now() + 45_000
      while (running && readFileSync(join(cwd, 'frontend/src/a.ts'), 'utf8') === SOURCE && Date.now() < deadline)
        await new Promise((done) => setTimeout(done, 25))
      expect(readFileSync(join(cwd, 'frontend/src/a.ts'), 'utf8')).toContain('age > 18')
      child.kill(signal)
      expect(await exited).toBe(exitCode)
      expect(readFileSync(join(cwd, 'frontend/src/a.ts'), 'utf8')).toBe(SOURCE)
      expect(out).toContain('restored frontend/src/a.ts')
    })
  }

  // Protects the Test plan contract: code with unit cases must be shown to be guarded by its tests.
  test('a task with no breaks and a unit case exits 1', () => {
    const cwd = fixture({ 'task.md': task('none') })
    const { code, out } = run(cwd, 'task.md')
    expect(code).toBe(1)
    expect(out).toMatch(/unit cases/)
  })

  // Protects: a task with only e2e, rules or manual cases has no code Vitest reaches and needs no break.
  test('a task with no breaks and no unit case exits 0', () => {
    const cwd = fixture({ 'task.md': task('none', 'e2e') })
    const { code, out } = run(cwd, 'task.md')
    expect(out).toContain('no breaks listed')
    expect(code).toBe(0)
  })
})

describe('run-breaks fails closed', () => {
  // Protects: a break proves nothing against red tests, so a failing baseline is exit 1 and nothing is applied.
  test('a failing baseline exits 1 and leaves the file alone', { timeout: SLOW }, () => {
    const cwd = fixture({
      'frontend/src/a.test.ts':
        "import { isAdult } from './a.ts'\ntest('wrong', () => { expect(isAdult(18)).toBe(false) })\n",
      'task.md': task(BOUNDARY),
    })
    const { code, out } = run(cwd, 'task.md')
    expect(code).toBe(1)
    expect(out).toMatch(/baseline/)
    expect(git(cwd, 'status', '--porcelain')).toBe('')
  })

  // Protects: an ambiguous Find is reported invalid and fails the run.
  test('a Find that matches twice is invalid and exits 1', { timeout: SLOW }, () => {
    const breaks = `${TABLE}| B1 | frontend/src/a.ts | \`a\` | \`b\` | frontend/src/a.test.ts |`
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 18, 19]), 'task.md': task(breaks) })
    const { code, out } = run(cwd, 'task.md')
    expect(out).toMatch(/^B1 invalid: Find must occur exactly once/m)
    expect(code).toBe(1)
    expect(git(cwd, 'status', '--porcelain')).toBe('')
  })

  // Protects: a misspelled test path would make Vitest fail with "no test files" and look like a catch.
  test('a named test file that does not exist exits 1 before any break', { timeout: SLOW }, () => {
    const breaks = `${TABLE}| B1 | frontend/src/a.ts | \`age >= 18\` | \`age > 18\` | frontend/src/a.test.ts, frontend/src/typo.test.ts |`
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 18, 19]), 'task.md': task(breaks) })
    const { code, out } = run(cwd, 'task.md')
    expect(out).toContain('frontend/src/typo.test.ts')
    expect(out).not.toContain('B1 caught')
    expect(code).toBe(1)
  })

  // Protects: a missing task file, a file with no Test plan and a malformed Breaks table each exit 1,
  // each with its own message (so a crash of the command, also exit 1, does not pass this test).
  test('a missing, empty or malformed task file exits 1', () => {
    const cwd = fixture({
      'empty.md': '',
      'bad.md': task(`${TABLE}| B1 | tests/a.ts | x | y | frontend/src/a.test.ts |`),
    })
    const missing = run(cwd, 'missing.md')
    expect(missing.code).toBe(1)
    expect(missing.out).toContain('run-breaks: cannot read missing.md')
    const empty = run(cwd, 'empty.md')
    expect(empty.code).toBe(1)
    expect(empty.out).toContain('missing the "## Test plan" heading')
    expect(empty.out).toContain('run-breaks: fix the Test plan first')
    const bad = run(cwd, 'bad.md')
    expect(bad.code).toBe(1)
    expect(bad.out).toContain(
      'Breaks B1: File "tests/a.ts" must be under frontend/src/, scripts/ or backend/pb_hooks/lib/',
    )
    expect(bad.out).toContain('run-breaks: fix the Test plan first')
  })

  // Protects against a fail-open: a test file outside the `unit` project exists but never runs, so Vitest
  // fails with "No test files found"; that must be an error, never a break counted as caught.
  test('a named test file outside the unit project is an error, never caught', { timeout: SLOW }, () => {
    const config =
      "export default { test: { projects: [{ test: { name: 'unit', globals: true, include: ['frontend/src/**/*.test.ts'] } }, { test: { name: 'rules', globals: true, include: ['tests/**/*.rules.test.ts'] } }] } }\n"
    const breaks = `${BOUNDARY}\n| B2 | frontend/src/a.ts | \`18\` | \`21\` | tests/x.rules.test.ts |`
    const rulesTest =
      "import { isAdult } from '../frontend/src/a.ts'\ntest('adult', () => { expect(isAdult(30)).toBe(true) })\n"
    const cwd = fixture({
      'vitest.config.js': config,
      'frontend/src/a.test.ts': testsFor([17, 18, 19]),
      'tests/x.rules.test.ts': rulesTest,
      'task.md': task(breaks),
    })
    const { code, out } = run(cwd, 'task.md')
    expect(out).not.toContain('B2 caught')
    expect(out).toContain('did not run in the unit project: tests/x.rules.test.ts')
    expect(code).toBe(1)
    expect(git(cwd, 'status', '--porcelain')).toBe('')
  })

  // Protects the usage: no task, two tasks or a dangling --cwd is an error, never a silent pass.
  test('bad arguments exit 1 with the usage', () => {
    const cwd = fixture({})
    for (const args of [[], ['a.md', 'b.md'], ['--cwd'], ['--cwd', '.']]) {
      const { code, out } = run(cwd, ...args)
      expect(code, args.join(' ')).toBe(1)
      expect(out, args.join(' ')).toMatch(/usage/)
    }
  })

  // Protects --cwd: the project is found there, not in the directory the command was started from.
  test('--cwd runs the breaks in the named directory', { timeout: SLOW }, () => {
    const cwd = fixture({ 'frontend/src/a.test.ts': testsFor([17, 18, 19]), 'task.md': task(BOUNDARY) })
    const elsewhere = fixture({})
    writeIn(elsewhere, 'note.txt', 'not the project\n')
    const { code, out } = run(elsewhere, '--cwd', cwd, join(cwd, 'task.md'))
    expect(out).toContain('B1 caught')
    expect(code).toBe(0)
  })
})
