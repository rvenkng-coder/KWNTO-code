import { useEffect } from 'react'
import { create } from 'zustand'
import { backend } from '../../../backend/index.ts'
import type { Media, MediaEvent, StorageInfo } from '../../../backend/media-types.ts'
import { applyMediaEvent } from './mediaList.ts'
import { currentSnapshot, subscribeSnapshot } from '../sync/syncStore'
import { keepMediaOpen, type OnlinePort } from './keepMediaOpen.ts'
import { earlyProblem } from './uploadCheck.ts'

interface MediaStoreState {
  projectId: string | null
  media: Media[]
  storage: StorageInfo | null
  uploading: string[]
  error: string | null
  fileToken: string | null
  open(projectId: string): Promise<() => void>
  close(): void
  upload(nodeId: string, file: File): Promise<void>
  remove(m: Media): Promise<void>
  restore(m: Media): Promise<void>
  deletePermanently(m: Media): Promise<void>
  setError(err: string | null): void
  refreshFileToken(): Promise<void>
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const bErr = err as { reason?: string; fields?: Record<string, string>; message?: string }
    if (bErr.reason === 'unreachable') {
      return 'Uploads need a connection. Try again when you are back online.'
    }
    if (bErr.fields?.file) {
      return bErr.fields.file
    }
    if (bErr.message) {
      return bErr.message
    }
  }
  return err instanceof Error ? err.message : String(err)
}

type SetFn = (fn: (s: MediaStoreState) => Partial<MediaStoreState>) => void

// Writes for one project only land while that project is still the open one,
// so a response that arrives after a switch is dropped.
function forProject(projectId: string, set: SetFn): SetFn {
  return (fn) => set((s) => (s.projectId === projectId ? fn(s) : {}))
}

export const FILE_TOKEN_REFRESH_MS = 45_000

// The editor's connection state: the sync engine of whoever is signed in.
const appOnline: OnlinePort = {
  online: () => currentSnapshot()?.online ?? true,
  subscribe: (fn) => subscribeSnapshot(fn),
}

// Several reads of the lead's storage can be in flight at once (a live event, the end of an upload,
// a removal). Answers can arrive out of order, so only the newest request may write the store;
// an older answer would show numbers from before the latest change.
let latestStorageRequest = 0

async function readStorage(projectId: string, set: SetFn): Promise<StorageInfo> {
  const mine = ++latestStorageRequest
  const info = await backend.media.storage(projectId)
  if (mine === latestStorageRequest) set(() => ({ storage: info }))
  return info
}

async function refreshFileToken(get: () => MediaStoreState, set: SetFn): Promise<void> {
  const { projectId } = get()
  if (!projectId) return
  try {
    const token = await backend.media.fileToken()
    forProject(projectId, set)(() => ({ fileToken: token }))
  } catch {
    // keep the old token; the next tick tries again
  }
}

async function openProjectMedia(projectId: string, rawSet: SetFn): Promise<() => void> {
  rawSet(() => ({ projectId, error: null }))
  const set = forProject(projectId, rawSet)

  // Subscribe first so nothing between the list fetch and the subscription is lost;
  // events that arrive before the list is loaded are replayed over it.
  let loaded = false
  const early: MediaEvent[] = []
  let unsubscribe: () => void = () => {}
  try {
    unsubscribe = await backend.media.subscribe(projectId, async (event) => {
      if (!loaded) {
        early.push(event)
        return
      }
      set((s) => ({ media: applyMediaEvent(s.media, event) }))
      try {
        await readStorage(projectId, set)
      } catch {
        // storage refresh failure does not block live events
      }
    })
  } catch (err) {
    set(() => ({ error: extractErrorMessage(err) }))
  }

  try {
    const [mediaList, , token] = await Promise.all([
      backend.media.list(projectId),
      readStorage(projectId, set),
      backend.media.fileToken(),
    ])
    set(() => ({
      media: early.reduce(applyMediaEvent, mediaList),
      fileToken: token,
    }))
  } catch (err) {
    set(() => ({ error: extractErrorMessage(err) }))
  }
  loaded = true

  return unsubscribe
}

