import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { makeRepo, writeIn } from './lib/temp-repo.ts'

const SCRIPT = fileURLToPath(new URL('./check-test-hygiene.ts', import.meta.url))
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function run(cwd: string, ...args: string[]): { code: number | null; out: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
  return { code: result.status, out: result.stdout }
}
function repo(): { cwd: string; base: string } {
  const made = makeRepo({ 'a.test.ts': "// Protects: r\ntest('old', () => { expect(1).toBe(1) })\n" })
  dirs.push(made.cwd)
  return made
}

describe('command line', () => {
  // Protects the command contract: a problem prints "file: rule: detail" and exits 1.
  test('a problem prints file: rule: detail and exits 1', () => {
    const { cwd, base } = repo()
    writeIn(cwd, 'b.test.ts', "test('b', () => {})\n")
    const { code, out } = run(cwd, '--base', base)
    expect(code).toBe(1)
    expect(out).toMatch(/^b\.test\.ts: header: line 1: /m)
  })

  // Protects the command contract: a clean tree prints check:hygiene: ok and exits 0.
  test('a clean tree prints check:hygiene: ok and exits 0', () => {
    const { cwd, base } = repo()
    expect(run(cwd, '--base', base)).toEqual({ code: 0, out: 'check:hygiene: ok\n' })
  })

  // Protects fail-closed behaviour: a mistyped flag must never be ignored (it would silently use the default base).
  test('an unknown argument is a usage error with exit 2', () => {
    const { cwd, base } = repo()
    expect(run(cwd, '--bsae', base).code).toBe(2)
    expect(run(cwd, '--base').code).toBe(2)
    expect(run(cwd, base).code).toBe(2)
  })

  // Protects fail-closed behaviour: a base that does not resolve is an error, never "ok".
  test('a base that does not resolve exits 1 with a message', () => {
    const { cwd } = repo()
    const { code, out } = run(cwd, '--base', 'no-such-ref')
    expect(code).toBe(1)
    expect(out).toMatch(/^check:hygiene: /)
  })

  // Protects Review Focus 5: from a subdirectory (path with a space) an untracked test elsewhere in the repo is still seen.
  test('run from a subdirectory it still reports an untracked test without a header', () => {
    const { cwd, base } = repo()
    writeIn(cwd, 'sub dir/keep.txt', 'x\n')
    writeIn(cwd, 'other dir/c.test.ts', "test('c', () => {})\n")
    const { code, out } = run(join(cwd, 'sub dir'), '--base', base)
    expect(code).toBe(1)
    expect(out).toMatch(/^other dir\/c\.test\.ts: header: /m)
  })

  // Protects fail-closed behaviour: a base that looks like a git option must never reach git (it printed ok before).
  test('a base value starting with a dash is a usage error', () => {
    const { cwd } = repo()
    for (const value of ['--cached', '--base', '-R']) expect(run(cwd, '--base', value).code, value).toBe(2)
  })
})
