// Runs one command for check:task: no shell, output captured, and the whole process group stopped at the
// deadline. A detached group is used (not spawnSync's timeout) because `npm run x` starts grandchildren
// (eslint, vitest, run-breaks) that a signal to npm alone would leave running; run-breaks must receive the
// signal itself to put a deliberate break back.
import { type ChildProcess, spawn } from 'node:child_process'

export interface CommandResult { code: number | null; timedOut: boolean; output: string }

const GRACE_MS = 5_000
const running = new Set<ChildProcess>()

function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    // The group is already gone.
  }
}

// Used by check:task's own SIGINT/SIGTERM handler, so a Ctrl-C reaches the commands it started.
export function stopAll(signal: NodeJS.Signals = 'SIGTERM'): void {
  for (const child of running) signalGroup(child, signal)
}

export function runCommand(command: string, args: string[], cwd: string, deadlineMs: number, now: () => number = Date.now): Promise<CommandResult> {
  return new Promise((done) => {
    let output = ''
    let timedOut = false
    const child = spawn(command, args, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    running.add(child)
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })
    let hardKill: NodeJS.Timeout | undefined
    const timer = setTimeout(() => {
      timedOut = true
      signalGroup(child, 'SIGTERM')
      hardKill = setTimeout(() => signalGroup(child, 'SIGKILL'), GRACE_MS)
    }, Math.max(0, deadlineMs - now()))
    let settled = false // a failed start can emit both 'error' and 'close'
    const finish = (code: number | null, extra: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(hardKill)
      running.delete(child)
      done({ code, timedOut, output: output + extra })
    }
    child.on('error', (error: NodeJS.ErrnoException) => finish(null, `cannot start ${command}: ${error.code ?? error.message}`))
    child.on('close', (code) => finish(code, ''))
  })
}

// The last `count` lines of a command's output: enough to see why it failed, short enough to read.
export function lastLines(text: string, count: number): string[] {
  const lines = text.replace(/\s+$/, '').split('\n')
  if (lines.length === 1 && lines[0] === '') return []
  return lines.slice(-count)
}
