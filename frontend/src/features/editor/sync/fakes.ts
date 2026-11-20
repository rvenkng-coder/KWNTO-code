import { createMemoryOutbox, type OutboxStorage } from './outboxStorage'
import { createSyncEngine, type Answer, type SyncDeps, type SyncDoor, type SyncEngine } from './syncEngine'

// Test doubles for the sync engine (offline sync plan Task 3): a scripted door, a clock that
// runs timers when the test says, a lock that grants one holder per name, a channel between tabs.

type Method = 'get' | 'create' | 'update' | 'remove'
export interface DoorCall { method: Method; kind: string; id: string; args: unknown[] }
type Handler = (call: DoorCall) => unknown

/** Answers from `on(method, handler)`; defaults: create echoes, update bumps the version, get finds nothing. */
export function fakeDoor() {
  const calls: DoorCall[] = []
  const handlers: Partial<Record<Method, Handler>> = {}
  const gates: Array<() => void> = []
  let gated = false
  const defaults: Record<Method, Handler> = {
    get: () => null,
    create: (c) => c.args[0],
    update: (c) => ({ id: c.id, projectId: 'p1', ...(c.args[0] as object), version: (c.args[1] as number) + 1 }),
    remove: () => undefined,
  }
  const run = (method: Method, kind: string, id: string, ...args: unknown[]) => {
    const call = { method, kind, id, args }
    calls.push(call)
    const answer = async () => (handlers[method] ?? defaults[method])(call)
    return gated ? new Promise<void>((r) => gates.push(r)).then(answer) : answer()
  }
  const door = {
    get: (kind: string, id: string) => run('get', kind, id),
    create: (kind: string, record: { id: string }) => run('create', kind, record.id, record),
    update: (kind: string, id: string, ...rest: unknown[]) => run('update', kind, id, ...rest),
    remove: (kind: string, id: string) => run('remove', kind, id),
  } as unknown as SyncDoor
  return {
    door, calls,
    on: (method: Method, handler: Handler) => { handlers[method] = handler },
    gate: (on: boolean) => { gated = on },
    releaseNext: () => gates.shift()?.(),
  }
}

export function fakeClock() {
  let t = 0
  let next = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => t,
    setTimeout: (fn: () => void, ms: number): unknown => {
      timers.set(next, { at: t + ms, fn })
      return next++
    },
    clearTimeout: (handle: unknown) => { timers.delete(handle as number) },
    advance(ms: number) {
      t += ms
      const due = [...timers].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)
      for (const [id, v] of due) {
        timers.delete(id)
        v.fn()
      }
    },
    pending: () => timers.size,
  }
}

/** One holder per name at a time; the rest wait in order. */
export function fakeLock(): SyncDeps['lock'] {
  const tails = new Map<string, Promise<void>>()
  return (name, run) => {
    const mine = (tails.get(name) ?? Promise.resolve()).then(run)
    tails.set(name, mine.catch(() => undefined))
    return mine
  }
}

/** Every member hears the others' posts, never its own (like BroadcastChannel). */
export function fakeBus() {
  const members = new Set<{ fn: (message?: Answer) => void }>()
  return (): SyncDeps['channel'] => {
    const me: { fn: (message?: Answer) => void } = { fn: () => {} }
    members.add(me)
    return {
      post: (message) => { for (const m of members) if (m !== me) queueMicrotask(() => m.fn(message)) },
      listen: (fn) => {
        me.fn = fn
        return () => {
          me.fn = () => {}
        }
      },
    }
  }
}

export interface HookLog { saved: unknown[][]; refused: unknown[][]; theirs: unknown[][] }

export interface Shared { storage: OutboxStorage; lock: SyncDeps['lock']; channel: () => SyncDeps['channel']; door: ReturnType<typeof fakeDoor> }
export const sharedParts = (): Shared => ({ storage: createMemoryOutbox(), lock: fakeLock(), channel: fakeBus(), door: fakeDoor() })

/** An engine on the shared parts (one per "tab"), with its own clock and hook log. */
export function tab(shared: Shared = sharedParts()) {
  const clock = fakeClock()
  const log: HookLog = { saved: [], refused: [], theirs: [] }
  const engine: SyncEngine = createSyncEngine({
    userId: 'u1', door: shared.door.door, storage: shared.storage, clock, lock: shared.lock, channel: shared.channel(),
    hooks: {
      saved: (...a) => { log.saved.push(a) },
      refused: (...a) => { log.refused.push(a) },
      theirs: (...a) => { log.theirs.push(a) },
    },
  })
  return { engine, clock, log, ...shared }
}

/** Lets every pending promise run (the doubles use promises only). */
export const settle = () => new Promise<void>((r) => setTimeout(r, 0))
