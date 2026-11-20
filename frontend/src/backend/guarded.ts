import { createBackendError, EditConflict, toBackendError } from './errors'

// The client half of the version guard (decision 0002): "the client must handle 409 as
// normal flow (re-read, re-apply only its own fields, retry) ... bound the retries".
// The body holds only the caller's own changed fields, so re-applying it after a re-read
// never overwrites a teammate's other fields.

export const MAX_SAVE_TRIES = 20
export const TOO_BUSY = 'Could not save: too many people are editing this at once. Try again.'

export interface GuardedIO<R extends { version: number }> {
  /** The current record. */
  read(): Promise<R>
  /** Rejects with BackendError kind 'conflict' on 409. */
  write(body: Record<string, unknown>, version: number): Promise<R>
}

export async function guardedSave<R extends { version: number }>(
  io: GuardedIO<R>,
  body: Record<string, unknown>,
  baseVersion: number,
  shouldRetry?: (current: R) => boolean,
): Promise<R> {
  let version = baseVersion
  for (let attempt = 1; attempt <= MAX_SAVE_TRIES; attempt++) {
    try {
      return await io.write(body, version)
    } catch (err) {
      const error = toBackendError(err)
      if (error.kind !== 'conflict') throw error
      // No read after the last try: nothing would use it.
      if (attempt < MAX_SAVE_TRIES || shouldRetry !== undefined) {
        const current = await io.read()
        if (shouldRetry !== undefined && !shouldRetry(current)) throw new EditConflict(current)
        version = current.version
      }
    }
  }
  throw createBackendError('conflict', TOO_BUSY)
}
