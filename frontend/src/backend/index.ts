import { createBackend, type Backend } from './client'

export { createBackend, type Backend }
export type * from './content-types'
export type * from './media-types'
export { MAX_SAVE_TRIES, TOO_BUSY } from './guarded'
export { EDIT_CONFLICT, EditConflict } from './errors'

let _backend: Backend | undefined

export const backend: Backend = {
  get auth() {
    if (!_backend) _backend = createBackend()
    return _backend.auth
  },
  get teams() {
    if (!_backend) _backend = createBackend()
    return _backend.teams
  },
  get preferences() {
    if (!_backend) _backend = createBackend()
    return _backend.preferences
  },
  get projects() {
    if (!_backend) _backend = createBackend()
    return _backend.projects
  },
  get content() {
    if (!_backend) _backend = createBackend()
    return _backend.content
  },
  get media() {
    if (!_backend) _backend = createBackend()
    return _backend.media
  },
  async health() {
    if (!_backend) _backend = createBackend()
    return _backend.health()
  },
}
