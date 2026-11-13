// Protects the sandbox the local model works in: built from HEAD only, no remote, a baseline commit, a linked
// node_modules that git ignores, a dirty checkout noticed, and a baseline that fails closed.
import { lstatSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { checkoutState, confirmBaseline, createSandbox, inHead, type RunCheck } from './sandbox.ts'
import { git, makeRepo, writeIn } from './temp-repo.ts'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function fixture(): string {
  const { cwd } = makeRepo({ 'a.txt': 'one\n', 'sub dir/b.txt': 'two\n', '.gitignore': 'node_modules/\n' })
  writeIn(cwd, 'node_modules/pkg/index.js', 'x')
  dirs.push(cwd)
  return cwd
}
function outDir(): string {
  const parent = mkdtempSync(join(tmpdir(), 'sandbox test-'))
  dirs.push(parent)
  return join(parent, 'box')
}
const ok: RunCheck = () => ({ ok: true, output: '' })

describe('checkoutState', () => {
  // Protects: a clean checkout is clean, and an ignored node_modules is not reported.
  test('clean', () => {
    expect(checkoutState(fixture())).toEqual({ tracked: [], untracked: [] })
  })

  // Protects: unstaged, staged and renamed tracked files are all reported as tracked changes; an untracked file only as untracked.
  test('tracked and untracked changes are told apart', () => {
    const cwd = fixture()
    writeIn(cwd, 'a.txt', 'changed\n')
    git(cwd, 'mv', 'sub dir/b.txt', 'c.txt')
    writeIn(cwd, 'new file.txt', 'u')
    const state = checkoutState(cwd)
    expect(state.tracked.sort()).toEqual(['a.txt', 'c.txt'])
    expect(state.untracked).toEqual(['new file.txt'])
  })

  // Protects: outside a git repository the check throws, so the command can fail closed instead of reporting "clean".
  test('a folder that is not a repository throws', () => {
    const parent = mkdtempSync(join(tmpdir(), 'not repo-'))
    dirs.push(parent)
    expect(() => checkoutState(parent)).toThrow()
  })
})

describe('inHead', () => {
  // Protects: a file is "in HEAD" only when committed; an untracked file is not, so the sandbox would lack it.
  test('committed yes, untracked no', () => {
    const cwd = fixture()
    writeIn(cwd, 'new.txt', 'u')
    expect(inHead(cwd, 'a.txt')).toBe(true)
    expect(inHead(cwd, 'sub dir/b.txt')).toBe(true)
    expect(inHead(cwd, 'new.txt')).toBe(false)
  })
})

describe('createSandbox', () => {
  // Protects: the sandbox holds HEAD's files, one baseline commit, no remote, its own identity, a symlinked node_modules, and a clean status.
  test('builds a clean, remote-less sandbox', () => {
    const cwd = fixture()
    writeIn(cwd, 'a.txt', 'uncommitted\n')
    const sandbox = outDir()
    const sha = createSandbox(cwd, sandbox)
    expect(git(sandbox, 'rev-parse', 'HEAD')).toBe(sha)
    expect(git(sandbox, 'rev-list', '--count', 'HEAD')).toBe('1')
    expect(git(sandbox, 'remote')).toBe('')
    expect(git(sandbox, 'show', 'HEAD:a.txt')).toBe('one')
    expect(git(sandbox, 'config', '--local', 'user.email')).not.toBe('')
    expect(git(sandbox, 'status', '--porcelain')).toBe('')
    expect(lstatSync(join(sandbox, 'node_modules')).isSymbolicLink()).toBe(true)
    expect(git(sandbox, 'ls-files', 'sub dir')).toBe('sub dir/b.txt')
  })

  // Protects: an existing directory is never reused, so nothing already there can be overwritten.
  test('an existing directory makes it throw', () => {
    const cwd = fixture()
    const sandbox = outDir()
    createSandbox(cwd, sandbox)
    expect(() => createSandbox(cwd, sandbox)).toThrow()
  })
})

describe('confirmBaseline', () => {
  // Protects: a clean sandbox and passing checks give no failures.
  test('passing checks', () => {
    const cwd = fixture()
    const sandbox = outDir()
    createSandbox(cwd, sandbox)
    expect(confirmBaseline(sandbox, ok)).toEqual([])
  })

  // Protects: a failing lint or typecheck is reported with the check's name and the end of its output, each one.
  test('failing checks are named with their output', () => {
    const cwd = fixture()
    const sandbox = outDir()
    createSandbox(cwd, sandbox)
    const failures = confirmBaseline(sandbox, (name) => ({ ok: false, output: `boom from ${name}\n` }))
    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('npm run lint failed')
    expect(failures[0]).toContain('boom from lint')
    expect(failures[1]).toContain('npm run typecheck failed')
  })

  // Protects: a check that leaves files behind fails the baseline, since the model would be graded on them.
  test('files left behind by a check are a failure', () => {
    const cwd = fixture()
    const sandbox = outDir()
    createSandbox(cwd, sandbox)
    const messy: RunCheck = (_name, dir) => { writeIn(dir, 'junk.tsbuildinfo', 'x'); return { ok: true, output: '' } }
    expect(confirmBaseline(sandbox, messy).join('\n')).toContain('junk.tsbuildinfo')
  })
})
