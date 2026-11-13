// Runs one command for check:task: no shell, output captured, and the whole process group stopped at the
// deadline. A detached group is used (not spawnSync's timeout) because `npm run x` starts grandchildren
// (eslint, vitest, run-breaks) that a signal to npm alone would leave running; run-breaks must receive the
// signal itself to put a deliberate break back.
//
// One rule: a process group is stopped only through stopGroup (SIGTERM, then SIGKILL after the grace period),
// and stopGroup resolves only when no process of the group is left. runCommand, the runner's deadline
// backstop and the signal handler all wait on it, so check:task never returns or exits with a step still running.
import { type ChildProcess, spawn } from 'node:child_process'

export interface CommandResult { code: number | null; timedOut: boolean; output: string }
export interface CommandOptions { cwd: string; deadlineMs: number; now?: () => number; graceMs?: number }

export const GRACE_MS = 5_000
const POLL_MS = 25
const groups = new Set<number>() // process group ids started here and not yet known to be empty

function signalGroup(pgid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pgid, signal)
    return true
  } catch {
    return false // ESRCH: no process is left in the group
  }
}

async function emptyWithin(pgid: number, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end;) {
    if (!signalGroup(pgid, 0)) return true
    await new Promise((done) => setTimeout(done, POLL_MS))
  }
  return !signalGroup(pgid, 0)
}

// SIGTERM, wait up to the grace period, then SIGKILL and wait until the group is gone.
export async function stopGroup(pgid: number, graceMs: number = GRACE_MS): Promise<void> {
  if (signalGroup(pgid, 'SIGTERM') && !(await emptyWithin(pgid, graceMs))) {
    signalGroup(pgid, 'SIGKILL')
    await emptyWithin(pgid, 60_000) // SIGKILL cannot be ignored; this only waits for the kernel
  }
  groups.delete(pgid)
}

// Stops every group still running (the deadline backstop, and check:task's own SIGINT/SIGTERM handler).
export async function stopAll(graceMs: number = GRACE_MS): Promise<void> {
  await Promise.all([...groups].map((pgid) => stopGroup(pgid, graceMs)))
}

export function runCommand(command: string, args: string[], options: CommandOptions): Promise<CommandResult> {
  const { cwd, deadlineMs, now = Date.now, graceMs = GRACE_MS } = options
  return new Promise((done) => {
    let output = ''
    let timedOut = false
    const child: ChildProcess = spawn(command, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const pgid = child.pid
    if (pgid !== undefined) groups.add(pgid)
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    const timer = setTimeout(() => {
      timedOut = true
      if (pgid !== undefined) void stopGroup(pgid, graceMs)
    }, Math.max(0, deadlineMs - now()))
    let settled = false // a failed start can emit both 'error' and 'close'
    const finish = async (code: number | null, extra: string): Promise<void> => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // A command that exited may have left processes in its group; none outlives the step.
      if (pgid !== undefined) await stopGroup(pgid, graceMs)
      done({ code, timedOut, output: output + extra })
    }
    child.on('error', (error: NodeJS.ErrnoException) => void finish(null, `cannot start ${command}: ${error.code ?? error.message}`))
    child.on('close', (code) => void finish(code, ''))
  })
}

// The last `count` lines of a command's output: enough to see why it failed, short enough to read.
export function lastLines(text: string, count: number): string[] {
  const lines = text.replace(/\s+$/, '').split('\n')
  if (lines.length === 1 && lines[0] === '') return []
  return lines.slice(-count)
}
