import { describe, expect, test } from 'vitest'
import { lastLines, runCommand } from './run-command.ts'

// check:task runs npm scripts and the break and probe runners through runCommand. These few tests start
// real (tiny) node processes, because killing a process group cannot be faked meaningfully.
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function goneWithin(pid: number, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((done) => setTimeout(done, 50))) {
    if (!alive(pid)) return true
  }
  return !alive(pid)
}

describe('runCommand', () => {
  // Protects: output and exit code are captured, with no shell between (the argument is passed as is).
  test('captures the output and the exit code without a shell', async () => {
    const result = await runCommand(process.execPath, ['-e', 'console.log(process.argv[1]); process.exit(3)', '$HOME; echo hi'], process.cwd(), Date.now() + 30_000)
    expect(result).toEqual({ code: 3, timedOut: false, output: '$HOME; echo hi\n' })
  })

  // Protects: a running command is killed at the deadline, grandchildren included (npm starts eslint, vitest).
  test('a command still running at the deadline is killed with its whole process group', { timeout: 20_000 }, async () => {
    const script = "const c = require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' }); console.log(c.pid); setTimeout(() => {}, 30000)"
    const started = Date.now()
    const result = await runCommand(process.execPath, ['-e', script], process.cwd(), Date.now() + 500)
    expect(result.timedOut).toBe(true)
    expect(Date.now() - started).toBeLessThan(10_000)
    const grandchild = Number(result.output.trim())
    expect(grandchild).toBeGreaterThan(0)
    expect(await goneWithin(grandchild, 2_000)).toBe(true)
  })

  // Protects: a command that cannot start is a failed result with a message, never a hang or a throw.
  test('a command that does not exist resolves with no exit code and a message', async () => {
    const result = await runCommand('no-such-command-check-task', [], process.cwd(), Date.now() + 30_000)
    expect(result.code).toBeNull()
    expect(result.output).toContain('cannot start no-such-command-check-task: ENOENT')
  })
})

describe('lastLines', () => {
  // Protects: a failing command's detail is its last 40 lines, so a long log does not bury the verdict.
  test('keeps only the last lines and drops trailing blank space', () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n') + '\n\n'
    const kept = lastLines(text, 40)
    expect(kept).toHaveLength(40)
    expect(kept[0]).toBe('line 61')
    expect(kept[39]).toBe('line 100')
    expect(lastLines('', 40)).toEqual([])
    expect(lastLines('one', 40)).toEqual(['one'])
  })
})
