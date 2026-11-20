import type PocketBase from 'pocketbase'
import type { ContentKind, ContentRecords, RemoteEvent } from './content-types'
import { fromRecord } from './content-mappers'
import { toBackendError } from './errors'

// Live changes of one project (plan D15, decision 0002 finding D): one subscription per
// content collection, filtered by project; for `projects`, its one record. PocketBase
// checks each collection's view rule before it sends an event, so an outsider receives
// nothing. Events missed while disconnected are not replayed (finding E, Plan 4).

const KINDS: readonly ContentKind[] = [
  'projects', 'project_settings', 'chapters', 'nodes', 'script_lines', 'cues', 'connections',
]
const ACTIONS: ReadonlyArray<RemoteEvent['action']> = ['create', 'update', 'delete']

type Unsubscribe = () => Promise<void>

function toEvent<K extends ContentKind>(kind: K, action: RemoteEvent['action'], record: ContentRecords[K]): RemoteEvent {
  // The mapped union cannot be built from a generic K without a cast; kind and record match by construction.
  return { kind, action, record } as RemoteEvent
}

function subscribeKind(pb: PocketBase, kind: ContentKind, projectId: string, onEvent: (e: RemoteEvent) => void): Promise<Unsubscribe> {
  const deliver = (e: { action: string; record: Record<string, unknown> }) => {
    const action = ACTIONS.find((a) => a === e.action)
    if (action) onEvent(toEvent(kind, action, fromRecord(kind, e.record)))
  }
  if (kind === 'projects') return pb.collection(kind).subscribe(projectId, deliver)
  const filter = pb.filter('project = {:project}', { project: projectId })
  return pb.collection(kind).subscribe('*', deliver, { filter })
}

// `PB_CONNECT` reaches every subscriber each time the event stream (re)connects (pocketbase 0.28).
function subscribeConnect(pb: PocketBase, onReconnect?: () => void): Promise<Unsubscribe> {
  let connects = pb.realtime.isConnected ? 1 : 0
  return pb.realtime.subscribe('PB_CONNECT', () => {
    connects++
    if (connects > 1) onReconnect?.()
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
