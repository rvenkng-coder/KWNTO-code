import { ClientResponseError } from 'pocketbase'

export type BackendErrorKind = 'invalid' | 'locked' | 'forbidden' | 'not-found' | 'conflict' | 'unreachable' | 'unknown'

export function createBackendError(kind: BackendErrorKind, message: string): BackendError {
  return new BackendError(kind, 0, {}, message)
}

export class BackendError extends Error {
  kind: BackendErrorKind
  status: number
  fields: Record<string, string>

  constructor(kind: BackendErrorKind, status: number, fields: Record<string, string>, message: string) {
    super(message)
    this.kind = kind
    this.status = status
    this.fields = fields
    this.name = 'BackendError'
  }
}

export const EDIT_CONFLICT = 'Someone else changed this while you were offline.'

/** An offline edit met a teammate's change to the same attribute: the sync engine asks the person (D4). */
export class EditConflict<R = unknown> extends BackendError {
  server: R

  constructor(server: R) {
    super('conflict', 409, {}, EDIT_CONFLICT)
    this.server = server
    this.name = 'EditConflict'
  }
}

const STATUS_KINDS: Record<number, BackendErrorKind> = {
  400: 'invalid',
  401: 'forbidden',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  429: 'locked',
}

// PocketBase's field errors: `data.<field>` is `{ message }` (or, rarely, a string).
function fieldErrors(response: object): Record<string, string> {
  const data = (response as { data?: unknown }).data
  const fields: Record<string, string> = {}
  if (typeof data !== 'object' || data === null) return fields
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const message = typeof val === 'object' && val !== null ? (val as { message?: unknown }).message : val
    if (typeof message === 'string') fields[key] = message
  }
  return fields
}

// A proxy in front of a stopped backend answers 502, 503 or 504; the dev proxy may answer a bare 500 with no body.
// PocketBase's own errors always carry a JSON `message`, so a 500 without one did not come from it.
const GATEWAY_STATUSES: ReadonlySet<number> = new Set([502, 503, 504])

function isGatewayFailure(status: number, hasMessage: boolean): boolean {
  return GATEWAY_STATUSES.has(status) || (status === 500 && !hasMessage)
}

function fromResponseError(err: ClientResponseError): BackendError {
  const response = err.response ?? {}
  const text = (response as { message?: string }).message
  const message = text ?? 'Request failed'
  const kind = STATUS_KINDS[err.status]
  if (kind === undefined) {
    if (err.status === 0 || err.isAbort || isGatewayFailure(err.status, text !== undefined))
      return new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
    return new BackendError('unknown', err.status, {}, message)
  }
  return new BackendError(kind, err.status, kind === 'invalid' ? fieldErrors(response) : {}, message)
}

export function toBackendError(err: unknown): BackendError {
  if (err instanceof BackendError) return err
  if (err instanceof ClientResponseError) return fromResponseError(err)
  if (err instanceof Error) return new BackendError('unknown', 0, {}, err.message)
  return new BackendError('unknown', 0, {}, 'An unexpected error occurred')
}
