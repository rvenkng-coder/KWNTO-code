import { expect, test } from 'vitest'
import type { SyncEngine } from './syncEngine'
import { createSyncLifecycle } from './syncLifecycle'

// Protects: each account gets its own sync engine, the old one stops before the new one starts, a repeated user does
// nothing, and signing out stops it.
test('each account gets its own sync engine', () => {
  const log: string[] = []
  let push: (userId: string | null) => void = () => {}
  const onUser = (listener: (userId: string | null) => void) => {
    push = listener
    return () => {}
  }
  const makeEngine = (userId: string): SyncEngine =>
    ({
      start: () => {
        log.push(`start ${userId}`)
      },
      stop: () => {
        log.push(`stop ${userId}`)
        return Promise.resolve()
      },
    }) as unknown as SyncEngine
  const lifecycle = createSyncLifecycle(onUser, makeEngine)
  const seen: Array<SyncEngine | null> = []
  lifecycle.subscribe((e) => seen.push(e))

  push('u1')
  push('u1')
  push('u2')
  push(null)

  expect(log).toEqual(['start u1', 'stop u1', 'start u2', 'stop u2'])
  expect(lifecycle.current()).toBeNull()
  expect(seen).toHaveLength(3)
})
