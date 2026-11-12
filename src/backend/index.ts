export { createBackend, type Backend } from './client'

let _backend: ReturnType<typeof createBackend> | undefined

export const backend: ReturnType<typeof createBackend> = {
  async health() {
    if (!_backend) {
      _backend = createBackend()
    }
    return _backend.health()
  },
}
