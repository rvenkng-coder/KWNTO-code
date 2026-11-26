import type { NewEntry, OutboxEntry } from './outbox'
import { nextDelay } from './outboxText'
import type { FailedEntry } from './outboxStorage'
import { AnswerBook, type Answer, type TabMessage } from './syncAnswers'
import { applyChoice } from './syncResolve'
import { createSender, type Outcome } from './syncSend'
import { TabLink, writeEntry } from './syncTabs'
import type { EngineEntry, PendingConflict, SyncDeps, SyncEngine, SyncSnapshot } from './syncTypes'

// The one loop that sends outbox entries (offline sync plan Task 3, D2, D7 to D9, D12): in seq
// order, one request at a time, only in the tab holding the Web Lock, backing off while the
// server cannot be reached. Everything it touches is injected.

export type { Answer, TabMessage }
export type { EngineEntry, PendingConflict, SyncDeps, SyncDoor, SyncEngine, SyncHooks, SyncSnapshot } from './syncTypes'
export const LOCK_PREFIX = 'kwnto-sync-'

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
  // Set at the start and after every reconnect: the session may have ended while nothing could be sent.
  private checkSession = true
  private answers: AnswerBook
  private link: TabLink
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
    this.answers = new AnswerBook(deps.hooks, deps.channel)
    this.link = new TabLink(deps.channel)
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
      online: this.netOnline && !this.serverDown && (this.owner || this.link.remoteOnline),
      owner: this.owner,
      waiting: this.queue.length + this.adding,
      sendingSeq: this.sendingSeq,
      failed: this.failed,
      conflict: this.owner ? this.conflict : this.link.remoteConflict,
      entries: this.queue,
    }
  }

  private publish(): void {
    this.current = this.build()
    this.shareState(false)
    for (const listener of this.listeners) listener(this.current)
  }

  private shareState(force: boolean): void {
    if (this.owner) this.link.share(this.current.online, this.conflict, force)
  }

  private onMessage(message?: TabMessage): void {
    if (message?.type === 'hello') return this.shareState(true)
    if (message?.type === 'state') {
      if (this.owner) return
      this.link.take(message.online, message.conflict)
      return this.publish()
    }
    if (message?.type === 'resolve') {
      if (this.owner) void this.resolve(message.choice)
      return
    }
    this.refreshQuietly().then(() => {
      if (message !== undefined) this.answers.receive(message)
      this.wake()
    })
  }

  private async refresh(): Promise<void> {
    this.queue = await this.deps.storage.list(this.deps.userId)
    this.failed = await this.deps.storage.failed(this.deps.userId)
    this.publish()
  }

  /** Storage work never interleaves: adds, picks and bookkeeping run one after another. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn)
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.unlisten = this.deps.channel.listen((message) => this.onMessage(message))
    void this.refreshQuietly()
    this.lockDone = this.deps.lock(LOCK_PREFIX + this.deps.userId, () => this.holdLock())
    this.deps.channel.post({ type: 'hello' })
  }

  // Background reads must not raise an unhandled rejection: a closing page loses its IndexedDB connection, the entries stay stored.
  private refreshQuietly(): Promise<void> {
    return this.exclusive(() => this.refresh()).catch(() => undefined)
  }

  private holdLock(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    this.owner = true
    this.link.becameOwner()
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
      this.checkSession = true
      this.wake()
    }
    this.publish()
  }

  retryNow(): void {
    if (!this.netOnline || this.timer === null) return
    this.clearTimer()
    this.attempt = 0
    this.retryOrClear()
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer)
    this.timer = null
  }

  add(partial: EngineEntry): Promise<number> {
    // Counted as waiting from this moment, so undo and the sign-out question see an edit that is still being stored.
    this.adding++
    this.publish()
    return this.exclusive(async () => {
      try {
        const entry = {
          ...partial,
          userId: this.deps.userId,
          offline: !this.current.online,
          made: this.deps.clock.now(),
        } as NewEntry
        const seq = await this.store(entry)
        if (seq > 0) this.answers.remember(seq, { ...entry, seq } as OutboxEntry)
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
    const locked = this.sendingSeq ?? this.conflict?.entry.seq ?? null
    const { seq, dropped } = await writeEntry(storage, this.queue, locked, entry)
    // Edits the new one cancelled never reach the server; that is what the person asked for, so they are answered as done.
    for (const seqOf of dropped)
      this.answers.announce(
        this.queue.find((q) => q.seq === seqOf),
        { seq: seqOf, type: 'saved', record: null },
      )
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
    if (!this.owner) return this.deps.channel.post({ type: 'resolve', choice })
    const { conflict } = this
    if (conflict === null) return
    await this.exclusive(async () => {
      const answer = await applyChoice(this.deps.storage, conflict, choice)
      this.conflict = null
      // After the refresh: whoever hears the answer sees a snapshot without the answered entry.
      await this.refresh()
      if (answer !== null) this.answers.announce(conflict.entry, answer)
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
      // Storage failed (the page is closing): nothing was answered, so the entries are still stored. Try again later.
      this.sendingSeq = null
      this.backOff()
    } finally {
      this.loop = null
    }
  }

  private async sendNext(): Promise<void> {
    const { conflict } = this
    if (conflict !== null) return
    if (!this.owner || this.stopped || !this.netOnline || this.timer !== null) return
    if (!(await this.sessionUsable())) return
    const entry = await this.exclusive(() => this.take())
    if (entry === null) return
    const outcome = await this.send(entry)
    await this.exclusive(() => this.settle(entry, outcome))
    return this.sendNext()
  }

  // A request with an ended session is a guest's: the rules would answer 403 or 404 and the edits would be wrongly refused.
  // Entries stay stored until the person signs in again (the engine of the next session sends them).
  private async sessionUsable(): Promise<boolean> {
    const refresh = this.deps.refreshSession
    if (refresh === undefined || !this.checkSession) return true
    this.checkSession = false
    const usable = await refresh().catch(() => true)
    this.checkSession = !usable
    return usable
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
    this.attempt = 0
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
      tell = () => this.answers.announce(entry, { seq: entry.seq, type: 'saved', record: outcome.record })
    } else if (outcome.type === 'conflict') {
      this.markReachable()
      this.conflict = { entry, server: outcome.server, fields: outcome.fields, deleted: outcome.deleted }
    } else {
      this.markReachable()
      await storage.fail(entry, outcome.error.message)
      tell = () =>
        this.answers.announce(entry, { seq: entry.seq, type: 'refused', message: outcome.error.message }, outcome.error)
    }
    await this.refresh()
    // After the refresh: whoever hears the answer sees a snapshot without the entry that was just answered.
    tell()
  }

  // Time to try again. With nothing left to send there is nothing to find out, so the server counts as reachable again
  // (the live connection then reopens); otherwise the next send finds out.
  private retryOrClear(): void {
    if (this.queue.length > 0 || this.adding > 0) return this.wake()
    this.serverDown = false
    this.attempt = 0
    this.publish()
  }

  private backOff(): void {
    this.serverDown = true
    this.attempt += 1
    const delay = nextDelay(this.attempt)
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null
      this.retryOrClear()
    }, delay)
  }
}

export function createSyncEngine(deps: SyncDeps): SyncEngine {
  return new Engine(deps)
}
