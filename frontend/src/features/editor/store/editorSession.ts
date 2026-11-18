import type { ProjectContent, RemoteEvent } from '../../../backend'
import { errorMessage } from '../../errorMessage'
import { applyRemote } from '../model/remote'
import { EMPTY_STATE, fromContent, type ContentState } from '../model/state'
import { overlay } from '../sync/outbox'
import type { EditorSyncPort } from './editorSync'
import type { EditorDoor, EditorStore } from './editorStore'

// Opening and closing a project: load and subscribe together, drop whatever finishes late. Waiting
// edits are laid over everything that arrives from the server (offline sync plan Task 4, D6), and
// the project is loaded again after every reconnect.

export const OPEN_FAILED = 'This project does not exist or you are not a member of its team.'

type Closer = (() => Promise<void>) | null
type Set = (partial: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore>)) => void
type Fetched = { ok: true; state: ContentState; close: Closer } | { ok: false; reason: unknown; close: Closer }

function discard(close: Closer): void {
  if (close !== null) void close().catch(() => undefined)
}

export function createSession(door: EditorDoor, set: Set, sync: EditorSyncPort): Pick<EditorStore, 'open' | 'close'> {
  let openToken = 0
  let openProject: string | null = null
  let closeSubscription: Closer = null
  let watching = false
  let wasOnline = true

  const waitingEntries = () => sync.snapshot()?.entries ?? []

  // Closing is not waited for: nothing the old project sends is applied once its token is stale.
  function stopSubscription(): void {
    const close = closeSubscription
    closeSubscription = null
    discard(close)
  }

  // Loads the project, and subscribes when asked; events that arrive before the load is applied wait in a buffer.
  async function fetchProject(projectId: string, token: number, subscribe: boolean): Promise<Fetched> {
    let buffer: RemoteEvent[] | null = []
    const onEvent = (event: RemoteEvent) => {
      if (token !== openToken) return
      if (buffer !== null) buffer.push(event)
      else set((st) => ({ content: overlay(applyRemote(st.content, event), waitingEntries()) }))
    }
    const subscribed = subscribe ? door.subscribe(projectId, onEvent, () => void reload(token)) : Promise.resolve(null)
    const [loaded, sub] = await Promise.allSettled([door.load(projectId), subscribed])
    const close: Closer = sub.status === 'fulfilled' ? sub.value : null
    if (loaded.status === 'rejected') return { ok: false, reason: loaded.reason, close }
    if (sub.status === 'rejected') return { ok: false, reason: sub.reason, close }
    const state = finish(loaded.value, buffer)
    buffer = null
    return { ok: true, state, close }
  }

  const finish = (loaded: ProjectContent, buffered: RemoteEvent[]): ContentState =>
    overlay(buffered.reduce(applyRemote, fromContent(loaded)), waitingEntries())

  // The event stream came back (or the connection did): everything may have changed meanwhile.
  async function reload(token: number): Promise<void> {
    const projectId = openProject
    if (projectId === null || token !== openToken) return
    const result = await fetchProject(projectId, token, false)
    if (token === openToken && result.ok) set({ content: result.state })
  }

  // The connection is back after the live subscriptions were closed: subscribe again and load again.
  async function reopen(token: number): Promise<void> {
    const projectId = openProject
    if (projectId === null || token !== openToken) return
    const result = await fetchProject(projectId, token, true)
    if (token !== openToken || !result.ok) return discard(result.close)
    stopSubscription()
    closeSubscription = result.close
    set({ content: result.state })
  }

  // D6: offline closes the live subscriptions; coming back opens them again and reloads.
  // Started by the first `open`, so building the store touches no browser API.
  function watchConnection(): void {
    if (watching) return
    watching = true
    wasOnline = sync.snapshot()?.online ?? true
    sync.subscribe((snapshot) => {
      const online = snapshot?.online ?? true
      const changed = online !== wasOnline
      wasOnline = online
      if (!changed || openProject === null) return
      if (online) void reopen(openToken)
      else stopSubscription()
    })
  }

  async function open(projectId: string): Promise<void> {
    const token = ++openToken
    openProject = projectId
    watchConnection()
    stopSubscription()
    set({ status: 'loading', error: null, content: EMPTY_STATE })
    const result = await fetchProject(projectId, token, true)
    if (token !== openToken) return discard(result.close)
    if (!result.ok) {
      discard(result.close)
      set({ status: 'error', error: errorMessage(result.reason, OPEN_FAILED) })
      return
    }
    closeSubscription = result.close
    set({ status: 'ready', content: result.state })
  }

  function close(): Promise<void> {
    openToken++
    openProject = null
    stopSubscription()
    set({ status: 'idle', error: null, saving: 0, content: EMPTY_STATE })
    return Promise.resolve()
  }

  return { open, close }
}
