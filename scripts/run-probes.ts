// Runs a task's probes (docs/developer/test-plan-format.md, "Running the probes").
// node scripts/run-probes.ts [--cwd <dir>] <probe folder>
// Vitest's output is captured, never shown: only the row and kind of each failure are printed.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isMain } from './lib/is-main.ts'
import { formatProbeSummary, summariseProbeRun } from './lib/probes.ts'

const USAGE = 'usage: node scripts/run-probes.ts [--cwd <dir>] <probe folder>'

export function parseArgs(argv: string[]): { cwd: string; folder: string } | null {
  const rest = [...argv]
  let cwd = process.cwd()
  const at = rest.indexOf('--cwd')
  if (at !== -1) {
    if (at + 1 >= rest.length) return null
    cwd = resolve(rest[at + 1])
    rest.splice(at, 2)
  }
  if (rest.length !== 1 || rest[0].startsWith('-')) return null
  return { cwd, folder: rest[0] }
}

function vitestBin(): string {
  const toolRoot = join(import.meta.dirname, '..')
  const manifest = createRequire(join(toolRoot, 'package.json')).resolve('vitest/package.json') // "exports" hides the bin
  return join(dirname(manifest), 'vitest.mjs')
}

// Resolves to Vitest's exit code. Its stdout and stderr are drained and dropped: they hold messages and values.
function spawnVitest(cwd: string, args: string[]): Promise<number | null> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [vitestBin(), ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.resume()
    child.stderr.resume()
    child.on('error', fail)
    child.on('close', (code, signal) => {
      if (signal !== null) fail(new Error(`vitest was stopped by ${signal}`))
      else done(code)
    })
  })
}

function hasProbeFile(folder: string): boolean {
  return (readdirSync(folder, { recursive: true }) as string[]).some((name) => name.endsWith('.probe.test.ts'))
}

async function runVitest(cwd: string, folder: string): Promise<{ code: number | null; report: unknown }> {
  const reportDir = mkdtempSync(join(tmpdir(), 'run-probes-'))
  const reportPath = join(reportDir, 'report.json')
  try {
    const code = await spawnVitest(cwd, ['run', '--project', 'probes', '--reporter=json', `--outputFile.json=${reportPath}`, folder])
    let report: unknown
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'))
    } catch {
      throw new Error('vitest wrote no readable test report')
    }
    return { code, report }
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}

// A folder that is missing, not a folder, or holds no probe file is a reason to fail, never an empty pass.
function folderProblem(path: string, folder: string): string | null {
  if (!existsSync(path) || !statSync(path).isDirectory()) return `probe folder not found: ${folder}`
  return hasProbeFile(path) ? null : `no *.probe.test.ts file in ${folder}`
}

async function runFolder(cwd: string, folder: string): Promise<number> {
  const { code, report } = await runVitest(cwd, folder)
  const summary = summariseProbeRun(report)
  console.log(formatProbeSummary(summary).join('\n'))
  const clean = summary.total > 0 && summary.passed === summary.total && summary.loadErrors === 0
  return clean && code === 0 ? 0 : 1
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args === null) { console.log(USAGE); return 1 }
  const problem = folderProblem(join(args.cwd, args.folder), args.folder)
  if (problem !== null) { console.log(`run-probes: ${problem}`); return 1 }
  try {
    return await runFolder(args.cwd, args.folder)
  } catch (error) {
    // Only our own messages: nothing Vitest printed is carried into an Error.
    console.log(`run-probes: ${error instanceof Error ? error.message : 'failed'}`)
    return 1
  }
}

if (isMain(import.meta.filename)) process.exit(await main(process.argv.slice(2)))
