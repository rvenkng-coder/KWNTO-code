import { expect, test } from 'vitest'
import type { SyncEngine } from '../../../../frontend/src/features/editor/sync/syncEngine'
import { createSyncLifecycle } from '../../../../frontend/src/features/editor/sync/syncLifecycle'

// Protects: probe of plan row C2: switching back to an earlier account builds a fresh engine, and a late subscriber hears only later changes.
test('[C2] switch-back: u1, u2, u1 makes three engines and stops two', () => {
  let push: (u: string | null) => void = () => {}
  const made: string[] = []
  const stopped: string[] = []
  const lifecycle = createSyncLifecycle((l) => { push = l; return () => {} }, (userId) => {
    made.push(userId)
    return { start: () => {}, stop: () => { stopped.push(userId); return Promise.resolve() } } as unknown as SyncEngine
  })
  push('u1')
  push('u2')
  push('u1')
  expect(made).toEqual(['u1', 'u2', 'u1'])
  expect(stopped).toEqual(['u1', 'u2'])
  expect(lifecycle.current()).not.toBeNull()
})