async function uploadProjectMedia(
  nodeId: string,
  file: File,
  get: () => MediaStoreState,
  rawSet: SetFn,
): Promise<void> {
  const { projectId } = get()
  if (!projectId) return
  const set = forProject(projectId, rawSet)

  // The lead's storage changes whenever any teammate uploads or deletes, so read it fresh before
  // judging the file. If that fails, judge by the last known value; the server decides anyway.
  let storage = get().storage
  try {
    storage = await readStorage(projectId, set)
  } catch {
    // keep the last known value
  }

  if (storage) {
    const problem = earlyProblem({ name: file.name, size: file.size }, storage)
    if (problem) {
      set(() => ({ error: problem }))
      return
    }
  }

  set((s) => ({ uploading: [...s.uploading, file.name], error: null }))
  try {
    const created = await backend.media.upload(projectId, nodeId, file)
    set((s) => ({ media: applyMediaEvent(s.media, { action: 'create', record: created }) }))
    const [, token] = await Promise.all([
      readStorage(projectId, set),
      backend.media.fileToken(),
    ])
    set(() => ({ fileToken: token }))
  } catch (err) {
    set(() => ({ error: extractErrorMessage(err) }))
  } finally {
    // Drop one entry only, so a second upload with the same name keeps its indicator.
    set((s) => {
      const i = s.uploading.indexOf(file.name)
      return { uploading: i === -1 ? s.uploading : s.uploading.filter((_, j) => j !== i) }
    })
  }
}

// Remove and restore change the record (an `update`); delete for good erases it. Each refreshes the
// meter, since the lead's storage only shrinks on the last one.
async function changeProjectMedia(
  m: Media,
  action: 'remove' | 'restore' | 'delete',
  get: () => MediaStoreState,
  rawSet: SetFn,
): Promise<void> {
  const { projectId } = get()
  if (!projectId) return
  const set = forProject(projectId, rawSet)
  try {
    if (action === 'delete') {
      await backend.media.deletePermanently(m.id)
      set((s) => ({ media: applyMediaEvent(s.media, { action: 'delete', record: m }) }))
    } else {
      const record = await backend.media[action](m.id)
      set((s) => ({ media: applyMediaEvent(s.media, { action: 'update', record }) }))
    }
    await readStorage(projectId, set)
  } catch (err) {
    set(() => ({ error: extractErrorMessage(err) }))
  }
}

export const useMediaStore = create<MediaStoreState>((set, get) => ({
  projectId: null,
  media: [],
  storage: null,
  uploading: [],
  error: null,
  fileToken: null,
  setError: (error) => set({ error }),
  refreshFileToken: () => refreshFileToken(get, set),
  open: (projectId) => openProjectMedia(projectId, set),
  close: () => set({ projectId: null, media: [], storage: null, uploading: [], error: null, fileToken: null }),
  upload: (nodeId, file) => uploadProjectMedia(nodeId, file, get, set),
  remove: (m) => changeProjectMedia(m, 'remove', get, set),
  restore: (m) => changeProjectMedia(m, 'restore', get, set),
  deletePermanently: (m) => changeProjectMedia(m, 'delete', get, set),
}))

export function useProjectMedia(projectId: string | null): {
  media: Media[]
  storage: StorageInfo | null
  uploading: string[]
  error: string | null
  fileToken: string | null
  upload(nodeId: string, file: File): Promise<void>
  remove(m: Media): Promise<void>
} {
  const media = useMediaStore((s) => s.media)
  const storage = useMediaStore((s) => s.storage)
  const uploading = useMediaStore((s) => s.uploading)
  const error = useMediaStore((s) => s.error)
  const fileToken = useMediaStore((s) => s.fileToken)
  const upload = useMediaStore((s) => s.upload)
  const remove = useMediaStore((s) => s.remove)

  useEffect(() => {
    if (!projectId) {
      useMediaStore.getState().close()
      return
    }

    const stopLive = keepMediaOpen(() => useMediaStore.getState().open(projectId), appOnline)

    const timer = setInterval(() => {
      void useMediaStore.getState().refreshFileToken()
    }, FILE_TOKEN_REFRESH_MS)

    return () => {
      clearInterval(timer)
      stopLive()
      useMediaStore.getState().close()
    }
  }, [projectId])

  return { media, storage, uploading, error, fileToken, upload, remove }
}
