import type { Backend, ContentKind, ContentRecords } from '../../../backend'
import { BackendError } from '../../../backend/errors'
import { planAdd, type NewEntry, type OutboxEntry } from './outbox'
import { nextDelay } from './outboxText'
import type { FailedEntry, OutboxStorage } from './outboxStorage'
import { mineEntry, theirsEntry } from './syncResolve'
import { createSender, type Outcome } from './syncSend'

// The one loop that sends outbox entries (offline sync plan Task 3, D2, D7 to D9, D12): in seq
// order, one request at a time, only in the tab holding the Web Lock, backing off while the
// server cannot be reached. Everything it touches is injected.

export const LOCK_PREFIX = 'kwnto-sync-'
const NO_COPY = 'The record was deleted and no copy of your change is left to restore it.'

export type SyncDoor = Pick<Backend['content'], 'get' | 'create' | 'update' | 'remove'>
export interface PendingConflict { entry: OutboxEntry; server: ContentRecords[ContentKind] | null; fields: string[]; deleted: boolean }
export interface SyncSnapshot {
  online: boolean; owner: boolean; waiting: number; sendingSeq: number | null
  failed: FailedEntry[]; conflict: PendingConflict | null; entries: OutboxEntry[]
}
export interface SyncHooks {
  saved(entry: OutboxEntry, record: ContentRecords[ContentKind] | null): void
  refused(entry: OutboxEntry, error: BackendError): void
  theirs(entry: OutboxEntry, server: ContentRecords[ContentKind] | null): void
}
export interface SyncDeps {
  userId: string; door: SyncDoor; storage: OutboxStorage; hooks: SyncHooks
  clock: { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
  lock(name: string, run: () => Promise<void>): Promise<void>
  channel: { post(message?: Answer): void; listen(fn: (message?: Answer) => void): () => void }
}
/** What happened to one outbox entry. The tab that sends tells every tab, because each tab holds the promises of its own edits. */
export type Answer =
  | { seq: number; type: 'saved'; record: ContentRecords[ContentKind] | null }
  | { seq: number; type: 'refused'; message: string }
  | { seq: number; type: 'theirs'; server: ContentRecords[ContentKind] | null }
/** What a caller gives `add`: the engine fills the user, the offline flag and the time. */
export type EngineEntry = NewEntry extends infer E ? (E extends NewEntry ? Omit<E, 'userId' | 'offline' | 'made'> : never) : never
export interface SyncEngine {
  start(): void
  stop(): Promise<void>
  /** Resolves with the seq once stored; 0 when the edit cancelled waiting work and nothing was stored. */
  add(entry: EngineEntry): Promise<number>
  setOnline(online: boolean): void
  resolve(choice: 'mine' | 'theirs'): Promise<void>
  dismiss(seq: number): Promise<void>
  snapshot(): SyncSnapshot
  subscribe(listener: (s: SyncSnapshot) => void): () => void
}

class Engine implements SyncEngine {
  private queue: OutboxEntry[] = []
  private failed: FailedEntry[] = []
  private netOnline = true
  private serverDown = false
  private owner = false
  private stopped = false
  private started = false
  private sendingSeq: number | null = null
  private adding = 0
  // The edits this tab made that have no answer yet, by seq: their promises live in this tab.
  private mine = new Map<number, OutboxEntry>()
  private conflict: PendingConflict | null = null
  private attempt = 0
  private timer: unknown = null
  private chain: Promise<unknown> = Promise.resolve()
  private release: (() => void) | null = null
  private lockDone: Promise<void> = Promise.resolve()
  private loop: Promise<void> | null = null
  private again = false
  private unlisten: (() => void) | null = null
  private listeners = new Set<(s: SyncSnapshot) => void>()
  private current: SyncSnapshot
  private send: (entry: OutboxEntry) => Promise<Outcome>

  private deps: SyncDeps

  constructor(deps: SyncDeps) {
    this.deps = deps
    this.send = createSender(deps.door)
    this.current = this.build()
  }

  snapshot = (): SyncSnapshot => this.current

