import { BackendError, type BackendErrorKind } from '../../../../frontend/src/backend/errors'
import type { GuardedIO } from '../../../../frontend/src/backend/guarded'

// Fakes for the task 7 probes (written from the Test plan only): a GuardedIO whose writes
// answer from a script and which records every call.

export type Call = { op: 'read' } | { op: 'write'; body: Record<string, unknown>; version: number }

export function fail(kind: BackendErrorKind): BackendError {
  return new BackendError(kind, 0, {}, `fake ${kind}`)
}

// `writes` answers each write in turn (an error kind rejects, a number resolves with that
// version); `reads` answers each read in turn the same way. Past the end, the last answer repeats.
export function scriptedIO(
  writes: Array<BackendErrorKind | number>,
  reads: Array<BackendErrorKind | number>,
): { io: GuardedIO<{ version: number }>; calls: Call[] } {
  const calls: Call[] = []
  let w = 0
  let r = 0
  const answer = (step: BackendErrorKind | number | undefined) =>
    typeof step === 'number' ? Promise.resolve({ version: step }) : Promise.reject(fail(step ?? 'unknown'))
  return {
    calls,
    io: {
      read() {
        calls.push({ op: 'read' })
        return answer(reads[Math.min(r++, reads.length - 1)])
      },
      write(body, version) {
        calls.push({ op: 'write', body, version })
        return answer(writes[Math.min(w++, writes.length - 1)])
      },
    },
  }
}

export function writesOf(calls: Call[]): Array<Extract<Call, { op: 'write' }>> {
  return calls.filter((c): c is Extract<Call, { op: 'write' }> => c.op === 'write')
}
