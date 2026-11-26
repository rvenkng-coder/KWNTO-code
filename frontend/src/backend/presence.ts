import type PocketBase from 'pocketbase'
import { toBackendError } from './errors'
import { closesQuietly } from './subscriptions'
import type { PresenceEvent, PresenceRow } from './presence-types'

export function toPresence(row: Record<string, unknown>): PresenceRow {
  return {
    id: String(row.id),
    userId: String(row.user),
    userName: String(row.user_name ?? ''),
    nodeId: String(row.node),
    field: String(row.field ?? ''),
  }
}

/** Who is editing what: one short-lived row per person and project, refreshed by a heartbeat. */
export function createPresence(pb: PocketBase) {
  const filterOf = (projectId: string) => pb.filter('project = {:project}', { project: projectId })
  // The caller's own row of the project, or null.
  async function mine(projectId: string): Promise<{ id: string; beat: number } | null> {
    const rows = await pb.collection('presence').getList(1, 1, {
      filter: pb.filter('project = {:project} && user = {:user}', {
        project: projectId,
        user: pb.authStore.record?.id ?? '',
      }),
    })
    const found = rows.items[0]
    return found === undefined ? null : { id: found.id, beat: Number(found.beat) }
  }

  return {
    /** Marks the caller as editing `field` of the node: makes their row, or updates it with `beat + 1`. */
    async set(projectId: string, nodeId: string, field: string): Promise<void> {
      try {
        const row = await mine(projectId)
        if (row === null)
          await pb
            .collection('presence')
            .create({ project: projectId, node: nodeId, user: pb.authStore.record?.id, field, beat: 0 })
        else await pb.collection('presence').update(row.id, { node: nodeId, field, beat: row.beat + 1 })
      } catch (err) {
        throw toBackendError(err)
      }
    },

    /** Removes the caller's row. A row that is already gone is fine. */
    async clear(projectId: string): Promise<void> {
      try {
        const row = await mine(projectId)
        if (row !== null) await pb.collection('presence').delete(row.id)
      } catch (err) {
        const e = toBackendError(err)
        if (e.kind !== 'not-found') throw e
      }
    },

    subscribe(projectId: string, onEvent: (e: PresenceEvent) => void): Promise<() => Promise<void>> {
      return pb
        .collection('presence')
        .subscribe(
          '*',
          (e) => {
            if (e.action === 'create' || e.action === 'update' || e.action === 'delete')
              onEvent({ action: e.action, record: toPresence(e.record) })
          },
          { filter: filterOf(projectId) },
        )
        .then(closesQuietly)
        .catch((err) => {
          throw toBackendError(err)
        })
    },
  }
}
