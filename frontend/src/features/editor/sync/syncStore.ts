import { useSyncExternalStore } from 'react'
import { backend } from '../../../backend'
import { isOffline } from './connectionStatus'
import { createHookRegistry } from './hookRegistry'
import { createIndexedDbOutbox } from './indexedDbOutbox'
import { createSyncEngine, type TabMessage, type SyncDeps, type SyncEngine, type SyncSnapshot } from './syncEngine'
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
    post: (message) => bc.postMessage(message ?? 'changed'),
    listen(fn) {
      const onMessage = (e: MessageEvent<TabMessage | 'changed'>) => fn(e.data === 'changed' ? undefined : e.data)
      bc.addEventListener('message', onMessage)
      return () => {
        bc.removeEventListener('message', onMessage)
        bc.close()
      }
    },
  }
}

let built: SyncLifecycle | undefined

const PROBE_MS = 1000

// Tells the engine whether the connection is usable (plan 7 Task 7). Besides the browser's own
// online and offline events it follows the live stream: when the stream drops and stays down for
// three seconds the engine is told "offline", so the top bar says so without an edit having to
// fail first. Once the editor is offline it closes its subscriptions, so no event can say the
// stream is back; while it is down a probe opens the stream once a second, and a connect ends it.
function watchConnection(lifecycle: SyncLifecycle): void {
  let streamUp = true
  let downSince: number | null = null
  let told: boolean | null = null
  let probe: ReturnType<typeof setInterval> | null = null

  const evaluate = () => {
    const online = !isOffline(navigator.onLine, streamUp, downSince, Date.now())
    if (online === told) return
    told = online
    lifecycle.current()?.setOnline(online)
  }
  const stopProbe = () => {
    if (probe !== null) clearInterval(probe)
    probe = null
  }
  const check = () => {
    evaluate()
    if (told !== false || !navigator.onLine) return
    void backend.realtime.probe().then((ok) => {
      if (!ok || streamUp) return
      streamUp = true
      downSince = null
      stopProbe()
      evaluate()
    })
  }
  backend.realtime.onConnectionChange((connected) => {
    streamUp = connected
    downSince = connected ? null : (downSince ?? Date.now())
    if (connected) stopProbe()
    else probe ??= setInterval(check, PROBE_MS)
    evaluate()
  })
  window.addEventListener('online', () => {
    told = null
    evaluate()
  })
  window.addEventListener('offline', () => {
    told = null
    evaluate()
  })
}

function build(): SyncLifecycle {
  const storage = createIndexedDbOutbox()
  const onUser = (listener: (userId: string | null) => void) => {
    listener(backend.auth.current()?.id ?? null)
    return backend.auth.onChange((user) => listener(user?.id ?? null))
  }
  const lifecycle = createSyncLifecycle(onUser, (userId) => {
    const engine = createSyncEngine({
      userId, door: backend.content, storage, hooks: registry.hooks, lock: browserLock, channel: browserChannel(),
      refreshSession: async () => (await backend.auth.refresh()) !== null,
      clock: { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    })
    engine.setOnline(navigator.onLine)
    return engine
  })
  watchConnection(lifecycle)
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
