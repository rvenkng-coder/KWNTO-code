// Readability limits on changed source files, or a read-only report on all of them.
// node scripts/check-changed-quality.ts [--base <sha>] | --report   (limits: eslint.quality.config.js)
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { type Change, changedFiles, repoRoot, resolveBase } from './lib/changed-files.ts'
import { isMain } from './lib/is-main.ts'

// Source folders that get the limits; tests (*.test.*, *.spec.*, tests/, e2e/) and dependencies never do.
export const QUALITY_PATHS = /^(?:frontend\/src|scripts|backend\/pb_hooks)\/(?!.*\.(?:test|spec)\.)(?!(?:.*\/)?node_modules\/).*\.(?:ts|tsx|js)$/

// Added, modified and renamed (under the new path) source files. A deleted file has nothing left to check.
export function filesToCheck(changes: Change[]): string[] {
  const paths = changes.filter((change) => change.status !== 'deleted' && QUALITY_PATHS.test(change.path)).map((change) => change.path)
  return [...new Set(paths)]
}

export interface Finding { file: string; rule: string; line: number }

// ESLint's `-f json` output. Anything that is not that shape is an error, never an empty report.
export function parseEslintJson(output: string): Finding[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new Error('ESLint did not return JSON output')
  }
  if (!Array.isArray(parsed)) throw new Error('ESLint JSON output is not a list')
  const findings: Finding[] = []
  for (const entry of parsed as { filePath?: unknown; messages?: unknown }[]) {
    if (typeof entry?.filePath !== 'string' || !Array.isArray(entry.messages)) throw new Error('ESLint JSON output has an unexpected shape')
    for (const message of entry.messages as { ruleId?: string | null; line?: number }[]) {
      findings.push({ file: entry.filePath, rule: message.ruleId ?? 'parse error', line: message.line ?? 0 })
    }
  }
  return findings
}

export function formatReport(findings: Finding[], root: string): string {
  const count = (key: (finding: Finding) => string): [string, number][] => {
    const counts = new Map<string, number>()
    for (const finding of findings) counts.set(key(finding), (counts.get(key(finding)) ?? 0) + 1)
    return [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  }
  const relative = (file: string): string => (file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file)
  const lines = [`quality report: ${findings.length} findings (information only, exit 0)`, '', 'per rule:']
  for (const [rule, n] of count((finding) => finding.rule)) lines.push(`  ${n}  ${rule}`)
  lines.push('', 'per file:')
  for (const [file, n] of count((finding) => relative(finding.file))) lines.push(`  ${n}  ${file}`)
  return lines.join('\n')
}

// The eslint of this repository and its config, wherever the checked repository is: run from the
// checked repository's root, so paths and ignores are relative to it.
function eslintCommand(): { bin: string; config: string } {
  const toolRoot = join(dirname(import.meta.filename), '..')
  const manifest = createRequire(join(toolRoot, 'package.json')).resolve('eslint/package.json') // "exports" hides bin/, package.json is exposed
  const bin = join(dirname(manifest), 'bin', 'eslint.js')
  return { bin, config: join(toolRoot, 'eslint.quality.config.js') }
}

// timeoutMs (optional, from check:task's budget): ESLint is killed when it runs out, and that is an error.
function runEslint(extra: string[], files: string[], cwd: string, timeoutMs?: number) {
  const { bin, config } = eslintCommand()
  const result = spawnSync(process.execPath, [bin, '--config', config, '--no-warn-ignored', ...extra, '--', ...files], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs })
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') throw new Error(`ESLint did not finish within the time budget (${String(timeoutMs)} ms)`)
  if (result.error) throw result.error
  return result
}

export function checkChanged(base: string, startDir: string = process.cwd(), timeoutMs?: number): { code: number; output: string } {
  const cwd = repoRoot(startDir)
  const files = filesToCheck(changedFiles(resolveBase(base, cwd), cwd))
  if (files.length === 0) return { code: 0, output: 'check:quality: no changed source files' }
  const result = runEslint([], files, cwd, timeoutMs)
  const output = `${result.stdout}${result.stderr}`.trim()
  if (result.status === 0) return { code: 0, output: 'check:quality: ok' }
  return { code: result.status ?? 1, output: output || 'check:quality: ESLint failed without output' }
}

// Every source file of the repository (tracked and untracked, not ignored), so old code is counted too.
export function qualityReport(startDir: string = process.cwd()): string {
  const cwd = repoRoot(startDir)
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr.trim()}`)
  const files = [...new Set(listed.stdout.split('\0').filter((path) => QUALITY_PATHS.test(path)))]
  if (files.length === 0) return 'quality report: no source files'
  const result = runEslint(['-f', 'json'], files, cwd)
  if (result.status !== 0 && result.status !== 1) throw new Error(`ESLint failed (exit ${result.status}): ${result.stderr.trim()}`)
  return formatReport(parseEslintJson(result.stdout), cwd)
}

function mergeBaseWithMain(): string {
  const result = spawnSync('git', ['merge-base', 'HEAD', 'main'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`cannot find the merge base with main (pass --base <sha>): ${result.stderr.trim()}`)
  return result.stdout.trim()
}

function parseArgs(args: string[]): { mode: 'check' | 'report'; base?: string } | null {
  if (args.length === 0) return { mode: 'check' }
  if (args.length === 1 && args[0] === '--report') return { mode: 'report' }
  if (args.length === 2 && args[0] === '--base' && args[1] !== '' && !args[1].startsWith('-')) return { mode: 'check', base: args[1] }
  return null
}

function cli(args: string[]): number {
  const parsed = parseArgs(args)
  if (parsed === null) {
    console.log('usage: node scripts/check-changed-quality.ts [--base <sha>] | --report')
    return 2
  }
  try {
    if (parsed.mode === 'report') {
      console.log(qualityReport())
      return 0
    }
    const { code, output } = checkChanged(parsed.base ?? mergeBaseWithMain())
    console.log(output)
    return code
  } catch (error) {
    console.log(`check:quality: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (isMain(import.meta.filename)) process.exit(cli(process.argv.slice(2)))
