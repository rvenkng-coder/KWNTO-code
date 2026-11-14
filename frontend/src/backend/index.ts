import { createBackend, type Backend } from './client'

export { createBackend, type Backend }

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
  async health() {
    if (!_backend) _backend = createBackend()
    return _backend.health()
  },
}
