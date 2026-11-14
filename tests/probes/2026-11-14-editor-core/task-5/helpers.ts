import { createRequire } from 'node:module'

// Loads the content guard's pure parts for the task 5 probes (written from the Test plan only).
const require = createRequire(import.meta.url)

export type Guard = {
  GUARDED: string[]
  guardedTable: (name: string) => string
  changedFields: (names: string[], read: (n: string) => unknown, readOriginal: (n: string) => unknown) => string[]
  parseSentVersion: (value: unknown) => number | null
}

export const guard = require('../../../../backend/pb_hooks/lib/content-guard.js') as Guard

// Two records as plain objects, read the way the hook reads a PocketBase record.
export function readers(now: Record<string, unknown>, before: Record<string, unknown>): [(n: string) => unknown, (n: string) => unknown] {
  return [(n) => now[n], (n) => before[n]]
}
