import { useSyncExternalStore } from 'react'
import { backend } from '../../../backend'
import { createHookRegistry } from './hookRegistry'
import { createIndexedDbOutbox } from './indexedDbOutbox'
import { createSyncEngine, type SyncDeps, type SyncEngine, type SyncSnapshot } from './syncEngine'
import { createSyncLifecycle, type SyncLifecycle } from './syncLifecycle'

// The app's sync engine (offline sync plan Task 4): one per signed-in account, on IndexedDB, the
// browser's Web Locks, a BroadcastChannel between tabs and the window's online/offline events.
// Built on first use, so importing this module touches no browser API.

/** The editor store registers here to hear what happened to its edits. */
const registry = createHookRegistry()
export const registerHooks = registry.register

const browserLock: SyncDeps['lock'] = (name, run) =>
  typeof navigator.locks === 'undefined' ? run() : navigator.locks.request(name, run)

function browserChannel(): SyncDeps['channel'] {
  const bc = new BroadcastChannel('kwnto-outbox')
  return {
    post: () => bc.postMessage('changed'),
    listen(fn) {
      bc.addEventListener('message', fn)
      return () => {
        bc.removeEventListener('message', fn)
        bc.close()
      }
    },
  }
}

let built: SyncLifecycle | undefined

function build(): SyncLifecycle {
  const storage = createIndexedDbOutbox()
  const onUser = (listener: (userId: string | null) => void) => {
    listener(backend.auth.current()?.id ?? null)
    return backend.auth.onChange((user) => listener(user?.id ?? null))
  }
  const lifecycle = createSyncLifecycle(onUser, (userId) => {
    const engine = createSyncEngine({
      userId, door: backend.content, storage, hooks: registry.hooks, lock: browserLock, channel: browserChannel(),
      clock: { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    })
    engine.setOnline(navigator.onLine)
    return engine
  })
  window.addEventListener('online', () => lifecycle.current()?.setOnline(true))
  window.addEventListener('offline', () => lifecycle.current()?.setOnline(false))
  return lifecycle
}

export const syncLifecycle: SyncLifecycle = {
  current: () => (built ??= build()).current(),
  subscribe: (fn) => (built ??= build()).subscribe(fn),
}

export const currentSnapshot = (): SyncSnapshot | null => syncLifecycle.current()?.snapshot() ?? null

/** Calls `cb` when the engine or its snapshot changes. */
export function subscribeSnapshot(cb: () => void): () => void {
  let off = syncLifecycle.current()?.subscribe(cb)
  const offLifecycle = syncLifecycle.subscribe((engine: SyncEngine | null) => {
    off?.()
    off = engine?.subscribe(cb)
    cb()
  })
  return () => {
    off?.()
    offLifecycle()
  }
}

export function useSync<T>(selector: (s: SyncSnapshot | null) => T): T {
  return selector(useSyncExternalStore(subscribeSnapshot, currentSnapshot))
}
