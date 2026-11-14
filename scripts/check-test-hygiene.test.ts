import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { checkHygiene, checkSource, compareWithBase, isTestFile } from './check-test-hygiene.ts'

const lines = (...rows: string[]): string => rows.join('\n') + '\n'
// Token words are assembled so this file does not contain the literal words it detects.
const w = (...parts: string[]): string => parts.join('')
const rules = (problems: { rule: string }[]): string[] => problems.map((problem) => problem.rule)

describe('header rule', () => {
  // Protects Review Focus 1: a new test with a Protects comment above is accepted.
  test('a new test with a comment above passes', () => {
    const source = lines("describe('x', () => {", '  // Protects: risk', "  test('a', () => {})", '})')
    expect(checkSource('a.test.ts', source, new Set([3]))).toEqual([])
    expect(checkSource('a.test.ts', lines('/* Protects: r */', "it('a', () => {})"), null)).toEqual([])
  })

  // Protects Review Focus 1: a new test with no comment directly above is reported.
  test('a new test with no comment above fails header', () => {
    const source = lines("describe('x', () => {", '  const y = 1', "  test('a', () => {})", '})')
    const problems = checkSource('a.test.ts', source, new Set([3]))
    expect(rules(problems)).toEqual(['header'])
    expect(problems[0].detail).toMatch(/line 3/)
    expect(rules(checkSource('a.test.ts', lines("it.each([1])('a %s', () => {})"), null))).toEqual(['header'])
    expect(rules(checkSource('a.test.ts', lines('test.each([1])(', "  'a', () => {})"), null))).toEqual(['header'])
  })

  // Protects Review Focus 1: a header file-level comment far above does not count as a header.
  test('a comment separated by a blank line fails header', () => {
    const source = lines('// Protects: risk', '', "test('a', () => {})")
    expect(rules(checkSource('a.test.ts', source, new Set([3])))).toEqual(['header'])
  })

  // Protects the design rule that only new tests need headers: old tests are not penalised for existing.
  test('an old test without a comment is not reported when only another test is added', () => {
    const source = lines("test('old', () => {})", '// Protects: r', "test('new', () => {})")
    expect(checkSource('a.test.ts', source, new Set([2, 3]))).toEqual([])
    expect(rules(checkSource('a.test.ts', source, null))).toEqual(['header'])
  })
})

describe('skipped and focused rules', () => {
  // Protects Review Focus 1: every way of disabling a test is caught, on any line of a changed file. (Title assembled so this file does not trip its own rule.)
  test(w('it.sk', 'ip, x', 'it, x', 'test, test.fix', 'me, describe.sk', 'ip, test.to', 'do each fail skipped'), () => {
    for (const line of [
      w('it.sk', "ip('a', () => {})"), w('x', "it('a', () => {})"), w('x', "test('a', () => {})"), w('test.fix', "me('a', () => {})"),
      w('describe.sk', "ip('a', () => {})"), w('test.to', "do('a')"), w('xd', "escribe('a', () => {})"),
      w('it.sk', "ipIf(true)('a', () => {})"), w("it['sk", "ip']('a', () => {})"),
    ]) {
      const problems = checkSource('a.test.ts', lines('// Protects: r', line), new Set())
      expect(rules(problems), line).toEqual(['skipped'])
    }
  })

  // Protects Review Focus 1: a focused test silently disables all the others, so it must fail. (Title assembled so this file does not trip its own rule.)
  test(w('.on', 'ly and fd', 'escribe fail focused'), () => {
    for (const line of [w('it.on', "ly('a', () => {})"), w('describe.on', "ly('a', () => {})"), w('fd', "escribe('a', () => {})"), w('test.on', "ly('a', () => {})")]) {
      expect(rules(checkSource('a.test.ts', lines('// Protects: r', line), new Set())), line).toEqual(['focused'])
    }
  })

  // Protects the chosen behaviour (false positives accepted, false negatives not): text is not parsed for strings or comments.
  test('a skip hidden in a string or a comment is still flagged conservatively', () => {
    const source = lines(w("const s = 'it.sk", "ip is bad'"), w('// x', 'it('), "test('a', () => {})")
    expect(rules(checkSource('a.test.ts', source, new Set()))).toEqual(['skipped', 'skipped'])
  })
})

