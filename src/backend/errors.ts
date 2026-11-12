import { ClientResponseError } from 'pocketbase'

export type BackendErrorKind = 'invalid' | 'locked' | 'forbidden' | 'not-found' | 'conflict' | 'unreachable' | 'unknown'

export class BackendError extends Error {
  kind: BackendErrorKind
  status: number
  fields: Record<string, string>

  constructor(
    kind: BackendErrorKind,
    status: number,
    fields: Record<string, string>,
    message: string,
  ) {
    super(message)
    this.kind = kind
    this.status = status
    this.fields = fields
    this.name = 'BackendError'
  }
}

export function toBackendError(err: unknown): BackendError {
  if (err instanceof BackendError) return err

  if (err instanceof ClientResponseError) {
    const status = err.status
    const response = err.response ?? {}
    const message = (response as { message?: string }).message ?? 'Request failed'

    switch (status) {
      case 0:
      default:
        if (status === 0 || err.isAbort) {
          return new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
        }
        return new BackendError('unknown', status, {}, message)
      case 400: {
        const fields: Record<string, string> = {}
        const data = (response as { data?: Record<string, unknown> }).data
        if (data && typeof data === 'object') {
          for (const key of Object.keys(data) as string[]) {
            const val = (data as Record<string, { message?: string } | string>)[key]
            if (typeof val === 'object' && val !== null && 'message' in val && typeof (val as { message: string }).message === 'string') {
              fields[key] = (val as { message: string }).message
            } else if (typeof val === 'string') {
              fields[key] = val
            }
          }
        }
        return new BackendError('invalid', status, fields, message)
      }
      case 401:
      case 403:
        return new BackendError('forbidden', status, {}, message)
      case 404:
        return new BackendError('not-found', status, {}, message)
      case 409:
        return new BackendError('conflict', status, {}, message)
      case 429:
        return new BackendError('locked', status, {}, message)
    }
  }

  if (err instanceof Error) {
    return new BackendError('unknown', 0, {}, err.message)
  }

  return new BackendError('unknown', 0, {}, 'An unexpected error occurred')
}
