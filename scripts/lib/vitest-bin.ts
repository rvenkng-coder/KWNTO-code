// Shared by run-breaks and run-probes: this repository's Vitest binary, and one Vitest run in a child process.
import { type ChildProcess, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Where a caller wants the run recorded: the child (so a signal handler can stop it) and its output.
export interface VitestSink {
  child: ChildProcess | null
  output: string
}

export function vitestBin(): string {
  const toolRoot = join(import.meta.dirname, '..', '..')
  const manifest = createRequire(join(toolRoot, 'package.json')).resolve('vitest/package.json') // "exports" hides the bin
  return join(dirname(manifest), 'vitest.mjs')
}

// Resolves to Vitest's exit code. With a sink, the child and its output are kept there; without one, the
// output is drained and dropped (it may hold messages and values that must not be shown).
export function spawnVitest(cwd: string, args: string[], sink?: VitestSink): Promise<number | null> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [vitestBin(), ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    if (sink) {
      sink.child = child
      sink.output = ''
      child.stdout.on('data', (chunk: Buffer) => {
        sink.output += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        sink.output += chunk.toString()
      })
    } else {
      child.stdout.resume()
      child.stderr.resume()
    }
    child.on('error', fail)
    child.on('close', (code, signal) => {
      if (sink) sink.child = null
      // Killed from outside is not a test failure; counting it as one would pass a weak test.
      if (signal !== null) fail(new Error(`vitest was stopped by ${signal}`))
      else done(code)
    })
  })
}
