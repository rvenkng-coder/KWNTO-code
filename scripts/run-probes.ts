// Runs a task's probes (docs/developer/test-plan-format.md, "Running the probes").
// node scripts/run-probes.ts [--cwd <dir>] <probe folder>
// Vitest's output is captured, never shown: only the row and kind of each failure are printed.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { isMain } from './lib/is-main.ts'
import { formatProbeSummary, summariseProbeRun } from './lib/probes.ts'
import { spawnVitest } from './lib/vitest-bin.ts'

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

// The probe files under the folder, as paths relative to cwd. They are passed to Vitest one by one:
// a folder given as a filter would also match siblings such as task-10 for task-1 (substring match).
function probeFiles(cwd: string, folder: string): string[] {
  const names = readdirSync(join(cwd, folder), { recursive: true }) as string[]
  return names
    .filter((name) => name.endsWith('.probe.test.ts'))
    .map((name) => join(folder, name))
    .sort()
}

async function runVitest(cwd: string, files: string[]): Promise<{ code: number | null; report: unknown }> {
  const reportDir = mkdtempSync(join(tmpdir(), 'run-probes-'))
  const reportPath = join(reportDir, 'report.json')
  try {
    const code = await spawnVitest(cwd, [
      'run',
      '--project',
      'probes',
      '--reporter=json',
      `--outputFile.json=${reportPath}`,
      ...files,
    ])
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
function findProbes(cwd: string, folder: string): string[] {
  const path = join(cwd, folder)
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`probe folder not found: ${folder}`)
  const files = probeFiles(cwd, folder)
  if (files.length === 0) throw new Error(`no *.probe.test.ts file in ${folder}`)
  return files
}

async function runFolder(cwd: string, folder: string): Promise<number> {
  const { code, report } = await runVitest(cwd, findProbes(cwd, folder))
  const summary = summariseProbeRun(report)
  console.log(formatProbeSummary(summary).join('\n'))
  const clean = summary.total > 0 && summary.passed === summary.total && summary.loadErrors === 0
  return clean && code === 0 ? 0 : 1
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args === null) {
    console.log(USAGE)
    return 1
  }
  try {
    return await runFolder(args.cwd, args.folder)
  } catch (error) {
    // Our own messages, or a bare filesystem error code: nothing Vitest printed is carried into an Error.
    const code = (error as { code?: unknown }).code
    const reason =
      error instanceof Error && !(typeof code === 'string')
        ? error.message
        : `cannot read the probe folder (${String(code ?? 'unknown')})`
    console.log(`run-probes: ${reason}`)
    return 1
  }
}

if (isMain(import.meta.filename)) process.exit(await main(process.argv.slice(2)))
