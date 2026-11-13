import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { type Change } from './lib/changed-files.ts'
import { checkChanged, filesToCheck, formatReport, parseEslintJson, QUALITY_PATHS } from './check-changed-quality.ts'
import { git, makeRepo, writeIn } from './lib/temp-repo.ts'

const SCRIPT = join(import.meta.dirname, 'check-changed-quality.ts')
const change = (path: string, status: Change['status'], oldPath?: string): Change => (oldPath === undefined ? { path, status } : { path, status, oldPath })
const LONG = `export function long() {\n${'  doIt()\n'.repeat(60)}}\n`
const SHORT = 'export const ok = 1\n'

function run(cwd: string, ...args: string[]): { code: number | null; out: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })
  return { code: result.status, out: result.stdout + result.stderr }
}

describe('filesToCheck', () => {
  // Protects: added, modified and renamed source files all reach the linter.
  test('filesToCheck keeps added, modified and renamed source files', () => {
    const changes = [change('src/a.ts', 'added'), change('scripts/b.ts', 'modified'), change('backend/pb_hooks/c.pb.js', 'added'), change('src/d.tsx', 'renamed', 'src/old.tsx')]
    expect(filesToCheck(changes)).toEqual(['src/a.ts', 'scripts/b.ts', 'backend/pb_hooks/c.pb.js', 'src/d.tsx'])
  })

  // Protects: nothing is linted that is gone, is a test or is not code.
  test('deleted files and test files and docs are skipped', () => {
    const changes = [change('src/a.ts', 'deleted'), change('src/a.test.ts', 'added'), change('src/b.spec.tsx', 'modified'), change('docs/x.md', 'added'), change('scripts/c.test.ts', 'modified')]
    expect(filesToCheck(changes)).toEqual([])
  })

  // Protects: a rename is checked where the file lives now, never under the old name.
  test('a renamed file is checked under its new path', () => {
    expect(filesToCheck([change('src/new.ts', 'renamed', 'src/old.ts')])).toEqual(['src/new.ts'])
  })

  // Protects: a rename out of the quality folders, or into them, is judged by the new path only.
  test('a file renamed out of the source folders is skipped and one renamed in is kept', () => {
    expect(filesToCheck([change('docs/old.ts', 'renamed', 'src/old.ts')])).toEqual([])
    expect(filesToCheck([change('src/in.ts', 'renamed', 'docs/in.ts')])).toEqual(['src/in.ts'])
  })

  // Protects: tests, e2e, vendored code and other languages never get the limits.
  test('files outside QUALITY_PATHS are skipped', () => {
    for (const path of ['tests/lint/a.ts', 'e2e/a.ts', 'spike/a.ts', 'src/a.css', 'src/a.json', 'backend/pb_migrations/a.js', 'backend/pb_hooks/node_modules/x/a.js', 'a.ts', 'srcx/a.ts']) {
      expect(QUALITY_PATHS.test(path), path).toBe(false)
    }
  })

  // Protects: an empty change list means nothing to check, not a crash.
  test('an empty change list gives an empty list', () => {
    expect(filesToCheck([])).toEqual([])
  })

  // Protects: a path listed twice is linted once.
  test('a path listed twice is returned once', () => {
    expect(filesToCheck([change('src/a.ts', 'modified'), change('src/a.ts', 'added')])).toEqual(['src/a.ts'])
  })
})

describe('parseEslintJson and formatReport', () => {
  // Protects: malformed ESLint output is an error, never read as "no findings".
  test('malformed or unexpected ESLint output throws', () => {
    expect(() => parseEslintJson('')).toThrow()
    expect(() => parseEslintJson('not json')).toThrow()
    expect(() => parseEslintJson('{}')).toThrow()
    expect(() => parseEslintJson('[{"filePath": 3}]')).toThrow()
    expect(() => parseEslintJson('[{"filePath": "a", "messages": 1}]')).toThrow()
  })

  // Protects: counts per rule and per file add up to the findings.
  test('the report counts findings per rule and per file', () => {
    const json = JSON.stringify([
      { filePath: '/r/src/a.ts', messages: [{ ruleId: 'complexity', line: 1 }, { ruleId: 'max-depth', line: 2 }] },
      { filePath: '/r/src/b.ts', messages: [{ ruleId: 'complexity', line: 1 }, { ruleId: null, line: 1 }] },
      { filePath: '/r/src/c.ts', messages: [] },
    ])
    const report = formatReport(parseEslintJson(json), '/r')
    expect(report).toContain('4 findings')
    expect(report).toContain('  2  complexity')
    expect(report).toContain('  1  parse error')
    expect(report).toContain('  2  src/a.ts')
    expect(report).not.toContain('src/c.ts')
  })

  // Protects: a clean repository reports zero findings instead of failing.
  test('an empty ESLint result gives a report of zero findings', () => {
    expect(formatReport(parseEslintJson('[]'), '/r')).toContain('0 findings')
  })
})

