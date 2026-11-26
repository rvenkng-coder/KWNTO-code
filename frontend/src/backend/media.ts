import type PocketBase from 'pocketbase'
import { toBackendError } from './errors.ts'
import { createFileTokens } from './file-tokens.ts'
import { closesQuietly } from './subscriptions.ts'
import type { Media, MediaEvent, MediaKind, StorageInfo } from './media-types.ts'

const VALID_KINDS: readonly MediaKind[] = ['audio', 'video', 'image']

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function fromMediaRecord(row: Record<string, unknown>): Media {
  const kind = str(row.kind) as MediaKind
  if (!VALID_KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${row.kind}`)
  }
  return {
    id: str(row.id),
    projectId: str(row.project),
    nodeId: str(row.node),
    uploaderId: str(row.uploader),
    title: str(row.title),
    kind,
    sizeBytes: typeof row.size_bytes === 'number' ? row.size_bytes : 0,
    fileName: str(row.file),
    created: str(row.created),
    removedAt: str(row.removed_at),
  }
}

async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw toBackendError(err)
  }
}

function buildUploadFormData(projectId: string, nodeId: string, uploaderId: string | undefined, file: File): FormData {
  const formData = new FormData()
  formData.append('project', projectId)
  formData.append('node', nodeId)
  if (uploaderId) {
    formData.append('uploader', uploaderId)
  }
  formData.append('file', file)
  return formData
}

function subscribeMedia(pb: PocketBase, projectId: string, onEvent: (e: MediaEvent) => void) {
  const filter = pb.filter('project = {:project}', { project: projectId })
  return pb.collection('media').subscribe(
    '*',
    (e) => {
      if (e.action === 'create' || e.action === 'update' || e.action === 'delete') {
        onEvent({
          action: e.action,
          record: fromMediaRecord(e.record as unknown as Record<string, unknown>),
        })
      }
    },
    { filter },
  ).then(closesQuietly)
}

export function createMedia(pb: PocketBase) {
  const tokenCache = createFileTokens(() => pb.files.getToken())

  return {
    list: (projectId: string): Promise<Media[]> =>
      wrapped(async () => {
        const rows = await pb.collection('media').getFullList({
          filter: pb.filter('project = {:project}', { project: projectId }),
          sort: 'created',
        })
        return rows.map((r) => fromMediaRecord(r as unknown as Record<string, unknown>))
      }),

    upload: (projectId: string, nodeId: string, file: File): Promise<Media> =>
      wrapped(async () => {
        const data = buildUploadFormData(projectId, nodeId, pb.authStore.record?.id, file)
        const record = await pb.collection('media').create(data)
        return fromMediaRecord(record as unknown as Record<string, unknown>)
      }),

    // Any member: hides the file; it stays in the lead's storage until the lead deletes it.
    remove: (id: string): Promise<Media> =>
      wrapped(async () => {
        const record = await pb.collection('media').update(id, { removed_at: new Date().toISOString() })
        return fromMediaRecord(record as unknown as Record<string, unknown>)
      }),

    // Team lead only.
    restore: (id: string): Promise<Media> =>
      wrapped(async () => {
        const record = await pb.collection('media').update(id, { removed_at: '' })
        return fromMediaRecord(record as unknown as Record<string, unknown>)
      }),

    // Team lead only: erases the file and frees the space.
    deletePermanently: (id: string): Promise<void> =>
      wrapped(async () => {
        await pb.collection('media').delete(id)
      }),

    // The team lead's storage for the project: what every member's uploads count against.
    storage: (projectId: string): Promise<StorageInfo> =>
      wrapped(() => pb.send<StorageInfo>('/api/kwnto/storage', { method: 'GET', query: { project: projectId } })),

    fileUrl: (media: Media, token: string, thumb?: '100x100'): string => {
      const options = thumb ? { token, thumb } : { token }
      return pb.files.getURL({ id: media.id, collectionName: 'media' }, media.fileName, options)
    },

    fileToken: (): Promise<string> => wrapped(() => tokenCache.get()),

    subscribe: (projectId: string, onEvent: (e: MediaEvent) => void): Promise<() => Promise<void>> =>
      wrapped(() => subscribeMedia(pb, projectId, onEvent)),
  }
}
