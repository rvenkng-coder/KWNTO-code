import type { ProjectContent, RemoteEvent } from '../../../backend'
import { errorMessage } from '../../errorMessage'
import { applyRemote } from '../model/remote'
import { applyTouched, EMPTY_STATE, fromContent, mergeNewer, type ContentState, type TouchedMap } from '../model/state'
import { overlay, type OutboxEntry } from '../sync/outbox'
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

class Session {
  private openToken = 0
  private openProject: string | null = null
  private closeSubscription: Closer = null
  private watching = false
  private wasOnline = true
  private laidOver: OutboxEntry[] = []
  // What my own saves changed while a load was under way (see mergeNewer).
  private touched: TouchedMap = new Map()
  private loading = 0
  // Live events that arrive while a load is under way wait here, and are applied on top of it (the version check drops stale ones).
  private buffered: RemoteEvent[] | null = null

  private door: EditorDoor
  private set: Set
  private sync: EditorSyncPort

  constructor(door: EditorDoor, set: Set, sync: EditorSyncPort) {
    this.door = door
    this.set = set
    this.sync = sync
  }

  private waitingEntries = (): OutboxEntry[] => this.sync.snapshot()?.entries ?? []

  // Closing is not waited for: nothing the old project sends is applied once its token is stale.
  private stopSubscription(): void {
    const close = this.closeSubscription
    this.closeSubscription = null
    discard(close)
  }

  private onEventOf = (token: number) => (event: RemoteEvent) => {
    if (token !== this.openToken) return
    const { waitingEntries } = this
    if (this.buffered !== null) this.buffered.push(event)
    else this.set((st) => ({ content: overlay(applyRemote(st.content, event), waitingEntries()) }))
  }

  private finish(loaded: ProjectContent, events: RemoteEvent[], touched: TouchedMap): ContentState {
    return overlay(applyTouched(events.reduce(applyRemote, fromContent(loaded)), touched), this.waitingEntries())
  }

  // Loads the project, and subscribes when asked.
  private async fetchProject(projectId: string, token: number, subscribe: boolean, subscribeFirst = false): Promise<Fetched> {
    this.buffered ??= []
    if (this.loading++ === 0) this.touched.clear()
    const subscribed = subscribe ? this.door.subscribe(projectId, this.onEventOf(token), () => void this.reload(token)) : Promise.resolve(null)
    // After a reconnect the subscription is open before the load is asked for, so a save cannot fall between the two.
    const load = () => this.door.load(projectId)
    const loading = subscribeFirst ? subscribed.then(load, load) : load()
    const [loaded, sub] = await Promise.allSettled([loading, subscribed])
    const events = this.buffered ?? []
    this.buffered = null
    this.loading--
    const touched = new Map(this.touched)
    const close: Closer = sub.status === 'fulfilled' ? sub.value : null
    if (loaded.status === 'rejected') return { ok: false, reason: loaded.reason, close }
    if (sub.status === 'rejected') return { ok: false, reason: sub.reason, close }
    return { ok: true, state: this.finish(loaded.value, events, touched), close }
  }

  // The event stream came back (or the connection did): everything may have changed meanwhile.
  private async reload(token: number): Promise<void> {
    const projectId = this.openProject
    if (projectId === null || token !== this.openToken) return
    const result = await this.fetchProject(projectId, token, false)
    if (token === this.openToken && result.ok) this.set((st) => ({ content: mergeNewer(st.content, result.state) }))
  }

  // The connection is back after the live subscriptions were closed: subscribe again and load again.
  private async reopen(token: number): Promise<void> {
    const projectId = this.openProject
    if (projectId === null || token !== this.openToken) return
    const result = await this.fetchProject(projectId, token, true, true)
    if (token !== this.openToken || !result.ok) return discard(result.close)
    this.stopSubscription()
    this.closeSubscription = result.close
    this.set((st) => ({ content: mergeNewer(st.content, result.state) }))
  }

  // Waiting edits that were not known when the project loaded (the outbox was still being read) are laid over it now.
  private layOver(entries: OutboxEntry[]): void {
    if (entries === this.laidOver) return
    this.laidOver = entries
    if (entries.length > 0) this.set((st) => (st.status === 'ready' ? { content: overlay(st.content, entries) } : {}))
  }

  // D6: offline closes the live subscriptions; coming back opens them again and reloads.
  // Started by the first `open`, so building the store touches no browser API.
  private watchConnection(): void {
    if (this.watching) return
    this.watching = true
    this.wasOnline = this.sync.snapshot()?.online ?? true
    this.sync.register({
      saved: (entry, record) => {
        if (this.loading > 0) this.touched.set(`${entry.kind}:${entry.id}`, record ?? 'gone')
      },
      refused: () => undefined,
      theirs: () => undefined,
    })
    this.sync.subscribe((snapshot) => {
      const online = snapshot?.online ?? true
      const changed = online !== this.wasOnline
      this.wasOnline = online
      if (this.openProject === null) return
      if (!changed) return this.layOver(snapshot?.entries ?? [])
      if (online) void this.reopen(this.openToken)
      else this.stopSubscription()
    })
  }

  open = async (projectId: string): Promise<void> => {
    const token = ++this.openToken
    this.openProject = projectId
    this.watchConnection()
    this.stopSubscription()
    this.set({ status: 'loading', error: null, content: EMPTY_STATE })
    const result = await this.fetchProject(projectId, token, true)
    if (token !== this.openToken) return discard(result.close)
    if (!result.ok) {
      discard(result.close)
      this.set({ status: 'error', error: errorMessage(result.reason, OPEN_FAILED) })
      return
    }
    this.closeSubscription = result.close
    this.set({ status: 'ready', content: result.state })
  }

  close = (): Promise<void> => {
    this.openToken++
    this.openProject = null
    this.stopSubscription()
    this.set({ status: 'idle', error: null, saving: 0, content: EMPTY_STATE })
    return Promise.resolve()
  }
}

export function createSession(door: EditorDoor, set: Set, sync: EditorSyncPort): Pick<EditorStore, 'open' | 'close'> {
  const session = new Session(door, set, sync)
  return { open: session.open, close: session.close }
}
