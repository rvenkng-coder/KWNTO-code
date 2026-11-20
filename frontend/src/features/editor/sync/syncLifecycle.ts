import type { SyncEngine } from './syncEngine'

// One sync engine per signed-in account (offline sync plan Task 4, D9, D10): a new user stops the
// old engine and starts a new one, null stops it, the same user twice does nothing.

export interface SyncLifecycle {
  current(): SyncEngine | null
  subscribe(fn: (e: SyncEngine | null) => void): () => void
}

export function createSyncLifecycle(
  onUser: (listener: (userId: string | null) => void) => () => void,
  makeEngine: (userId: string) => SyncEngine,
): SyncLifecycle {
  let engine: SyncEngine | null = null
  let currentUser: string | null = null
  const listeners = new Set<(e: SyncEngine | null) => void>()

  onUser((userId) => {
    if (userId === currentUser) return
    currentUser = userId
    void engine?.stop()
    engine = userId === null ? null : makeEngine(userId)
    engine?.start()
    for (const listener of listeners) listener(engine)
  })

  return {
    current: () => engine,
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}
