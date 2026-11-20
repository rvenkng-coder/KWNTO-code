import { createBackend, type Backend } from './client'

export { createBackend, type Backend }
export type * from './content-types'
export type * from './media-types'
export type * from './share-types'
export type * from './comment-types'
export type * from './presence-types'
export { MAX_COMMENT_LENGTH } from './comment-types'
export type { AppSettings } from './appSettings'
export { MAX_IMPORT_BYTES } from './projectFiles'
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
  get appSettings() {
    if (!_backend) _backend = createBackend()
    return _backend.appSettings
  },
  get projectFiles() {
    if (!_backend) _backend = createBackend()
    return _backend.projectFiles
  },
  get shares() {
    if (!_backend) _backend = createBackend()
    return _backend.shares
  },
  get comments() {
    if (!_backend) _backend = createBackend()
    return _backend.comments
  },
  get presence() {
    if (!_backend) _backend = createBackend()
    return _backend.presence
  },
  get realtime() {
    if (!_backend) _backend = createBackend()
    return _backend.realtime
  },
  async health() {
    if (!_backend) _backend = createBackend()
    return _backend.health()
  },
}
