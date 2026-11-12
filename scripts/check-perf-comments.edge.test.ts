import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { findBadPerfComments } from './check-perf-comments.ts'

// Edge cases for the PERF: comment check (issue #4). A check that silently misses a bad
// PERF: comment defeats docs/engineering.md section 1, so each case below pins one way a
// plausible-but-wrong implementation goes wrong.

// Protects: a complete note directly above a bad one must not hide the bad one.
test('two PERF notes in one run of // lines are judged separately', () => {
  expect(findBadPerfComments('// PERF: What: a. Why: b. Trade-off: c.\n// PERF: fast')).toEqual([2])
})

// Protects: the reported line is where PERF: is, not where the block comment ends.
test('multi-line block comment reports the line of PERF:', () => {
  expect(findBadPerfComments('x()\n/*\n * PERF: What: a. Why: b.\n */')).toEqual([3])
})

// Protects: the three parts may be spread across the lines of one block comment.
test('multi-line block comment with all three parts passes', () => {
  expect(findBadPerfComments('/*\n * PERF: What: a.\n * Why: b.\n * Trade-off: c.\n */')).toEqual([])
})

// Protects: a comment that follows code on the same line is still judged.
test('trailing comment after code is judged', () => {
  expect(findBadPerfComments('const a = 1 // PERF: quick')).toEqual([1])
})

// Protects: ordinary comments are none of this check's business.
test('comments without PERF: are ignored', () => {
  expect(findBadPerfComments('// just a note\n/* another */')).toEqual([])
})

// Protects: an unrelated // line after a complete note joins that comment, and cannot
// make it fail.
test('a complete note followed by an unrelated // line passes', () => {
  expect(
    findBadPerfComments('// PERF: What: a.\n// Why: b.\n// Trade-off: c.\n// unrelated'),
  ).toEqual([])
})

// Protects: empty input does not crash or report anything.
test('empty source returns no problems', () => {
  expect(findBadPerfComments('')).toEqual([])
})

// Command-line mode: protects the lint step, which relies on the exit code and the
// path:line message, and on finding nested folders and .tsx files.
const script = resolve(import.meta.dirname, 'check-perf-comments.ts')
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function runIn(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'perf-check-'))
  dirs.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return spawnSync('node', [script], { cwd: root, encoding: 'utf8' })
}

// Protects: a bad note in a nested .tsx file fails the run and names file and line.
test('CLI exits 1 and prints path:line for a bad note in a nested .tsx file', () => {
  const result = runIn({ 'src/features/a/B.tsx': 'x()\n// PERF: fast\n' })
  expect(result.status).toBe(1)
  expect(result.stdout).toContain(join('src', 'features', 'a', 'B.tsx') + ':2 PERF comment needs')
})

// Protects: a clean tree (including a good note) exits 0 so lint passes.
test('CLI exits 0 on a clean tree', () => {
  const result = runIn({
    'src/a.ts': '// PERF: What: a. Why: b. Trade-off: c.\n',
    'src/deep/b.tsx': 'const x = 1\n',
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toBe('')
})
