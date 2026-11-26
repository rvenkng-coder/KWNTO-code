import { createHookRegistry } from '../sync/hookRegistry'
import { createMemoryOutbox } from '../sync/outboxStorage'
import { createSyncEngine, type SyncEngine, type SyncHooks, type SyncSnapshot } from '../sync/syncEngine'
import { currentSnapshot, registerHooks, subscribeSnapshot, syncLifecycle } from '../sync/syncStore'
import type { EditorDoor } from './editorStore'

// The store's port to the sync engine (offline sync plan Task 4). The app's port follows the
// signed-in account's engine; tests and Plan 3's store tests use an engine of their own.

export interface EditorSyncPort {
  add: SyncEngine['add']
  /** The live connection came back: send what waits on the backoff at once. */
  retryNow(): void
  snapshot(): SyncSnapshot | null
  subscribe(fn: (s: SyncSnapshot | null) => void): () => void
  register(hooks: SyncHooks): () => void
}

export const NO_SESSION = 'You are signed out. Sign in to save changes.'
export const UNDO_PAUSED = 'Undo waits until you are back online and your changes are saved.'

export function portOf(engine: SyncEngine, register: EditorSyncPort['register']): EditorSyncPort {
  return {
    add: (entry) => engine.add(entry),
    retryNow: () => engine.retryNow(),
    snapshot: () => engine.snapshot(),
    subscribe: (fn) => engine.subscribe(fn),
    register,
  }
}

/** An engine on a memory outbox, always online, lock granted at once: sends as soon as it is told to. */
export function directSync(door: EditorDoor): EditorSyncPort {
  const registry = createHookRegistry()
  const engine = createSyncEngine({
    userId: 'direct',
    door,
    storage: createMemoryOutbox(),
    hooks: registry.hooks,
    lock: (_name, run) => run(),
    channel: { post: () => undefined, listen: () => () => undefined },
    clock: {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
  })
  engine.start()
  return portOf(engine, registry.register)
}

/** The app's port: the engine of whoever is signed in. */
export function appSync(): EditorSyncPort {
  return {
    add(entry) {
      const engine = syncLifecycle.current()
      return engine === null ? Promise.reject(new Error(NO_SESSION)) : engine.add(entry)
    },
    retryNow: () => syncLifecycle.current()?.retryNow(),
    snapshot: currentSnapshot,
    subscribe: (fn) => subscribeSnapshot(() => fn(currentSnapshot())),
    register: registerHooks,
  }
}

/** D11: the message while offline with changes waiting (Plan 3's undo would wait for a save that cannot happen), else null. */
export function undoPausedBy(port: EditorSyncPort): () => string | null {
  return () => {
    const s = port.snapshot()
    return s !== null && !s.online && s.waiting > 0 ? UNDO_PAUSED : null
  }
}
