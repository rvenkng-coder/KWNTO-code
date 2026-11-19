import { useEffect } from 'react'
import { create } from 'zustand'
import { backend } from '../../../backend/index.ts'
import type { Media, StorageInfo } from '../../../backend/media-types.ts'
import { applyMediaEvent } from './mediaList.ts'
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
  setError(err: string | null): void
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

export const useMediaStore = create<MediaStoreState>((set, get) => ({
  projectId: null,
  media: [],
  storage: null,
  uploading: [],
  error: null,
  fileToken: null,

  setError(error) {
    set({ error })
  },

  async open(projectId: string) {
    set({ projectId, error: null })
    try {
      const [mediaList, storageInfo, token] = await Promise.all([
        backend.media.list(projectId),
        backend.media.storage(),
        backend.media.fileToken(),
      ])
      set({ media: mediaList, storage: storageInfo, fileToken: token })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }

    const unsub = await backend.media.subscribe(projectId, async (event) => {
      set((s) => ({ media: applyMediaEvent(s.media, event) }))
      try {
        const storageInfo = await backend.media.storage()
        set({ storage: storageInfo })
      } catch {
        // storage refresh failure does not block live events
      }
    })

    return unsub
  },

  close() {
    set({ projectId: null, media: [], storage: null, uploading: [], error: null, fileToken: null })
  },

  async upload(nodeId: string, file: File) {
    const { storage, projectId } = get()
    if (!projectId) return

    if (storage) {
      const problem = earlyProblem({ name: file.name, size: file.size }, storage)
      if (problem) {
        set({ error: problem })
        return
      }
    }

    set((s) => ({
      uploading: [...s.uploading, file.name],
      error: null,
    }))

    try {
      const created = await backend.media.upload(projectId, nodeId, file)
      set((s) => ({ media: applyMediaEvent(s.media, { action: 'create', record: created }) }))
      const [storageInfo, token] = await Promise.all([
        backend.media.storage(),
        backend.media.fileToken(),
      ])
      set({ storage: storageInfo, fileToken: token })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    } finally {
      set((s) => ({ uploading: s.uploading.filter((name) => name !== file.name) }))
    }
  },

  async remove(m: Media) {
    try {
      await backend.media.remove(m.id)
      set((s) => ({ media: applyMediaEvent(s.media, { action: 'delete', record: m }) }))
      const storageInfo = await backend.media.storage()
      set({ storage: storageInfo })
    } catch (err) {
      set({ error: extractErrorMessage(err) })
    }
  },
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

    let unsub: (() => void) | undefined
    let cancelled = false

    void useMediaStore.getState().open(projectId).then((u) => {
      if (cancelled) {
        u()
      } else {
        unsub = u
      }
    })

    return () => {
      cancelled = true
      if (unsub) unsub()
      useMediaStore.getState().close()
    }
  }, [projectId])

  return { media, storage, uploading, error, fileToken, upload, remove }
}
