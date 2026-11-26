// Runs one command for check:task: no shell, output captured, and the whole process group stopped at the
// deadline. A detached group is used (not spawnSync's timeout) because `npm run x` starts grandchildren
// (eslint, vitest, run-breaks) that a signal to npm alone would leave running; run-breaks must receive the
// signal itself to put a deliberate break back.
//
// One rule: a process group is stopped only through stopGroup (SIGTERM, then SIGKILL after the grace period),
// and stopGroup resolves only when no process of the group is left. runCommand, the runner's deadline
// backstop and the signal handler all wait on it. Once stopAll has been called (deadline backstop or signal),
// the run is closing and runCommand starts nothing more; nor does it start a command once the deadline has
// passed. So check:task never returns or exits with a command still running.
// Known residual: a process that stays in its group after SIGKILL (a zombie whose parent does not reap it) can
// delay the end of the run by up to the 60-second wait in stopGroup.
import { type ChildProcess, spawn } from 'node:child_process'

// notStarted is set when the command was refused (deadline passed or the run is closing); output says why.
export interface CommandResult {
  code: number | null
  timedOut: boolean
  output: string
  notStarted?: true
}
export interface CommandOptions {
  cwd: string
  deadlineMs: number
  now?: () => number
  graceMs?: number
}

export const GRACE_MS = 5_000
const POLL_MS = 25
// One run's state: its process groups (started and not yet known to be empty) and whether it is closing.
// openRun (called by runCheckTask at the start of every run) starts a fresh one, so a stopAll still finishing
// for an earlier run can never stop, or refuse, a command of the next.
interface RunState {
  closing: boolean
  groups: Set<number>
}
let current: RunState = { closing: false, groups: new Set() }

export function openRun(): void {
  current = { closing: false, groups: new Set() }
}

export function isClosing(): boolean {
  return current.closing
}

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
export async function stopGroup(
  pgid: number,
  graceMs: number = GRACE_MS,
  groups: Set<number> = current.groups,
): Promise<void> {
  if (signalGroup(pgid, 'SIGTERM') && !(await emptyWithin(pgid, graceMs))) {
    signalGroup(pgid, 'SIGKILL')
    await emptyWithin(pgid, 60_000) // SIGKILL cannot be ignored; this only waits for the kernel
  }
  groups.delete(pgid)
}

// Closes the run and stops every group still running (the deadline backstop, and check:task's own
// SIGINT/SIGTERM handler). Loops until no group is left, so a group added while it waits is stopped too.
export async function stopAll(graceMs: number = GRACE_MS): Promise<void> {
  const run = current
  run.closing = true
  while (run.groups.size > 0) await Promise.all([...run.groups].map((pgid) => stopGroup(pgid, graceMs, run.groups)))
}

const refused = (output: string): CommandResult => ({ code: null, timedOut: true, output, notStarted: true })

export function runCommand(command: string, args: string[], options: CommandOptions): Promise<CommandResult> {
  const { cwd, deadlineMs, now = Date.now, graceMs = GRACE_MS } = options
  if (deadlineMs <= now()) return Promise.resolve(refused('not run: time budget used'))
  const run = current
  if (run.closing) return Promise.resolve(refused('not run: check:task is stopping'))
  return new Promise((done) => {
    let output = ''
    let timedOut = false
    const child: ChildProcess = spawn(command, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const pgid = child.pid
    if (pgid !== undefined) run.groups.add(pgid)
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    const timer = setTimeout(
      () => {
        timedOut = true
        if (pgid !== undefined) void stopGroup(pgid, graceMs, run.groups)
      },
      Math.max(0, deadlineMs - now()),
    )
    let settled = false // a failed start can emit both 'error' and 'close'
    const finish = async (code: number | null, extra: string): Promise<void> => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // A command that exited may have left processes in its group; none outlives the step.
      if (pgid !== undefined) await stopGroup(pgid, graceMs, run.groups)
      done({ code, timedOut, output: output + extra })
    }
    child.on(
      'error',
      (error: NodeJS.ErrnoException) => void finish(null, `cannot start ${command}: ${error.code ?? error.message}`),
    )
    child.on('close', (code) => void finish(code, ''))
  })
}

// The last `count` lines of a command's output: enough to see why it failed, short enough to read.
export function lastLines(text: string, count: number): string[] {
  const lines = text.replace(/\s+$/, '').split('\n')
  if (lines.length === 1 && lines[0] === '') return []
  return lines.slice(-count)
}
