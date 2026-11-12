import { createBackend, type Backend } from './client'

export { createBackend, type Backend }

let _backend: Backend | undefined

export const backend: Backend = {
  async health() {
    if (!_backend) {
      _backend = createBackend()
    }
    return _backend.health()
  },
}
