import PocketBase from 'pocketbase'
import { createAuth } from './auth'
import { createTeams } from './teams'

export interface Backend {
  health(): Promise<boolean>
  auth: ReturnType<typeof createAuth>
  teams: ReturnType<typeof createTeams>
}

export function createBackend(baseUrl?: string): Backend {
  const pb = new PocketBase(baseUrl ?? '/')
  return {
    async health(): Promise<boolean> {
      try {
        await pb.health.check()
        return true
      } catch {
        return false
      }
    },
    auth: createAuth(pb),
    teams: createTeams(pb),
  }
}