describe('in a temp git repository', () => {
  // Protects: a violation in a changed file fails the check and names the file and the rule.
  test('a changed file with a violation exits 1 and names the file and rule', () => {
    const { cwd } = makeRepo({ 'src/ok.ts': SHORT })
    writeIn(cwd, 'src/long file.ts', LONG)
    const { code, out } = run(cwd, '--base', 'HEAD')
    expect(code).toBe(1)
    expect(out).toContain('long file.ts')
    expect(out).toContain('max-lines-per-function')
  })

  // Protects: old code is not forced to change, but the report still counts it.
  test('a violation in an untouched file is not reported by the default run but is counted by --report', () => {
    const { cwd } = makeRepo({ 'src/old.ts': LONG, 'src/ok.ts': SHORT })
    writeIn(cwd, 'src/ok.ts', 'export const ok = 2\n')
    const plain = run(cwd, '--base', 'HEAD')
    expect(plain.code).toBe(0)
    expect(plain.out).not.toContain('old.ts')
    const report = run(cwd, '--report')
    expect(report.out).toContain('1  max-lines-per-function')
    expect(report.out).toContain('1  src/old.ts')
  })

  // Protects: the report is information only, so it never blocks.
  test('--report exits 0 even with violations', () => {
    const { cwd } = makeRepo({ 'src/old.ts': LONG })
    expect(run(cwd, '--report').code).toBe(0)
  })

  // Protects: a change with nothing to check passes and says why.
  test('no changed source files exits 0 with a message', () => {
    const { cwd } = makeRepo({ 'src/old.ts': LONG })
    writeIn(cwd, 'docs/x.md', '# x\n')
    const { code, out } = run(cwd, '--base', 'HEAD')
    expect(code).toBe(0)
    expect(out).toContain('check:quality: no changed source files')
  })

  // Protects: a renamed file keeps being checked, so renaming cannot hide a violation.
  test('a renamed file with a violation is reported under its new path', () => {
    const { cwd } = makeRepo({ 'src/old.ts': LONG })
    git(cwd, 'mv', 'src/old.ts', 'src/new.ts')
    const { code, out } = run(cwd, '--base', 'HEAD')
    expect(code).toBe(1)
    expect(out).toContain('new.ts')
  })

  // Protects: a committed change since the base is checked as well as working-tree edits.
  test('a violation committed since the base is reported', () => {
    const { cwd, base } = makeRepo({ 'src/ok.ts': SHORT })
    writeIn(cwd, 'src/bad.ts', LONG)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', 'bad')
    expect(run(cwd, '--base', base).code).toBe(1)
  })

  // Protects: a syntax error in a changed file fails the check instead of passing.
  test('a changed file that does not parse exits 1', () => {
    const { cwd } = makeRepo({ 'src/ok.ts': SHORT })
    writeIn(cwd, 'src/broken.ts', 'function (\n')
    expect(run(cwd, '--base', 'HEAD').code).toBe(1)
  })

  // Protects: a changed test file is exempt even when it is long.
  test('a long test file is not reported', () => {
    const { cwd } = makeRepo({ 'src/ok.ts': SHORT })
    writeIn(cwd, 'src/long.test.ts', LONG)
    expect(run(cwd, '--base', 'HEAD').code).toBe(0)
  })

  // Protects: a bad base or bad arguments fail with a message, never pass.
  test('an unknown base, bad arguments and a missing repository exit non-zero', () => {
    const { cwd } = makeRepo({ 'src/ok.ts': SHORT })
    expect(run(cwd, '--base', 'nope').code).toBe(1)
    expect(run(cwd, '--base').code).toBe(2)
    expect(run(cwd, '--bogus').code).toBe(2)
    expect(run(cwd, '--base', '--report').code).toBe(2)
    expect(() => checkChanged('HEAD', '/')).toThrow()
  })

  // Protects: --report on a repository without source files says so instead of failing.
  test('--report with no source files exits 0 with a message', () => {
    const { cwd } = makeRepo({ 'README.md': '# x\n' })
    const { code, out } = run(cwd, '--report')
    expect(code).toBe(0)
    expect(out).toContain('no source files')
  })
})
