import type { NewEntry, OutboxEntry } from './outbox'
import type { FailedEntry, OutboxStorage } from './outboxStorage'

// The browser's outbox (offline sync plan Task 4, D1): one IndexedDB database with the waiting
// entries and the failed ones. Every method is one transaction; `add` resolves only after the
// transaction's `complete` event, so an edit that was reported stored survives closing the tab.

export const OUTBOX_DB = 'kwnto-outbox'
const ENTRIES = 'entries'
const FAILED = 'failed'

interface FailedRow {
  seq: number
  userId: string
  entry: OutboxEntry
  message: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OUTBOX_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore(ENTRIES, { keyPath: 'seq', autoIncrement: true }).createIndex('byUser', 'userId')
      db.createObjectStore(FAILED, { keyPath: 'seq' }).createIndex('byUser', 'userId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the outbox.'))
  })
}

/** Runs `work` in one transaction over `stores`; resolves with its result after the transaction completed. */
async function transact<T>(
  db: Promise<IDBDatabase>,
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T> | null,
): Promise<T | undefined> {
  const tx = (await db).transaction(stores, mode)
  const request = work(tx)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = () => reject(tx.error ?? new Error('The outbox write failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('The outbox write was aborted.'))
  })
}

export function createIndexedDbOutbox(): OutboxStorage {
  const db = openDb()
  const bySeq = <T extends { seq?: number }>(rows: T[]): T[] => rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

  return {
    async list(userId) {
      const rows = await transact(db, [ENTRIES], 'readonly', (tx) =>
        tx.objectStore(ENTRIES).index('byUser').getAll(userId),
      )
      return bySeq((rows ?? []) as OutboxEntry[])
    },
    async add(entry: NewEntry) {
      const key = await transact(db, [ENTRIES], 'readwrite', (tx) => tx.objectStore(ENTRIES).add(entry))
      return Number(key)
    },
    async put(entry) {
      await transact(db, [ENTRIES], 'readwrite', (tx) => tx.objectStore(ENTRIES).put(entry))
    },
    async remove(seqs) {
      if (seqs.length === 0) return
      await transact(db, [ENTRIES], 'readwrite', (tx) => {
        for (const seq of seqs) tx.objectStore(ENTRIES).delete(seq)
        return null
      })
    },
    async fail(entry, message) {
      await transact(db, [ENTRIES, FAILED], 'readwrite', (tx) => {
        tx.objectStore(ENTRIES).delete(entry.seq)
        const row: FailedRow = { seq: entry.seq, userId: entry.userId, entry, message }
        return tx.objectStore(FAILED).put(row)
      })
    },
    async failed(userId): Promise<FailedEntry[]> {
      const rows = await transact(db, [FAILED], 'readonly', (tx) =>
        tx.objectStore(FAILED).index('byUser').getAll(userId),
      )
      return bySeq((rows ?? []) as FailedRow[]).map((r) => ({ entry: r.entry, message: r.message }))
    },
    async dismiss(seq) {
      await transact(db, [FAILED], 'readwrite', (tx) => {
        tx.objectStore(FAILED).delete(seq)
        return null
      })
    },
  }
}
