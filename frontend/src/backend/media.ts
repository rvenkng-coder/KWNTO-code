import type PocketBase from 'pocketbase'
import { toBackendError } from './errors.ts'
import { createFileTokens } from './file-tokens.ts'
import type { Media, MediaEvent, MediaKind, StorageInfo } from './media-types.ts'

const VALID_KINDS: readonly MediaKind[] = ['audio', 'video', 'image']

export function fromMediaRecord(row: Record<string, unknown>): Media {
  const kind = String(row.kind ?? '') as MediaKind
  if (!VALID_KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${row.kind}`)
  }
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project ?? ''),
    nodeId: String(row.node ?? ''),
    uploaderId: String(row.uploader ?? ''),
    title: String(row.title ?? ''),
    kind,
    sizeBytes: Number(row.size_bytes ?? 0),
    fileName: String(row.file ?? ''),
    created: String(row.created ?? ''),
  }
}

export function createMedia(pb: PocketBase) {
  const tokenCache = createFileTokens(() => pb.files.getToken())

  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }

  return {
    async list(projectId: string): Promise<Media[]> {
      return wrapped(async () => {
        const rows = await pb.collection('media').getFullList({
          filter: pb.filter('project = {:project}', { project: projectId }),
          sort: 'created',
        })
        return rows.map((r) => fromMediaRecord(r as unknown as Record<string, unknown>))
      })
    },

    async upload(projectId: string, nodeId: string, file: File): Promise<Media> {
      return wrapped(async () => {
        const userId = pb.authStore.record?.id
        const formData = new FormData()
        formData.append('project', projectId)
        formData.append('node', nodeId)
        if (userId) {
          formData.append('uploader', userId)
        }
        formData.append('file', file)

        const record = await pb.collection('media').create(formData)
        return fromMediaRecord(record as unknown as Record<string, unknown>)
      })
    },

    async remove(id: string): Promise<void> {
      return wrapped(async () => {
        await pb.collection('media').delete(id)
      })
    },

    async storage(): Promise<StorageInfo> {
      return wrapped(async () => {
        return await pb.send<StorageInfo>('/api/kwnto/storage', { method: 'GET' })
      })
    },

    fileUrl(media: Media, token: string, thumb?: '100x100'): string {
      const options = thumb ? { token, thumb } : { token }
      return pb.files.getURL({ id: media.id, collectionName: 'media' }, media.fileName, options)
    },

    async fileToken(): Promise<string> {
      return wrapped(async () => {
        return await tokenCache.get()
      })
    },

    async subscribe(projectId: string, onEvent: (e: MediaEvent) => void): Promise<() => Promise<void>> {
      return wrapped(async () => {
        const filter = pb.filter('project = {:project}', { project: projectId })
        return await pb.collection('media').subscribe(
          '*',
          (e) => {
            if (e.action === 'create' || e.action === 'delete') {
              onEvent({
                action: e.action,
                record: fromMediaRecord(e.record as unknown as Record<string, unknown>),
              })
            }
          },
          { filter },
        )
      })
    },
  }
}
