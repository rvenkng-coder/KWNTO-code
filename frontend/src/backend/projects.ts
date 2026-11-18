import type PocketBase from 'pocketbase'
import type { Project } from './content-types'
import { fromRecord } from './content-mappers'
import { toBackendError } from './errors'

/** The projects of a team (design 5): any member lists and creates them. */
export function createProjects(pb: PocketBase) {
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

    /** The server hook adds the project's settings and its first chapter (plan D6). */
    async create(teamId: string, name: string): Promise<Project> {
      return wrapped(async () => fromRecord('projects', await pb.collection('projects').create({ team: teamId, name })))
    },
  }
}
