import { useNodeComments } from './useNodeComments'

/**
 * Loads the project's comments while it is on screen and draws nothing. A component of its own,
 * so the sync status it follows re-renders only this, not the whole editor.
 */
export function CommentsLoader({ projectId, teamId }: { projectId: string; teamId: string }) {
  useNodeComments(projectId, teamId)
  return null
}
