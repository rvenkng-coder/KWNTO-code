import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { makeRepo } from './lib/temp-repo.ts'

// Each test builds a throwaway project with a Vitest `probes` project and a probe folder, and runs the
// real command against it.
const SCRIPT = join(import.meta.dirname, 'run-probes.ts')
const CONFIG = "export default { test: { projects: [{ test: { name: 'probes', globals: true, include: ['tests/probes/**/*.probe.test.ts'] } }] } }\n"
const FOLDER = 'tests/probes/p/t'
const SECRET = 'SECRET-INPUT-123'
const PASSING = "test('[C1] empty-input: nothing in', () => { expect(1).toBe(1) })\n"
// Fails with the secret in its assertion, in a thrown message and on the console.
const LEAKY = [
  "test('[C2] boundary: eighteen', () => {",
  `  console.log('${SECRET}')`,
  `  expect('${SECRET}').toBe('other')`,
  '})',
  "test('[C3] boundary: thrown', () => { throw new Error('" + SECRET + "') })",
].join('\n') + '\n'

const repos: string[] = []
function fixture(files: Record<string, string>): string {
  const { cwd } = makeRepo({ 'vitest.config.js': CONFIG, ...files })
  repos.push(cwd)
  return cwd
}
afterEach(() => { for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function run(cwd: string, ...args: string[]): { code: number | null; out: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
  return { code: result.status, out: result.stdout + result.stderr }
}

describe('run-probes command', () => {
  // Protects the passing path: all probes pass, exit 0, and the count is stated.
  test('all passing probes exit 0 and say N of N', { timeout: 60_000 }, () => {
    const cwd = fixture({ [`${FOLDER}/a.probe.test.ts`]: PASSING + "test('[C4] boundary: b', () => {})\n" })
    const { code, out } = run(cwd, FOLDER)
    expect(out).toContain('probes: 2 of 2 passed')
    expect(code).toBe(0)
  })

  // Protects Review Focus 3: the output names the failing row and kind and nothing from the probe's input.
  test('a failing probe prints FAIL <row> (<kind>) and exits 1', { timeout: 60_000 }, () => {
    const cwd = fixture({ [`${FOLDER}/a.probe.test.ts`]: PASSING + LEAKY })
    const { code, out } = run(cwd, FOLDER)
    expect(out).toContain('FAIL C2 (boundary)')
    expect(out).toContain('FAIL C3 (boundary)')
    expect(out).toContain('probes: 1 of 3 passed')
    expect(code).toBe(1)
  })

  // Protects Review Focus 3: the assertion, the thrown message and a console.log of the secret never appear.
  test('the output does not contain the probe\'s input value', { timeout: 60_000 }, () => {
    const cwd = fixture({ [`${FOLDER}/a.probe.test.ts`]: LEAKY })
    const { out } = run(cwd, FOLDER)
    for (const word of [SECRET, 'expected', 'received', 'AssertionError', 'a.probe.test.ts', 'Error']) expect(out).not.toContain(word)
  })

  // Protects: a task that lists a probe folder must have one.
  test('a missing folder exits 1', () => {
    const { code, out } = run(fixture({}), FOLDER)
    expect(out).toContain('probe folder not found')
    expect(code).toBe(1)
  })

  // Protects: zero probes must never pass as "all passed".
  test('an empty folder exits 1', () => {
    const cwd = fixture({ [`${FOLDER}/.gitkeep`]: '' })
    const { code, out } = run(cwd, FOLDER)
    expect(out).toContain('no *.probe.test.ts file')
    expect(code).toBe(1)
  })

  // Protects: a probe that cannot be parsed is a failure, and its parser message is not echoed.
  test('a probe file with a syntax error exits 1 and is counted as a load error', { timeout: 60_000 }, () => {
    const cwd = fixture({ [`${FOLDER}/a.probe.test.ts`]: PASSING, [`${FOLDER}/b.probe.test.ts`]: `test('[C5] x: y', () => {\nconst a = ${SECRET} +\n` })
    const { code, out } = run(cwd, FOLDER)
    expect(out).toContain('1 probe file(s) could not be loaded')
    expect(out).not.toContain(SECRET)
    expect(code).toBe(1)
  })

  // Protects: a crash in Vitest (here, a config that throws) shows our message, not Vitest's output.
  test('the vitest output is not echoed on a crash', { timeout: 60_000 }, () => {
    const cwd = fixture({ 'vitest.config.js': `throw new Error('${SECRET}')\n`, [`${FOLDER}/a.probe.test.ts`]: PASSING })
    const { code, out } = run(cwd, FOLDER)
    expect(out).toContain('run-probes: ')
    expect(out).not.toContain(SECRET)
    expect(code).toBe(1)
  })

  // Protects: a wrong command line prints the usage and fails.
  test('missing or extra arguments print the usage and exit 1', () => {
    for (const args of [[], ['a', 'b'], ['--cwd'], ['--bad']]) {
      const { code, out } = run(fixture({}), ...args)
      expect(out).toContain('usage:')
      expect(code).toBe(1)
    }
  })
})
