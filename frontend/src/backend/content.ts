import type PocketBase from 'pocketbase'
import type {
  ContentKind,
  ContentRecords,
  CreatableKind,
  EditableFields,
  ProjectContent,
  RemoteEvent,
  RemovableKind,
} from './content-types'
import { fromRecord, toCreateBody, toUpdateBody } from './content-mappers'
import { BackendError, toBackendError } from './errors'
import { guardedSave, type GuardedIO } from './guarded'
import { subscribeProject } from './realtime'

// The one place the editor reaches a project's content. Every update goes through the
// version guard (decision 0002): `update` sends the caller's changed fields with the
// version it last saw and, on a 409, re-reads and retries by itself (guarded.ts).

// PocketBase's largest page; a 5,000-line project loads in 5 requests per collection.
const PAGE = 1000

async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw toBackendError(err)
  }
}

// PocketBase answers a create its rule refuses with 400 and no field errors ("Failed to
// create record"); a real validation error names its fields. Screens see the refusal as one.
function refusedCreate(err: unknown): BackendError {
  const error = toBackendError(err)
  if (error.kind !== 'invalid' || Object.keys(error.fields).length > 0) return error
  return new BackendError('forbidden', error.status, {}, error.message)
}

export interface UpdateOptions<K extends ContentKind> {
  shouldRetry?: (current: ContentRecords[K]) => boolean
}

async function getOrNull<K extends ContentKind>(
  pb: PocketBase,
  kind: K,
  id: string,
): Promise<ContentRecords[K] | null> {
  try {
    return await wrapped(async () => fromRecord(kind, await pb.collection(kind).getOne(id)))
  } catch (err) {
    // PocketBase's 404 carries a message; one without (the door's default) came from a proxy with no route: not "gone".
    if (err instanceof BackendError && err.kind === 'not-found' && err.message !== 'Request failed') return null
    if (err instanceof BackendError && err.kind === 'not-found')
      throw new BackendError('unreachable', 0, {}, 'The server cannot be reached.')
    throw err
  }
}

function updateRecord<K extends ContentKind>(
  pb: PocketBase,
  kind: K,
  id: string,
  edit: { changes: Partial<EditableFields[K]>; baseVersion: number } & UpdateOptions<K>,
): Promise<ContentRecords[K]> {
  const io: GuardedIO<ContentRecords[K]> = {
    read: () => wrapped(async () => fromRecord(kind, await pb.collection(kind).getOne(id))),
    write: (body, version) =>
      wrapped(async () => fromRecord(kind, await pb.collection(kind).update(id, { ...body, version }))),
  }
  return guardedSave(io, toUpdateBody(kind, edit.changes), edit.baseVersion, edit.shouldRetry)
}

export function createContent(pb: PocketBase) {
  function all<K extends ContentKind>(kind: K, projectId: string): Promise<Array<ContentRecords[K]>> {
    const filter = pb.filter('project = {:project}', { project: projectId })
    return pb
      .collection(kind)
      .getFullList({ filter, batch: PAGE })
      .then((rows) => rows.map((row) => fromRecord(kind, row)))
  }

  return {
    /** Everything of the project, trashed records included (the store hides them). */
    async load(projectId: string): Promise<ProjectContent> {
      return wrapped(async () => {
        const settingsFilter = pb.filter('project = {:project}', { project: projectId })
        const [project, settings, chapters, nodes, lines, cues, connections] = await Promise.all([
          pb
            .collection('projects')
            .getOne(projectId)
            .then((row) => fromRecord('projects', row)),
          pb
            .collection('project_settings')
            .getFirstListItem(settingsFilter)
            .then((row) => fromRecord('project_settings', row)),
          all('chapters', projectId),
          all('nodes', projectId),
          all('script_lines', projectId),
          all('cues', projectId),
          all('connections', projectId),
        ])
        return { project, settings, chapters, nodes, lines, cues, connections }
      })
    },

    /** Keeps the client-made id of `record`. */
    async create<K extends CreatableKind>(kind: K, record: ContentRecords[K]): Promise<ContentRecords[K]> {
      try {
        return fromRecord(kind, await pb.collection(kind).create(toCreateBody(kind, record)))
      } catch (err) {
        throw refusedCreate(err)
      }
    },

    /** One record, or null when it does not exist or cannot be seen (404). */
    get: <K extends ContentKind>(kind: K, id: string): Promise<ContentRecords[K] | null> => getOrNull(pb, kind, id),

    /**
     * Sends only `changes`; a 409 is retried up to MAX_SAVE_TRIES times, then rejects with TOO_BUSY.
     * With `shouldRetry`, a 409 whose current record it rejects stops at once with EditConflict.
     */
    update: <K extends ContentKind>(
      kind: K,
      id: string,
      changes: Partial<EditableFields[K]>,
      baseVersion: number,
      options: UpdateOptions<K> = {},
    ): Promise<ContentRecords[K]> => updateRecord(pb, kind, id, { changes, baseVersion, ...options }),

    /** Lines, cues and connections are deleted outright (undo re-creates them). */
    async remove(kind: RemovableKind, id: string): Promise<void> {
      await wrapped(() => pb.collection(kind).delete(id))
    },

    /** Live changes of the project; `onReconnect` fires when the stream comes back. Resolves to a function that closes every subscription. */
    subscribe(
      projectId: string,
      onEvent: (event: RemoteEvent) => void,
      onReconnect?: () => void,
    ): Promise<() => Promise<void>> {
      return subscribeProject(pb, projectId, onEvent, onReconnect)
    },
  }
}
