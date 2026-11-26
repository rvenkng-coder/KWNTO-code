import type { Backend, ContentKind, ContentRecords } from '../../../backend'
import type { BackendError } from '../../../backend/errors'
import type { NewEntry, OutboxEntry } from './outbox'
import type { FailedEntry, OutboxStorage } from './outboxStorage'
import type { TabMessage } from './syncAnswers'

// The types of the sync engine (offline sync plan Task 3); syncEngine.ts re-exports them.

export type SyncDoor = Pick<Backend['content'], 'get' | 'create' | 'update' | 'remove'>
export interface PendingConflict {
  entry: OutboxEntry
  server: ContentRecords[ContentKind] | null
  fields: string[]
  deleted: boolean
}
export interface SyncSnapshot {
  online: boolean
  owner: boolean
  waiting: number
  sendingSeq: number | null
  failed: FailedEntry[]
  conflict: PendingConflict | null
  entries: OutboxEntry[]
}
export interface SyncHooks {
  saved(entry: OutboxEntry, record: ContentRecords[ContentKind] | null): void
  refused(entry: OutboxEntry, error: BackendError): void
  theirs(entry: OutboxEntry, server: ContentRecords[ContentKind] | null): void
}
export interface SyncDeps {
  userId: string
  door: SyncDoor
  storage: OutboxStorage
  hooks: SyncHooks
  clock: { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
  lock(name: string, run: () => Promise<void>): Promise<void>
  /** Refreshes the session; false when it has ended (the sign-in is then needed before anything is sent). */
  refreshSession?: () => Promise<boolean>
  channel: { post(message?: TabMessage): void; listen(fn: (message?: TabMessage) => void): () => void }
}
/** What a caller gives `add`: the engine fills the user, the offline flag and the time. */
export type EngineEntry = NewEntry extends infer E
  ? E extends NewEntry
    ? Omit<E, 'userId' | 'offline' | 'made'>
    : never
  : never
export interface SyncEngine {
  start(): void
  stop(): Promise<void>
  /** Resolves with the seq once stored; 0 when the edit cancelled waiting work and nothing was stored. */
  add(entry: EngineEntry): Promise<number>
  setOnline(online: boolean): void
  /** When online and an entry waits on the backoff: send it now and start the backoff again from its first step. */
  retryNow(): void
  resolve(choice: 'mine' | 'theirs'): Promise<void>
  dismiss(seq: number): Promise<void>
  snapshot(): SyncSnapshot
  subscribe(listener: (s: SyncSnapshot) => void): () => void
}
