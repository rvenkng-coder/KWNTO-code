import type { ContentKind, ContentRecords } from '../../../backend'
import { BackendError } from '../../../backend/errors'
import type { OutboxEntry } from './outbox'
import type { SyncHooks } from './syncEngine'

/** What happened to one outbox entry. The tab that sends tells every tab, because each tab holds the promises of its own edits. */
export type Answer =
  | { seq: number; type: 'saved'; record: ContentRecords[ContentKind] | null }
  | { seq: number; type: 'refused'; message: string }
  | { seq: number; type: 'theirs'; server: ContentRecords[ContentKind] | null }

/** Tells the store of this tab. `error` is the real error when the answer was made here; elsewhere it is rebuilt from the message. */
export function deliverAnswer(hooks: SyncHooks, entry: OutboxEntry, answer: Answer, error?: BackendError): void {
  if (answer.type === 'saved') hooks.saved(entry, answer.record)
  else if (answer.type === 'theirs') hooks.theirs(entry, answer.server)
  else hooks.refused(entry, error ?? new BackendError('invalid', 0, {}, answer.message))
}
