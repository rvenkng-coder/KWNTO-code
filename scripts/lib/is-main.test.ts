import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { makeRepo, writeIn } from './temp-repo.ts'

const SCRIPTS = fileURLToPath(new URL('..', import.meta.url))
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function linked(): string {
  const dir = mkdtempSync(join(tmpdir(), 'script link-'))
  dirs.push(dir)
  symlinkSync(SCRIPTS, join(dir, 'scripts-link'))
  return join(dir, 'scripts-link')
}

describe('running a script through a symlinked path', () => {
  // Protects fail-closed behaviour: a symlinked path must not turn a failing check into a silent exit 0.
  test('check-test-hygiene run through a symlink still reports a problem and exits 1', () => {
    const { cwd, base } = makeRepo({ 'a.txt': 'x\n' })
    dirs.push(cwd)
    writeIn(cwd, 'b.test.ts', "test('b', () => {})\n")
    const result = spawnSync(process.execPath, [join(linked(), 'check-test-hygiene.ts'), '--base', base], { cwd, encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/b\.test\.ts: header/)
  })

  // Protects fail-closed behaviour: check-plan has the same entry guard and must also fail loudly through a symlink.
  test('check-plan run through a symlink still reports a problem and exits 1', () => {
    const empty = mkdtempSync(join(tmpdir(), 'empty plan-'))
    dirs.push(empty)
    const result = spawnSync(process.execPath, [join(linked(), 'check-plan.ts'), empty], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/no task files/)
  })
})
