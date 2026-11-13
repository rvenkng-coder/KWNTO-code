import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { addedLines, changedFiles, fileAtBase, parseNameStatus } from './changed-files.ts'

describe('parseNameStatus', () => {
  // Protects Review Focus 5: a changed-files list that misses a status kind lets a violation go unchecked.
  test('parseNameStatus reads A M D and R100 lines', () => {
    const out = 'A\tsrc/a.ts\nM\tsrc/b.ts\nD\tsrc/c.ts\nR100\tsrc/old.ts\tsrc/new.ts\n'
    expect(parseNameStatus(out)).toEqual([
      { path: 'src/a.ts', status: 'added' },
      { path: 'src/b.ts', status: 'modified' },
      { path: 'src/c.ts', status: 'deleted' },
      { path: 'src/new.ts', status: 'renamed', oldPath: 'src/old.ts' },
    ])
  })

  // Protects Review Focus 5: a renamed test file must be compared with its old content, so oldPath is needed.
  test('a rename keeps oldPath', () => {
    const [change] = parseNameStatus('R087\ta.ts\tb.ts\n')
    expect(change).toEqual({ path: 'b.ts', status: 'renamed', oldPath: 'a.ts' })
  })

  // Protects Review Focus 5: the repo path contains spaces; splitting on whitespace would lose the file.
  test('paths with spaces are kept', () => {
    expect(parseNameStatus('M\tsrc/my file.ts\n')).toEqual([{ path: 'src/my file.ts', status: 'modified' }])
    expect(parseNameStatus('R100\told dir/a b.ts\tnew dir/a b.ts\n')[0]).toEqual({
      path: 'new dir/a b.ts', status: 'renamed', oldPath: 'old dir/a b.ts',
    })
    expect(parseNameStatus('M\0src/my file.ts\0R100\0a b.ts\0c d.ts\0')).toEqual([
      { path: 'src/my file.ts', status: 'modified' },
      { path: 'c d.ts', status: 'renamed', oldPath: 'a b.ts' },
    ])
  })

  // Protects fail-closed behaviour: no output means no changes, never a crash or a phantom entry.
  test('empty output gives no changes', () => {
    expect(parseNameStatus('')).toEqual([])
    expect(parseNameStatus('\n')).toEqual([])
  })

  // Protects fail-closed behaviour: a status the parser does not know must not be silently dropped.
  test('an unknown status throws', () => {
    expect(() => parseNameStatus('Z\tfile.ts\n')).toThrow(/Z/)
  })
})

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.trim()
}
function write(cwd: string, path: string, content: string): void {
  mkdirSync(dirname(join(cwd, path)), { recursive: true })
  writeFileSync(join(cwd, path), content)
}
function makeRepo(files: Record<string, string>): { cwd: string; base: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'changed-files with space-'))
  dirs.push(cwd)
  git(cwd, 'init', '-q')
  git(cwd, 'config', 'user.email', 't@example.com')
  git(cwd, 'config', 'user.name', 't')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  for (const [path, content] of Object.entries(files)) write(cwd, path, content)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', 'base')
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') }
}

describe('with a real repository', () => {
  // Protects Review Focus 5: committed, staged, unstaged and untracked changes must all be seen.
  test('changedFiles sees a committed change, a staged change, an unstaged change and an untracked file', () => {
    const { cwd, base } = makeRepo({ 'a.txt': '1\n', 'b.txt': '1\n', 'c d.txt': '1\n' })
    write(cwd, 'a.txt', '2\n')
    git(cwd, 'commit', '-q', '-am', 'change a')
    write(cwd, 'b.txt', '2\n')
    git(cwd, 'add', 'b.txt')
    write(cwd, 'c d.txt', '2\n')
    write(cwd, 'new dir/untracked file.txt', 'x\n')
    const changes = changedFiles(base, cwd)
    expect(changes).toContainEqual({ path: 'a.txt', status: 'modified' })
    expect(changes).toContainEqual({ path: 'b.txt', status: 'modified' })
    expect(changes).toContainEqual({ path: 'c d.txt', status: 'modified' })
    expect(changes).toContainEqual({ path: 'new dir/untracked file.txt', status: 'added' })
    expect(changes).toHaveLength(4)
  })

  // Protects Review Focus 1 and 5: a deleted test file is a lost-test, so deletion must be reported.
  test('a deleted file is reported as deleted', () => {
    const { cwd, base } = makeRepo({ 'gone.test.ts': 'x\n', 'stay.ts': 'y\n' })
    unlinkSync(join(cwd, 'gone.test.ts'))
    expect(changedFiles(base, cwd)).toEqual([{ path: 'gone.test.ts', status: 'deleted' }])
  })

  // Protects Review Focus 1: only added lines may need a header, so the line numbers must be exact.
  test('addedLines gives the line numbers of added lines only', () => {
    const { cwd, base } = makeRepo({ 'f.txt': 'a\nb\nc\nd\n' })
    write(cwd, 'f.txt', 'a\nNEW1\nb\nc\nNEW2\nNEW3\nd\n')
    expect([...addedLines(base, 'f.txt', cwd)].sort((x, y) => x - y)).toEqual([2, 5, 6])
  })

  // Protects Review Focus 1: every line of a new (even untracked) file counts as added.
  test('addedLines treats every line of a new or untracked file as added', () => {
    const { cwd, base } = makeRepo({ 'x.txt': 'x\n' })
    write(cwd, 'n.txt', 'a\nb\n')
    expect([...addedLines(base, 'n.txt', cwd)]).toEqual([1, 2])
  })

  // Protects the lost-test rule: a file new since base has no base text to compare with.
  test('fileAtBase returns null for a file that is new', () => {
    const { cwd, base } = makeRepo({ 'old.txt': 'hello\n' })
    write(cwd, 'new.txt', 'x\n')
    expect(fileAtBase(base, 'new.txt', cwd)).toBeNull()
    expect(fileAtBase(base, 'old.txt', cwd)).toBe('hello\n')
  })

  // Protects fail-closed behaviour: an unusable base must throw, never read as "no changes".
  test('changedFiles throws on a base that does not exist', () => {
    const { cwd } = makeRepo({ 'a.txt': '1\n' })
    expect(() => changedFiles('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', cwd)).toThrow()
  })
})
