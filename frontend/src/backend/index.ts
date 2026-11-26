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
export type * from './link-types'
export { MAX_SAVE_TRIES, TOO_BUSY } from './guarded'
export { EDIT_CONFLICT, EditConflict } from './errors'

let _backend: Backend | undefined
// Made on first use, so importing this module (as tests do) opens no connection.
const lazy = (): Backend => (_backend ??= createBackend())

export const backend: Backend = {
  get auth() {
    return lazy().auth
  },
  get teams() {
    return lazy().teams
  },
  get preferences() {
    return lazy().preferences
  },
  get projects() {
    return lazy().projects
  },
  get content() {
    return lazy().content
  },
  get media() {
    return lazy().media
  },
  get appSettings() {
    return lazy().appSettings
  },
  get projectFiles() {
    return lazy().projectFiles
  },
  get shares() {
    return lazy().shares
  },
  get comments() {
    return lazy().comments
  },
  get presence() {
    return lazy().presence
  },
  get realtime() {
    return lazy().realtime
  },
  get links() {
    return lazy().links
  },
  async health() {
    return lazy().health()
  },
}
