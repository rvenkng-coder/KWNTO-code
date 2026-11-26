import type PocketBase from 'pocketbase'
import type { Project } from './content-types'
import { fromRecord } from './content-mappers'
import { createContent } from './content'
import { toBackendError } from './errors'
import type { ProjectPreview } from './types'

/** The projects of a team (design 5): any member lists and creates them. */
export function createProjects(pb: PocketBase) {
  const content = createContent(pb)
  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }

  return {
    /** Not trashed, most recently updated first. */
    async list(teamId: string): Promise<Project[]> {
      return wrapped(async () => {
        const rows = await pb.collection('projects').getFullList({
          filter: pb.filter("team = {:team} && deleted_at = ''", { team: teamId }),
          sort: '-updated',
        })
        return rows.map((row) => ({ ...fromRecord('projects', row), updated: String(row.updated ?? '') }))
      })
    },

    /** In the trash, newest first (the screen shows them to the owner only; the rules decide). */
    async listTrashed(teamId: string): Promise<Project[]> {
      return wrapped(async () => {
        const rows = await pb.collection('projects').getFullList({
          filter: pb.filter("team = {:team} && deleted_at != ''", { team: teamId }),
          sort: '-deleted_at',
        })
        return rows.map((row) => fromRecord('projects', row))
      })
    },

    /** Brings a project back from the trash: an ordinary guarded edit (only the owner's is accepted). */
    async restore(project: Project): Promise<Project> {
      return content.update('projects', project.id, { deleted: false }, project.version)
    },

    /** Counts and the node boxes of the first chapter (at most 80), for the project card's picture. */
    async preview(projectId: string): Promise<ProjectPreview> {
      return wrapped(async () => {
        const live = pb.filter("project = {:p} && deleted_at = ''", { p: projectId })
        const chapters = await pb.collection('chapters').getList(1, 1, { filter: live, sort: 'position' })
        const all = await pb.collection('nodes').getList(1, 1, { filter: live })
        const first = chapters.items[0]
        const rows =
          first === undefined
            ? []
            : (
                await pb.collection('nodes').getList(1, 80, {
                  filter: pb.filter("project = {:p} && chapter = {:c} && deleted_at = ''", {
                    p: projectId,
                    c: first.id,
                  }),
                })
              ).items
        const nodes = rows
          .map((row) => fromRecord('nodes', row))
          .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }))
        return { chapterCount: chapters.totalItems, nodeCount: all.totalItems, nodes }
      })
    },

    /** The server hook adds the project's settings and its first chapter (plan D6). */
    async create(teamId: string, name: string): Promise<Project> {
      return wrapped(async () => fromRecord('projects', await pb.collection('projects').create({ team: teamId, name })))
    },
  }
}
