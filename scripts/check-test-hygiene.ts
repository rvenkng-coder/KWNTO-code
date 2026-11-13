// Test hygiene: new tests carry a header comment, nothing is skipped or focused, and no test
// or assertion is lost against the base commit. node scripts/check-test-hygiene.ts [--base <sha>]
// Line-based and deliberately conservative: false positives are acceptable, false negatives are not.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addedLines, changedFiles, fileAtBase, repoRoot } from './lib/changed-files.ts'
import { countExpects, findDeclarations } from './lib/test-declarations.ts'

export interface HygieneProblem { file: string; rule: 'header' | 'skipped' | 'focused' | 'lost-test' | 'lost-assertion'; detail: string }

const SKIPPED = /\.skip(?:If)?\b|\bxit\b|\bxtest\b|\bxdescribe\b|\.fixme\b|\.todo\b|\.runIf\b|\.fails?\b|\bskip\s*\(|\b(?:skip|todo)\s*:\s*true|\[\s*['"`](?:skip|fixme|todo)['"`]/
const FOCUSED = /\.only\b|\bfdescribe\b|\bfit\s*\(|\bftest\s*\(|\bonly\s*:\s*true|\[\s*['"`]only['"`]/

export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
}

export function checkSource(path: string, source: string, added: Set<number> | null): HygieneProblem[] {
  if (!isTestFile(path)) return []
  const problems: HygieneProblem[] = []
  const rows = source.split('\n')
  rows.forEach((row, index) => {
    const n = index + 1
    const skip = SKIPPED.exec(row)
    if (skip) problems.push({ file: path, rule: 'skipped', detail: `line ${n}: "${skip[0].trim()}" disables a test` })
    const focus = FOCUSED.exec(row)
    if (focus) problems.push({ file: path, rule: 'focused', detail: `line ${n}: "${focus[0].trim()}" runs only some tests` })
  })
  for (const { line } of findDeclarations(source)) {
    if (added !== null && !added.has(line)) continue
    const above = line > 1 ? rows[line - 2].trim() : ''
    if (!(above.startsWith('//') || above.endsWith('*/'))) {
      problems.push({ file: path, rule: 'header', detail: `line ${line}: new test has no comment directly above it (// Protects: ...)` })
    }
  }
  return problems.sort((x, y) => Number(/line (\d+)/.exec(x.detail)?.[1]) - Number(/line (\d+)/.exec(y.detail)?.[1]))
}

function declarations(source: string): { count: number; titles: Map<string, number> } {
  const found = findDeclarations(source)
  const titles = new Map<string, number>()
  for (const { title } of found) if (title !== null) titles.set(title, (titles.get(title) ?? 0) + 1)
  return { count: found.length, titles }
}

const assertionCount = countExpects

export function compareWithBase(path: string, baseSource: string, headSource: string): HygieneProblem[] {
  if (!isTestFile(path)) return []
  const problems: HygieneProblem[] = []
  const base = declarations(baseSource)
  const head = declarations(headSource)
  if (head.count < base.count) {
    problems.push({ file: path, rule: 'lost-test', detail: `${base.count} tests at base, ${head.count} now` })
  }
  for (const [title, baseCount] of base.titles) {
    if ((head.titles.get(title) ?? 0) < baseCount) {
      problems.push({ file: path, rule: 'lost-test', detail: `test "${title}" is gone (removed, or renamed: the reviewer decides)` })
    }
  }
  const [before, now] = [assertionCount(baseSource), assertionCount(headSource)]
  if (now < before) problems.push({ file: path, rule: 'lost-assertion', detail: `${before} expect( calls at base, ${now} now` })
  return problems
}

export function checkHygiene(base: string, startDir: string = process.cwd()): HygieneProblem[] {
  const cwd = repoRoot(startDir)
  const problems: HygieneProblem[] = []
  for (const change of changedFiles(base, cwd)) {
    const oldPath = change.oldPath ?? change.path
    const baseSource = change.status === 'added' ? null : fileAtBase(base, oldPath, cwd)
    if (change.status !== 'added' && baseSource === null && isTestFile(oldPath)) {
      throw new Error(`cannot read ${oldPath} at ${base}`)
    }
    if (change.status === 'deleted' || (change.status === 'renamed' && !isTestFile(change.path))) {
      if (baseSource !== null && isTestFile(oldPath)) {
        for (const title of declarationsAsList(baseSource)) {
          problems.push({ file: oldPath, rule: 'lost-test', detail: `${title} was deleted with its file` })
        }
      }
      continue
    }
    if (!isTestFile(change.path)) continue
    const head = readFileSync(join(cwd, change.path), 'utf8')
    problems.push(...checkSource(change.path, head, addedLines(base, change.path, cwd)))
    if (baseSource !== null) problems.push(...compareWithBase(change.path, baseSource, head))
  }
  return problems
}

function declarationsAsList(source: string): string[] {
  const { count, titles } = declarations(source)
  const list = [...titles].flatMap(([title, n]) => Array<string>(n).fill(`test "${title}"`))
  for (let i = list.length; i < count; i++) list.push('a test (title not readable)')
  return list
}

if (import.meta.filename === process.argv[1]) {
  const args = process.argv.slice(2)
  if (!(args.length === 0 || (args.length === 2 && args[0] === '--base' && args[1] !== ''))) {
    console.log('usage: node scripts/check-test-hygiene.ts [--base <sha>]')
    process.exit(2)
  }
  try {
    let base = args[1]
    if (!base) {
      const result = spawnSync('git', ['merge-base', 'HEAD', 'main'], { encoding: 'utf8' })
      if (result.status !== 0) throw new Error(`cannot find the merge base with main (pass --base <sha>): ${result.stderr.trim()}`)
      base = result.stdout.trim()
    }
    const problems = checkHygiene(base)
    if (problems.length > 0) {
      console.log(problems.map((problem) => `${problem.file}: ${problem.rule}: ${problem.detail}`).join('\n'))
      process.exit(1)
    }
    console.log('check:hygiene: ok')
  } catch (error) {
    console.log(`check:hygiene: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
