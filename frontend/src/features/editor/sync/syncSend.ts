import { BackendError, EditConflict, toBackendError as backendError } from '../../../backend/errors'
import type { ContentKind, ContentRecords, EditableFields, RemovableKind } from '../../../backend'
import { classifyConflict, type OutboxEntry } from './outbox'
import type { SyncDoor } from './syncEngine'

// Sending one outbox entry and sorting the answer (offline sync plan Task 3). Pure of timers and
// storage: the engine decides what each outcome means for the queue.

export type Outcome =
  | { type: 'saved'; record: ContentRecords[ContentKind] | null }
  | { type: 'refused'; error: BackendError }
  | { type: 'conflict'; server: ContentRecords[ContentKind] | null; fields: string[]; deleted: boolean }
  | { type: 'unreachable' }

const REMOVABLE: ReadonlySet<ContentKind> = new Set<RemovableKind>(['script_lines', 'cues', 'connections'])
const DELETED: Outcome = { type: 'conflict', server: null, fields: [], deleted: true }

// The door's default message when the server's answer carried none. PocketBase's own 404 always has a message, so a 404
// without one came from a proxy with no route (Tailscale serve switched off): the server cannot be reached, and the
// record is not "gone" (a remove must not count as done, an update must not be refused).
const NO_SERVER_MESSAGE = 'Request failed'

function toBackendError(err: unknown): BackendError {
  const error = backendError(err)
  const proxyNotFound = error.kind === 'not-found' && error.status === 404 && error.message === NO_SERVER_MESSAGE
  return proxyNotFound ? new BackendError('unreachable', 0, {}, 'The server cannot be reached.') : error
}

const isIdTaken = (error: BackendError): boolean => error.kind === 'invalid' && error.fields.id !== undefined

// Worth another try later, not a refusal: the server cannot be reached, the rate limiter said slow down (429),
// or the server failed (5xx, for example a busy database).
const isTransient = (error: BackendError): boolean =>
  error.kind === 'unreachable' || error.kind === 'locked' || error.status >= 500

function failure(error: BackendError): Outcome {
  return isTransient(error) ? { type: 'unreachable' } : { type: 'refused', error }
}

// The create reached the server and its answer was lost: the id exists in this project, so it is done. When the check
// itself fails (the link is bad) the entry waits and is tried again.
async function confirmCreatedIn(door: SyncDoor, entry: Extract<OutboxEntry, { op: 'create' }>): Promise<Outcome> {
  let found: Awaited<ReturnType<SyncDoor['get']>>
  try {
    found = await door.get(entry.kind, entry.id)
  } catch (err) {
    return failure(toBackendError(err))
  }
  if (found !== null && 'projectId' in found && found.projectId === entry.projectId)
    return { type: 'saved', record: found }
  return {
    type: 'refused',
    error: new BackendError('invalid', 400, { id: 'in use' }, 'That id is already used by another record.'),
  }
}

export function createSender(door: SyncDoor): (entry: OutboxEntry) => Promise<Outcome> {
  const confirmCreated = (entry: Extract<OutboxEntry, { op: 'create' }>): Promise<Outcome> =>
    confirmCreatedIn(door, entry)

  async function sendCreate(entry: Extract<OutboxEntry, { op: 'create' }>): Promise<Outcome> {
    try {
      return { type: 'saved', record: await door.create(entry.kind, entry.record) }
    } catch (err) {
      const error = toBackendError(err)
      if (isIdTaken(error)) return confirmCreated(entry)
      return failure(error)
    }
  }

  async function sendUpdate(entry: Extract<OutboxEntry, { op: 'update' }>): Promise<Outcome> {
    // Only an edit made offline can raise the dialog; online edits retry silently (D3).
    const shouldRetry = entry.offline
      ? (cur: ContentRecords[ContentKind]) => classifyConflict(entry, cur).type === 'none'
      : undefined
    try {
      const changes = entry.changes as Partial<EditableFields[ContentKind]>
      // An online edit is sent as Plan 3 sent it: no options.
      const saved =
        shouldRetry === undefined
          ? await door.update(entry.kind, entry.id, changes, entry.baseVersion)
          : await door.update(entry.kind, entry.id, changes, entry.baseVersion, { shouldRetry })
      return { type: 'saved', record: saved }
    } catch (err) {
      if (err instanceof EditConflict) return conflictOf(entry, err.server as ContentRecords[ContentKind])
      const error = toBackendError(err)
      if (error.kind === 'not-found' && entry.offline && REMOVABLE.has(entry.kind)) return DELETED
      return failure(error)
    }
  }

  async function sendRemove(entry: Extract<OutboxEntry, { op: 'remove' }>): Promise<Outcome> {
    try {
      if (entry.offline) {
        const server = await door.get(entry.kind, entry.id)
        if (server === null) return { type: 'saved', record: null }
        const check = classifyConflict(entry, server)
        if (check.type === 'fields') return { type: 'conflict', server, fields: check.fields, deleted: false }
      }
      await door.remove(entry.kind, entry.id)
      return { type: 'saved', record: null }
    } catch (err) {
      const error = toBackendError(err)
      return error.kind === 'not-found' ? { type: 'saved', record: null } : failure(error)
    }
  }

  return (entry) => {
    if (entry.op === 'create') return sendCreate(entry)
    return entry.op === 'update' ? sendUpdate(entry) : sendRemove(entry)
  }
}

function conflictOf(entry: OutboxEntry, server: ContentRecords[ContentKind]): Outcome {
  const check = classifyConflict(entry, server)
  if (check.type === 'fields') return { type: 'conflict', server, fields: check.fields, deleted: false }
  return { type: 'refused', error: new BackendError('conflict', 409, {}, 'The change could not be merged.') }
}
