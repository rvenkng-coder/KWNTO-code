import PocketBase from 'pocketbase'
import { createAuth } from './auth'
import { createTeams } from './teams'
import { createPreferences } from './preferences'

export interface Backend {
  health(): Promise<boolean>
  auth: ReturnType<typeof createAuth>
  teams: ReturnType<typeof createTeams>
  preferences: ReturnType<typeof createPreferences>
}

export function createBackend(baseUrl?: string): Backend {
  const pb = new PocketBase(baseUrl ?? '/')
  // The SDK cancels a request when an identical one starts (same method and path).
  // Screens load twice in development (React StrictMode) and could race on purpose,
  // and the cancelled call would surface as "The server cannot be reached".
  pb.autoCancellation(false)
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
    preferences: createPreferences(pb),
  }
}