  subscribe = (listener: (s: SyncSnapshot) => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private build(): SyncSnapshot {
    return {
      online: this.netOnline && !this.serverDown, owner: this.owner, waiting: this.queue.length + this.adding, sendingSeq: this.sendingSeq,
      failed: this.failed, conflict: this.conflict, entries: this.queue,
    }
  }

  private publish(): void {
    this.current = this.build()
    for (const listener of this.listeners) listener(this.current)
  }

  private async refresh(): Promise<void> {
    this.queue = await this.deps.storage.list(this.deps.userId)
    this.failed = await this.deps.storage.failed(this.deps.userId)
    this.publish()
  }

  /** Storage work never interleaves: adds, picks and bookkeeping run one after another. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn)
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.unlisten = this.deps.channel.listen((message) => {
      this.refreshQuietly().then(() => {
        if (message !== undefined) this.receive(message)
        this.wake()
      })
    })
    void this.refreshQuietly()
    this.lockDone = this.deps.lock(LOCK_PREFIX + this.deps.userId, () => this.holdLock())
  }

  // Background reads must not raise an unhandled rejection: a closing page loses its IndexedDB connection, the entries stay stored.
  private refreshQuietly(): Promise<void> {
    return this.exclusive(() => this.refresh()).catch(() => undefined)
  }

  private holdLock(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    this.owner = true
    this.publish()
    this.wake()
    return new Promise<void>((resolve) => {
      this.release = resolve
    }).then(() => {
      this.owner = false
      this.publish()
    })
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearTimer()
    this.unlisten?.()
    this.release?.()
    await this.loop
    if (this.owner || this.release !== null) await this.lockDone
  }

  setOnline(online: boolean): void {
    this.netOnline = online
    this.clearTimer()
    if (online) {
      this.attempt = 0
      this.wake()
    }
    this.publish()
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer)
    this.timer = null
  }

  // Tells this tab's store and, through the channel, every other tab. `entry` is undefined when only another tab knows it.
  private announce(entry: OutboxEntry | undefined, answer: Answer, error?: BackendError): void {
    const known = entry ?? this.mine.get(answer.seq)
    this.mine.delete(answer.seq)
    if (known !== undefined) this.deliver(known, answer, error)
    this.deps.channel.post(answer)
  }

  // An answer from the tab that sends: it concerns me only when the edit was made here.
  private receive(answer: Answer): void {
    const entry = this.mine.get(answer.seq)
    if (entry === undefined) return
    this.mine.delete(answer.seq)
    this.deliver(entry, answer)
  }

  private deliver(entry: OutboxEntry, answer: Answer, error?: BackendError): void {
    const { hooks } = this.deps
    if (answer.type === 'saved') hooks.saved(entry, answer.record)
    else if (answer.type === 'theirs') hooks.theirs(entry, answer.server)
    else hooks.refused(entry, error ?? new BackendError('invalid', 0, {}, answer.message))
  }

  add(partial: EngineEntry): Promise<number> {
    // Counted as waiting from this moment, so undo and the sign-out question see an edit that is still being stored.
    this.adding++
    this.publish()
    return this.exclusive(async () => {
      try {
        const entry = { ...partial, userId: this.deps.userId, offline: !this.current.online, made: this.deps.clock.now() } as NewEntry
        const seq = await this.store(entry)
        if (seq > 0 && !this.mine.has(seq)) this.mine.set(seq, { ...entry, seq } as OutboxEntry)
        return seq
      } finally {
        this.adding--
        await this.refresh()
        this.deps.channel.post()
        this.wake()
      }
    })
  }

  // The tab that sends merges waiting edits (D5); another tab only appends, because it cannot know what is on the wire.
  private async store(entry: NewEntry): Promise<number> {
    const { storage } = this.deps
    if (!this.owner) return storage.add(entry)
    // Planned on the cached queue and written without a read first: the first storage call is made
    // at once, so a text flushed on `pagehide` reaches IndexedDB before the page goes. The new
    // entry is written before the cancelled ones are removed, so a stop in between loses nothing.
    const locked = this.sendingSeq ?? this.conflict?.entry.seq ?? null
    const plan = planAdd(this.queue, entry, locked)
    let seq = 0
    if (plan.replace !== null) {
      await storage.put(plan.replace)
      seq = plan.replace.seq
    } else if (plan.append !== null) {
      seq = await storage.add(plan.append)
    }
    await storage.remove(plan.drop)
    // Edits the new one cancelled never reach the server; that is what the person asked for, so they are answered as done.
    for (const dropped of plan.drop) this.announce(this.queue.find((q) => q.seq === dropped), { seq: dropped, type: 'saved', record: null })
    return seq
  }

  async dismiss(seq: number): Promise<void> {
    await this.exclusive(async () => {
      await this.deps.storage.dismiss(seq)
      await this.refresh()
    })
    this.deps.channel.post()
  }

  async resolve(choice: 'mine' | 'theirs'): Promise<void> {
    const { conflict } = this
    if (conflict === null) return
    await this.exclusive(async () => {
      const { storage } = this.deps
      const mine = choice === 'mine' ? mineEntry(conflict) : null
      // Keep theirs still sends the fields that did not conflict (D12).
      const replacement = choice === 'mine' ? mine : theirsEntry(conflict)
      if (replacement !== null) await storage.put(replacement)
      else if (choice === 'theirs') await storage.remove([conflict.entry.seq])
      else await storage.fail(conflict.entry, NO_COPY)
      this.conflict = null
      await this.refresh()
      const { entry } = conflict
      if (choice === 'theirs') this.announce(entry, { seq: entry.seq, type: 'theirs', server: conflict.server })
      else if (mine === null) this.announce(entry, { seq: entry.seq, type: 'refused', message: NO_COPY })
    })
    this.deps.channel.post()
    this.wake()
  }

  private wake(): void {
    if (this.loop !== null) {
      this.again = true
      return
    }
    this.loop = this.drain()
  }

  private async drain(): Promise<void> {
    try {
      do {
        this.again = false
        await this.sendNext()
      } while (this.again)
    } catch {
      // Storage failed (the page is closing): nothing was answered, so the entries are still stored and are sent next time.
    } finally {
      this.loop = null
    }
  }

  private async sendNext(): Promise<void> {
    const { conflict } = this
    if (conflict !== null) return
    if (!this.owner || this.stopped || !this.netOnline || this.timer !== null) return
    const entry = await this.exclusive(() => this.take())
    if (entry === null) return
    const outcome = await this.send(entry)
    await this.exclusive(() => this.settle(entry, outcome))
    return this.sendNext()
  }

  private async take(): Promise<OutboxEntry | null> {
    await this.refresh()
    // An entry waiting for the person's answer is never the next one to send.
    const entry = this.queue.find((e) => e.seq !== this.conflict?.entry.seq)
    if (entry === undefined || this.stopped) return null
    this.sendingSeq = entry.seq
    this.publish()
    return entry
  }

  private markReachable(): void {
    let { attempt } = this
    if (attempt > 0) attempt = 0 // reset after a success
    this.attempt = attempt
    this.serverDown = false
  }

  private async settle(entry: OutboxEntry, outcome: Outcome): Promise<void> {
    const { storage } = this.deps
    this.sendingSeq = null
    let tell: () => void = () => this.deps.channel.post()
    if (outcome.type === 'unreachable') {
      await storage.put({ ...entry, offline: true })
      this.backOff()
    } else if (outcome.type === 'saved') {
      this.markReachable()
      await storage.remove([entry.seq])
      tell = () => this.announce(entry, { seq: entry.seq, type: 'saved', record: outcome.record })
    } else if (outcome.type === 'conflict') {
      this.markReachable()
      this.conflict = { entry, server: outcome.server, fields: outcome.fields, deleted: outcome.deleted }
    } else {
      this.markReachable()
      await storage.fail(entry, outcome.error.message)
      tell = () => this.announce(entry, { seq: entry.seq, type: 'refused', message: outcome.error.message }, outcome.error)
    }
    await this.refresh()
    // After the refresh: whoever hears the answer sees a snapshot without the entry that was just answered.
    tell()
  }

  private backOff(): void {
    this.serverDown = true
    this.attempt += 1
    const delay = nextDelay(this.attempt)
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null
      this.wake()
    }, delay)
  }
}

export function createSyncEngine(deps: SyncDeps): SyncEngine {
  return new Engine(deps)
}
