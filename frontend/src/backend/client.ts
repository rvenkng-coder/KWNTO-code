import PocketBase from 'pocketbase'
import { createAuth } from './auth'
import { createTeams } from './teams'
import { createPreferences } from './preferences'
import { createProjects } from './projects'
import { createContent } from './content'
import { createMedia } from './media'
import { createAppSettings } from './appSettings'
import { createProjectFiles } from './projectFiles'
import { createShares } from './shares'
import { createComments } from './comments'
import { createPresence } from './presence'
import { createRealtime } from './realtime'
import { createLinks } from './links'

export interface Backend {
  health(): Promise<boolean>
  auth: ReturnType<typeof createAuth>
  teams: ReturnType<typeof createTeams>
  preferences: ReturnType<typeof createPreferences>
  projects: ReturnType<typeof createProjects>
  content: ReturnType<typeof createContent>
  media: ReturnType<typeof createMedia>
  appSettings: ReturnType<typeof createAppSettings>
  projectFiles: ReturnType<typeof createProjectFiles>
  shares: ReturnType<typeof createShares>
  comments: ReturnType<typeof createComments>
  presence: ReturnType<typeof createPresence>
  realtime: ReturnType<typeof createRealtime>
  links: ReturnType<typeof createLinks>
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
    projects: createProjects(pb),
    content: createContent(pb),
    media: createMedia(pb),
    appSettings: createAppSettings(pb),
    projectFiles: createProjectFiles(pb),
    shares: createShares(pb),
    comments: createComments(pb),
    presence: createPresence(pb),
    realtime: createRealtime(pb),
    links: createLinks(pb),
  }
}
