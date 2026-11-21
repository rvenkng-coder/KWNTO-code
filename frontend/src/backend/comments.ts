import type PocketBase from 'pocketbase'
import type { Comment, CommentEvent } from './comment-types'
import { toBackendError } from './errors'

export function toComment(row: Record<string, unknown>): Comment {
  const author = String(row.author ?? '')
  return {
    id: String(row.id), projectId: String(row.project), nodeId: String(row.node), authorId: author === '' ? null : author,
    authorName: String(row.author_name ?? ''), body: String(row.body), created: String(row.created),
  }
}

/** Comments of a project: members and holders of comment and edit links read and write them. */
export function createComments(pb: PocketBase) {
  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }
  const filterOf = (projectId: string) => pb.filter('project = {:project}', { project: projectId })

  return {
    /** Oldest first. */
    list: (projectId: string): Promise<Comment[]> =>
      wrapped(async () => (await pb.collection('comments').getFullList({ filter: filterOf(projectId), sort: 'created,id' })).map(toComment)),

    create: (projectId: string, nodeId: string, body: string): Promise<Comment> =>
      wrapped(async () => toComment(await pb.collection('comments').create({ project: projectId, node: nodeId, author: pb.authStore.record?.id, body }))),

    remove: (id: string): Promise<void> => wrapped(async () => {
      await pb.collection('comments').delete(id)
    }),

    subscribe: (projectId: string, onEvent: (e: CommentEvent) => void): Promise<() => Promise<void>> =>
      wrapped(() => pb.collection('comments').subscribe('*', (e) => {
        if (e.action === 'create' || e.action === 'delete') onEvent({ action: e.action, record: toComment(e.record) })
      }, { filter: filterOf(projectId) })),
  }
}
