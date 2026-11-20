import type PocketBase from 'pocketbase'
import { createBackendError, toBackendError } from './errors.ts'

export const MAX_IMPORT_BYTES = 5242880
// The router's copy for an import that is too large; the server answers the same text.
export const IMPORT_TOO_LARGE = 'This file is larger than the 5 MB import limit.'

/** Export and import of a project as a JSON file (design 10). The server builds and checks the file. */
export function createProjectFiles(pb: PocketBase) {
  async function wrapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw toBackendError(err)
    }
  }

  return {
    /** The project's file, indented so a person can read it, under the name the server suggests. */
    async download(projectId: string): Promise<{ name: string; blob: Blob }> {
      let disposition = ''
      // The SDK hides response headers, so the call goes through its own fetch to read one.
      const data = await wrapped(() =>
        pb.send<unknown>(`/api/kwnto/projects/${encodeURIComponent(projectId)}/export`, {
          method: 'GET',
          fetch: async (url, init) => {
            const response = await fetch(url, init)
            disposition = response.headers.get('content-disposition') ?? ''
            return response
          },
        }),
      )
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'project.kwnto.json'
      return { name, blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }
    },

    /** Sends the file's text to the team's import route and returns the new project's id. */
    async importFile(teamId: string, file: File): Promise<string> {
      // Refused here too, so a huge file is never read or sent; the server checks again.
      if (file.size > MAX_IMPORT_BYTES) throw createBackendError('invalid', IMPORT_TOO_LARGE)
      const text = await file.text()
      const reply = await wrapped(() =>
        pb.send<{ projectId: string }>(`/api/kwnto/teams/${encodeURIComponent(teamId)}/import`, { method: 'POST', body: text }),
      )
      return reply.projectId
    },
  }
}
