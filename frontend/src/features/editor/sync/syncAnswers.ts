import type { ContentKind, ContentRecords } from '../../../backend'
import { BackendError } from '../../../backend/errors'
import type { OutboxEntry } from './outbox'
import type { PendingConflict, SyncDeps, SyncHooks } from './syncEngine'

/** What happened to one outbox entry. The tab that sends tells every tab, because each tab holds the promises of its own edits. */
export type Answer =
  | { seq: number; type: 'saved'; record: ContentRecords[ContentKind] | null }
  | { seq: number; type: 'refused'; message: string }
  | { seq: number; type: 'theirs'; server: ContentRecords[ContentKind] | null }

/** What tabs of one browser say to each other. A plain `undefined` message means "the outbox changed". */
export type TabMessage =
  | Answer
  | { type: 'hello' }
  | { type: 'state'; online: boolean; conflict: PendingConflict | null }
  | { type: 'resolve'; choice: 'mine' | 'theirs' }

/** Tells the store of this tab. `error` is the real error when the answer was made here; elsewhere it is rebuilt from the message. */
export function deliverAnswer(hooks: SyncHooks, entry: OutboxEntry, answer: Answer, error?: BackendError): void {
  if (answer.type === 'saved') hooks.saved(entry, answer.record)
  else if (answer.type === 'theirs') hooks.theirs(entry, answer.server)
  else hooks.refused(entry, error ?? new BackendError('invalid', 0, {}, answer.message))
}

/** The edits this tab made that have no answer yet (their promises live in this tab), and how answers reach them. */
export class AnswerBook {
  private mine = new Map<number, OutboxEntry>()
  private hooks: SyncHooks
  private channel: SyncDeps['channel']

  constructor(hooks: SyncHooks, channel: SyncDeps['channel']) {
    this.hooks = hooks
    this.channel = channel
  }

  /** An edit of this tab was stored under `seq` (a merged edit shares the seq of the entry it joined). */
  remember(seq: number, entry: OutboxEntry): void {
    if (!this.mine.has(seq)) this.mine.set(seq, entry)
  }

  // Tells this tab's store and, through the channel, every other tab. `entry` is undefined when only another tab knows it.
  announce(entry: OutboxEntry | undefined, answer: Answer, error?: BackendError): void {
    const known = entry ?? this.mine.get(answer.seq)
    this.mine.delete(answer.seq)
    if (known !== undefined) deliverAnswer(this.hooks, known, answer, error)
    this.channel.post(answer)
  }

  // An answer from the tab that sends: it concerns me only when the edit was made here.
  receive(answer: Answer): void {
    const entry = this.mine.get(answer.seq)
    if (entry === undefined) return
    this.mine.delete(answer.seq)
    deliverAnswer(this.hooks, entry, answer)
  }
}
