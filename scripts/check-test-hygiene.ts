// Test hygiene: new tests carry a header comment, nothing is skipped or focused, and no test
// or assertion is lost against the base commit. node scripts/check-test-hygiene.ts [--base <sha>]
// Reads test files with the TypeScript parser, backed by raw-text checks; deliberately conservative: false positives are acceptable, false negatives are not.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addedLines, changedFiles, fileAtBase, repoRoot, resolveBase } from './lib/changed-files.ts'
import { isMain } from './lib/is-main.ts'
import { parseTestFile } from './lib/test-ast.ts'
import { countRawDeclarations, countRawExpects, rawHeaderLines } from './lib/test-raw.ts'

export interface HygieneProblem { file: string; rule: 'header' | 'scan' | 'skipped' | 'focused' | 'lost-test' | 'lost-assertion'; detail: string }

const SKIPPED = /\.skip(?:If)?\b|\bxit\b|\bxtest\b|\bxdescribe\b|\.fixme\b|\.todo\b|\.runIf\b|\.fails?\b|\bskip\s*\(|['"`]?\b(?:skip|todo|fails)['"`]?\s*:|\[\s*['"`](?:skip|fixme|todo)['"`]/
const FOCUSED = /\.only\b|\bfdescribe\b|\bfit\s*\(|\bftest\s*\(|['"`]?\bonly['"`]?\s*:|\[\s*['"`]only['"`]/

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
  const parsed = parseTestFile(path, source)
  const found = new Map<number, string>() // line -> what is wrong; the parser view (trusted only if the file parsed) and the raw view
  if (!parsed.ok) {
    problems.push({ file: path, rule: 'scan', detail: `${parsed.error ?? 'line 1: syntax error'}; cannot scan this file reliably` })
  } else {
    for (const { line, headerProblem } of parsed.declarations) if (headerProblem !== null) found.set(line, headerProblem)
  }
  for (const line of rawHeaderLines(source)) if (!found.has(line)) found.set(line, 'has no comment directly above it (// Protects: ...)')
  for (const [line, why] of found) {
    if (added === null || added.has(line)) problems.push({ file: path, rule: 'header', detail: `line ${line}: new test ${why}` })
  }
  return problems.sort((x, y) => Number(/line (\d+)/.exec(x.detail)?.[1]) - Number(/line (\d+)/.exec(y.detail)?.[1]))
}

export function compareWithBase(path: string, baseSource: string, headSource: string): HygieneProblem[] {
  if (!isTestFile(path)) return []
  const problems: HygieneProblem[] = []
  const base = parseTestFile(path, baseSource)
  const head = parseTestFile(path, headSource)
  const trusted = base.ok && head.ok // with a syntax error on either side only the raw counts are used
  const [baseRaw, headRaw] = [countRawDeclarations(baseSource), countRawDeclarations(headSource)]
  const countDropped = trusted && head.declarations.length < base.declarations.length
  if (countDropped) {
    problems.push({ file: path, rule: 'lost-test', detail: `${base.declarations.length} tests at base, ${head.declarations.length} now` })
  } else if (headRaw < baseRaw) {
    problems.push({ file: path, rule: 'lost-test', detail: `${baseRaw} test-like calls at base, ${headRaw} now (raw text count)` })
  }
  if (trusted) {
    const count = (keys: string[]): Map<string, number> => keys.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map<string, number>())
    const headKeys = count(head.declarations.map((d) => d.key))
    for (const [key, baseCount] of count(base.declarations.map((d) => d.key))) {
      if ((headKeys.get(key) ?? 0) >= baseCount || (key.startsWith('\u0000') && countDropped)) continue
      const what = key.startsWith('\u0000') ? `a test titled by \`${key.slice(1)}\`` : `test "${key}"`
      problems.push({ file: path, rule: 'lost-test', detail: `${what} is gone (removed, or renamed: the reviewer decides)` })
    }
  }
  const [before, now] = trusted ? [base.expects, head.expects] : [Infinity, 0]
  const [rawBefore, rawNow] = [countRawExpects(baseSource), countRawExpects(headSource)]
  if (trusted && now < before) problems.push({ file: path, rule: 'lost-assertion', detail: `${before} expect( calls at base, ${now} now` })
  else if (rawNow < rawBefore) problems.push({ file: path, rule: 'lost-assertion', detail: `${rawBefore} expect( calls at base, ${rawNow} now (raw text count)` })
  return problems
}

export function checkHygiene(baseRef: string, startDir: string = process.cwd()): HygieneProblem[] {
  const cwd = repoRoot(startDir)
  const base = resolveBase(baseRef, cwd) // one sha, so no later git call sees the user's text
  const problems: HygieneProblem[] = []
  for (const change of changedFiles(base, cwd)) {
    const oldPath = change.oldPath ?? change.path
    const baseSource = change.status === 'added' ? null : fileAtBase(base, oldPath, cwd)
    if (change.status !== 'added' && baseSource === null && isTestFile(oldPath)) {
      throw new Error(`cannot read ${oldPath} at ${base}`)
    }
    if (change.status === 'deleted' || (change.status === 'renamed' && !isTestFile(change.path))) {
      if (baseSource !== null && isTestFile(oldPath)) {
        for (const title of declarationsAsList(oldPath, baseSource)) {
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

function declarationsAsList(path: string, source: string): string[] {
  const parsed = parseTestFile(path, source)
  if (!parsed.ok) return Array<string>(countRawDeclarations(source)).fill('a test (file does not parse)')
  return parsed.declarations.map((d) => (d.title === null ? 'a test (title not readable)' : `test "${d.title}"`))
}

if (isMain(import.meta.filename)) {
  const args = process.argv.slice(2)
  if (!(args.length === 0 || (args.length === 2 && args[0] === '--base' && args[1] !== '' && !args[1].startsWith('-')))) {
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
