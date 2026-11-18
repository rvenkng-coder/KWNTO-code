import type { RemoteEvent } from '../../../backend'
import { errorMessage } from '../../errorMessage'
import { applyRemote } from '../model/remote'
import { EMPTY_STATE, fromContent } from '../model/state'
import type { EditorDoor, EditorStore } from './editorStore'

// Opening and closing a project: load and subscribe together, drop whatever finishes late.

export const OPEN_FAILED = 'This project does not exist or you are not a member of its team.'

type Closer = (() => Promise<void>) | null
type Set = (partial: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore>)) => void

function discard(close: Closer): void {
  if (close !== null) void close().catch(() => undefined)
}

export function createSession(door: EditorDoor, set: Set): Pick<EditorStore, 'open' | 'close'> {
  let openToken = 0
  let closeSubscription: Closer = null

  // Closing is not waited for: nothing the old project sends is applied once its token is stale.
  function stopSubscription(): void {
    const close = closeSubscription
    closeSubscription = null
    discard(close)
  }

  async function open(projectId: string): Promise<void> {
    const token = ++openToken
    stopSubscription()
    set({ status: 'loading', error: null, content: EMPTY_STATE })
    // Changes that arrive before the load is applied wait here (the version check drops stale ones).
    let buffer: RemoteEvent[] | null = []
    const onEvent = (event: RemoteEvent) => {
      if (token === openToken && buffer !== null) buffer.push(event)
      else if (token === openToken) set((st) => ({ content: applyRemote(st.content, event) }))
    }
    const [loaded, subscribed] = await Promise.allSettled([door.load(projectId), door.subscribe(projectId, onEvent)])
    const close: Closer = subscribed.status === 'fulfilled' ? subscribed.value : null
    if (token !== openToken) return discard(close)
    if (loaded.status === 'rejected' || subscribed.status === 'rejected') {
      discard(close)
      const reason: unknown = loaded.status === 'rejected' ? loaded.reason : (subscribed as PromiseRejectedResult).reason
      set({ status: 'error', error: errorMessage(reason, OPEN_FAILED) })
      return
    }
    closeSubscription = close
    const state = (buffer as RemoteEvent[]).reduce(applyRemote, fromContent(loaded.value))
    buffer = null
    set({ status: 'ready', content: state })
  }

  function close(): Promise<void> {
    openToken++
    stopSubscription()
    set({ status: 'idle', error: null, saving: 0, content: EMPTY_STATE })
    return Promise.resolve()
  }

  return { open, close }
}
