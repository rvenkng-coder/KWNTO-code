import type PocketBase from 'pocketbase'
import type { ContentKind, ContentRecords, RemoteEvent } from './content-types'
import { fromRecord } from './content-mappers'
import { toBackendError } from './errors'

// Live changes of one project: one subscription per content collection, filtered by project so
// that no other project's events arrive (decision 0002); for `projects`, its one record. PocketBase
// checks each collection's view rule before it sends an event, so an outsider receives
// nothing. Events missed while disconnected are not replayed, so the caller loads the project
// again after a reconnect (`onReconnect`).

const KINDS: readonly ContentKind[] = [
  'projects',
  'project_settings',
  'chapters',
  'nodes',
  'script_lines',
  'cues',
  'connections',
]
const ACTIONS: ReadonlyArray<RemoteEvent['action']> = ['create', 'update', 'delete']

type Unsubscribe = () => Promise<void>

function toEvent<K extends ContentKind>(
  kind: K,
  action: RemoteEvent['action'],
  record: ContentRecords[K],
): RemoteEvent {
  // The mapped union cannot be built from a generic K without a cast; kind and record match by construction.
  return { kind, action, record } as RemoteEvent
}

function subscribeKind(
  pb: PocketBase,
  kind: ContentKind,
  projectId: string,
  onEvent: (e: RemoteEvent) => void,
): Promise<Unsubscribe> {
  const deliver = (e: { action: string; record: Record<string, unknown> }) => {
    const action = ACTIONS.find((a) => a === e.action)
    if (action) onEvent(toEvent(kind, action, fromRecord(kind, e.record)))
  }
  if (kind === 'projects') return pb.collection(kind).subscribe(projectId, deliver)
  const filter = pb.filter('project = {:project}', { project: projectId })
  return pb.collection(kind).subscribe('*', deliver, { filter })
}

// Who wants to hear that the live stream connected or dropped. One list per client;
// it is fed only by an open project subscription, so a drop with nothing subscribed is never reported.
type ConnectionListener = (connected: boolean) => void
const listenersOf = new WeakMap<PocketBase, Set<ConnectionListener>>()

function listeners(pb: PocketBase): Set<ConnectionListener> {
  let set = listenersOf.get(pb)
  if (set === undefined) {
    set = new Set()
    listenersOf.set(pb, set)
  }
  return set
}

const announce = (pb: PocketBase, connected: boolean): void => listeners(pb).forEach((l) => l(connected))

const PROBE_WAIT_MS = 2000

// Opens the live stream on its own for a moment: true when the server answers with its connect event.
// The health route would not do: a stream that is blocked while the server is up must stay "down".
// The address comes from the client, so a backend on another origin is probed, not this page's host.
function streamAnswers(pb: PocketBase): Promise<boolean> {
  return new Promise((resolve) => {
    const source = new EventSource(pb.buildURL('/api/realtime'))
    const done = (ok: boolean) => {
      clearTimeout(timer)
      source.close()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), PROBE_WAIT_MS)
    source.addEventListener('PB_CONNECT', () => done(true))
    source.addEventListener('error', () => done(false))
  })
}

/** Whether the live stream is up, for the sync status: `true` on every connect, `false` when it drops. */
export function createRealtime(pb: PocketBase) {
  return {
    /** Opens the stream once and resolves true if the server connects it within two seconds. */
    probe: (): Promise<boolean> => streamAnswers(pb),
    onConnectionChange(listener: ConnectionListener): () => void {
      listeners(pb).add(listener)
      return () => {
        listeners(pb).delete(listener)
      }
    },
  }
}

// `PB_CONNECT` reaches every subscriber each time the event stream (re)connects (pocketbase 0.28).
// The same subscription feeds the connection listeners, and `onDisconnect` (the SDK's drop callback)
// is set while it is open.
function subscribeConnect(pb: PocketBase, onReconnect?: () => void): Promise<Unsubscribe> {
  let connects = pb.realtime.isConnected ? 1 : 0
  const mine = (active: string[]) => {
    if (active.length > 0) announce(pb, false)
  }
  pb.realtime.onDisconnect = mine
  return pb.realtime
    .subscribe('PB_CONNECT', () => {
      connects++
      announce(pb, true)
      if (connects > 1) onReconnect?.()
    })
    .then((close) => async () => {
      // Another subscription may have opened meanwhile (React opens one twice in development): leave its callback.
      if (pb.realtime.onDisconnect === mine) pb.realtime.onDisconnect = undefined
      await close()
    })
}

/** Opens the seven subscriptions one after another; resolves to a function that closes them all. */
export async function subscribeProject(
  pb: PocketBase,
  projectId: string,
  onEvent: (event: RemoteEvent) => void,
  onReconnect?: () => void,
): Promise<Unsubscribe> {
  const opened: Unsubscribe[] = []
  const closeAll = async () => {
    await Promise.allSettled(opened.map((close) => close()))
  }
  try {
    // First, so the first connect is seen and counted; the SDK calls it again after every automatic reconnect.
    if (onReconnect !== undefined) opened.push(await subscribeConnect(pb, onReconnect))
    for (const kind of KINDS) opened.push(await subscribeKind(pb, kind, projectId, onEvent))
  } catch (err) {
    await closeAll()
    throw toBackendError(err)
  }
  return closeAll
}
