import type PocketBase from 'pocketbase'
import type { Project } from './content-types'
import { fromRecord } from './content-mappers'
import { createContent } from './content'
import { toBackendError } from './errors'

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
        return rows.map((row) => fromRecord('projects', row))
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

    /** The server hook adds the project's settings and its first chapter (plan D6). */
    async create(teamId: string, name: string): Promise<Project> {
      return wrapped(async () => fromRecord('projects', await pb.collection('projects').create({ team: teamId, name })))
    },
  }
}
