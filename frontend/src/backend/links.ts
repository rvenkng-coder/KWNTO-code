import type PocketBase from 'pocketbase'
import { toBackendError } from './errors.ts'
import type { LinkEvent, NodeLink } from './link-types.ts'

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function fromLinkRecord(row: Record<string, unknown>): NodeLink {
  return {
    id: str(row.id),
    projectId: str(row.project),
    nodeId: str(row.node),
    creatorId: str(row.creator),
    title: str(row.title),
    url: str(row.url),
    created: str(row.created),
  }
}

async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw toBackendError(err)
  }
}

export function createLinks(pb: PocketBase) {
  return {
    list: (projectId: string): Promise<NodeLink[]> =>
      wrapped(async () => {
        const rows = await pb.collection('node_links').getFullList({
          filter: pb.filter('project = {:project}', { project: projectId }),
          sort: 'created',
        })
        return rows.map((r) => fromLinkRecord(r as unknown as Record<string, unknown>))
      }),

    add: (projectId: string, nodeId: string, title: string, url: string): Promise<NodeLink> =>
      wrapped(async () => {
        const record = await pb.collection('node_links').create({
          project: projectId,
          node: nodeId,
          creator: pb.authStore.record?.id,
          title,
          url,
        })
        return fromLinkRecord(record as unknown as Record<string, unknown>)
      }),

    // Any member of the project's team.
    remove: (id: string): Promise<void> =>
      wrapped(async () => {
        await pb.collection('node_links').delete(id)
      }),

    subscribe: (projectId: string, onEvent: (e: LinkEvent) => void): Promise<() => Promise<void>> =>
      wrapped(() =>
        pb.collection('node_links').subscribe(
          '*',
          (e) => {
            if (e.action === 'create' || e.action === 'delete') {
              onEvent({ action: e.action, record: fromLinkRecord(e.record as unknown as Record<string, unknown>) })
            }
          },
          { filter: pb.filter('project = {:project}', { project: projectId }) },
        ),
      ),
  }
}
