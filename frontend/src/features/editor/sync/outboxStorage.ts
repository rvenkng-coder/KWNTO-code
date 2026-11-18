import type { NewEntry, OutboxEntry } from './outbox'

// Where waiting entries live. The browser's IndexedDB version is in indexedDbOutbox.ts; the
// memory version here is the one tests and `directSync` use.

export interface FailedEntry { entry: OutboxEntry; message: string }
export interface OutboxStorage {
  list(userId: string): Promise<OutboxEntry[]>
  add(entry: NewEntry): Promise<number>
  put(entry: OutboxEntry): Promise<void>
  remove(seqs: number[]): Promise<void>
  fail(entry: OutboxEntry, message: string): Promise<void>
  failed(userId: string): Promise<FailedEntry[]>
  dismiss(seq: number): Promise<void>
}

export function createMemoryOutbox(): OutboxStorage {
  let nextSeq = 1
  let entries: OutboxEntry[] = []
  let failed: FailedEntry[] = []
  return {
    list: async (userId) => entries.filter((e) => e.userId === userId).sort((a, b) => a.seq - b.seq),
    add: async (entry) => {
      const seq = nextSeq++
      entries.push({ ...entry, seq } as OutboxEntry)
      return seq
    },
    put: async (entry) => { entries = entries.map((e) => (e.seq === entry.seq ? entry : e)) },
    remove: async (seqs) => { entries = entries.filter((e) => !seqs.includes(e.seq)) },
    fail: async (entry, message) => {
      entries = entries.filter((e) => e.seq !== entry.seq)
      failed.push({ entry, message })
    },
    failed: async (userId) => failed.filter((f) => f.entry.userId === userId).sort((a, b) => a.entry.seq - b.entry.seq),
    dismiss: async (seq) => { failed = failed.filter((f) => f.entry.seq !== seq) },
  }
}
