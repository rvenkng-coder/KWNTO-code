import { usePresence } from './usePresence'

/** Follows and reports presence while the project is on screen; draws nothing. */
export function PresenceLoader({ projectId }: { projectId: string }) {
  usePresence(projectId)
  return null
}