describe('compareWithBase', () => {
  const base = lines("test('one', () => { expect(1).toBe(1) })", "test('two', () => { expect(2).toBe(2) })")

  // Protects Review Focus 1: a removed test whose count is hidden by an added one is still caught.
  test('removing a test and adding another still fails lost-test', () => {
    const head = lines("test('one', () => { expect(1).toBe(1) })", "test('three', () => { expect(2).toBe(2) })")
    const problems = compareWithBase('a.test.ts', base, head)
    expect(rules(problems)).toEqual(['lost-test'])
    expect(problems[0].detail).toMatch(/two/)
  })

  // Protects the lost-test rule: a count drop is reported even when titles are not readable.
  test('removing a test fails lost-test by count', () => {
    expect(rules(compareWithBase('a.test.ts', base, lines("test('one', () => { expect(1).toBe(1) })")))).toContain('lost-test')
  })

  // Protects the lost-test rule: a rename looks like a removal, so it is reported and says so.
  test('renaming a test title is reported', () => {
    const head = lines("test('one', () => { expect(1).toBe(1) })", "test('2nd', () => { expect(2).toBe(2) })")
    const problems = compareWithBase('a.test.ts', base, head)
    expect(rules(problems)).toEqual(['lost-test'])
    expect(problems[0].detail).toMatch(/renamed/)
  })

  // Protects the lost-assertion rule: weakening a test by deleting an expect( is caught even if the test stays.
  test('removing an expect( fails lost-assertion', () => {
    const head = lines("test('one', () => { expect(1).toBe(1) })", "test('two', () => {})")
    expect(rules(compareWithBase('a.test.ts', base, head))).toEqual(['lost-assertion'])
  })

  // Protects the lost-assertion rule: an expect( inside a comment must not count as an assertion.
  test('an expect( moved into a comment fails lost-assertion', () => {
    const head = lines("test('one', () => { expect(1).toBe(1) })", "test('two', () => { // expect(2).toBe(2)", '})')
    expect(rules(compareWithBase('a.test.ts', base, head))).toEqual(['lost-assertion'])
  })

  // Protects against false alarms: growth is the normal case.
  test('adding tests and assertions passes', () => {
    const head = base + lines("test('three', () => { expect(3).toBe(3); expect(4).toBe(4) })")
    expect(compareWithBase('a.test.ts', base, head)).toEqual([])
  })

  // Protects Review Focus 1: only test files are graded.
  test('a non-test file is ignored', () => {
    expect(compareWithBase('src/a.ts', base, '')).toEqual([])
    expect(checkSource('src/a.ts', w('it.sk', "ip('x')\n"), null)).toEqual([])
  })
})

describe('isTestFile', () => {
  // Protects Review Focus 5: a test file in a nested folder or with a tsx extension must not escape the check.
  test('isTestFile covers .test.ts, .test.tsx, .spec.ts and nested paths', () => {
    for (const path of ['a.test.ts', 'a.test.tsx', 'a.spec.ts', 'e2e/deep/x/a.spec.ts', 'src/features/a/b.test.tsx']) {
      expect(isTestFile(path), path).toBe(true)
    }
    for (const path of ['a.ts', 'testing.ts', 'src/test/helper.ts', 'a.test.md']) expect(isTestFile(path), path).toBe(false)
  })
})

describe('checkHygiene on a real repository', () => {
  const dirs: string[] = []
  afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
  function git(cwd: string, ...args: string[]): string {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr)
    return result.stdout.trim()
  }
  function write(cwd: string, path: string, content: string): void {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), content)
  }
  function repo(files: Record<string, string>): { cwd: string; base: string } {
    const cwd = mkdtempSync(join(tmpdir(), 'hygiene with space-'))
    dirs.push(cwd)
    git(cwd, 'init', '-q')
    git(cwd, 'config', 'user.email', 't@example.com')
    git(cwd, 'config', 'user.name', 't')
    for (const [path, content] of Object.entries(files)) write(cwd, path, content)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', 'base')
    return { cwd, base: git(cwd, 'rev-parse', 'HEAD') }
  }
  const oldTest = lines("test('old', () => { expect(1).toBe(1) })")

  // Protects Review Focus 1 and 5: a deleted test file is a lost-test for each test in it.
  test('a deleted test file fails lost-test', () => {
    const { cwd, base } = repo({ 'tests/a b.test.ts': lines("test('x', () => {})", "it('y', () => {})") })
    unlinkSync(join(cwd, 'tests/a b.test.ts'))
    const problems = checkHygiene(base, cwd)
    expect(rules(problems)).toEqual(['lost-test', 'lost-test'])
    expect(problems[0].file).toBe('tests/a b.test.ts')
  })

  // Protects Review Focus 5: an untracked new test file with no header is seen, and an untouched old test is not graded.
  test('an untracked test without a header fails header and an old test is left alone', () => {
    const { cwd, base } = repo({ 'a.test.ts': oldTest })
    write(cwd, 'new dir/b.test.ts', lines("test('b', () => {})"))
    expect(checkHygiene(base, cwd).map((p) => `${p.file}:${p.rule}`)).toEqual(['new dir/b.test.ts:header'])
  })

  // Protects Review Focus 1: a modified test file gets the added-line header check and the base comparison together.
  test('a modified test file is graded on added lines and against the base', () => {
    const { cwd, base } = repo({ 'a.test.ts': oldTest })
    write(cwd, 'a.test.ts', lines("test('old', () => {})", "test('new', () => {})"))
    expect(rules(checkHygiene(base, cwd)).sort()).toEqual(['header', 'header', 'lost-assertion'])
  })

  // Protects Review Focus 5: renaming a test file to a non-test name must not hide the tests it held.
  test('renaming a test file to a non-test name fails lost-test', () => {
    const { cwd, base } = repo({ 'a.test.ts': oldTest })
    git(cwd, 'mv', 'a.test.ts', 'a.ts')
    expect(rules(checkHygiene(base, cwd))).toContain('lost-test')
  })

  // Protects fail-closed behaviour: an unusable base is an error, never a clean pass.
  test('an unknown base throws', () => {
    const { cwd } = repo({ 'a.test.ts': oldTest })
    expect(() => checkHygiene('0000000000000000000000000000000000000000', cwd)).toThrow()
  })

  // Protects the clean-tree case: no changes means no problems.
  test('a clean tree has no problems', () => {
    const { cwd, base } = repo({ 'a.test.ts': oldTest })
    expect(checkHygiene(base, cwd)).toEqual([])
  })
})
