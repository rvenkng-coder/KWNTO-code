import { useEffect } from 'react'
import { create } from 'zustand'
import { backend, type Comment, type CommentEvent } from '../../backend'
import { errorMessage } from '../errorMessage'
import { applyCommentEvent } from './commentList'

interface CommentState {
  projectId: string | null
  comments: Comment[]
  /** Comments per node, kept beside the list so a card reads its own count cheaply. */
  counts: Record<string, number>
  isOwner: boolean
  error: string | null
  add(nodeId: string, body: string): Promise<boolean>
  remove(id: string): Promise<void>
  clearError(): void
}

function countsOf(list: Comment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of list) counts[c.nodeId] = (counts[c.nodeId] ?? 0) + 1
  return counts
}

const withList = (comments: Comment[]) => ({ comments, counts: countsOf(comments) })

export const useCommentStore = create<CommentState>((set, get) => ({
  projectId: null,
  comments: [],
  counts: {},
  isOwner: false,
  error: null,
  async add(nodeId, body) {
    const projectId = get().projectId
    if (projectId === null) return false
    try {
      const made = await backend.comments.create(projectId, nodeId, body)
      set((s) => ({ ...withList(applyCommentEvent(s.comments, { action: 'create', record: made })), error: null }))
      return true
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Could not add the comment.') })
      return false
    }
  },
  async remove(id) {
    try {
      await backend.comments.remove(id)
      set((s) => ({ ...withList(s.comments.filter((c) => c.id !== id)), error: null }))
    } catch (err: unknown) {
      set({ error: errorMessage(err, 'Could not delete the comment.') })
    }
  },
  clearError() {
    set({ error: null })
  },
}))

async function isOwnerOf(teamId: string): Promise<boolean> {
  if (teamId === '') return false
  try {
    return (await backend.teams.list()).some((t) => t.id === teamId && t.isOwner)
  } catch {
    return false
  }
}

// Subscribes first, then lists, and replays what arrived in between over the list (as the media store does).
async function openComments(projectId: string, teamId: string, isCurrent: () => boolean): Promise<() => void> {
  useCommentStore.setState({ projectId, ...withList([]), error: null, isOwner: false })
  let loaded = false
  const early: CommentEvent[] = []
  const onEvent = (e: CommentEvent) => {
    if (!isCurrent()) return
    if (!loaded) early.push(e)
    else useCommentStore.setState((s) => withList(applyCommentEvent(s.comments, e)))
  }
  let close: () => Promise<void> = () => Promise.resolve()
  try {
    close = await backend.comments.subscribe(projectId, onEvent)
    const [list, owner] = await Promise.all([backend.comments.list(projectId), isOwnerOf(teamId)])
    if (isCurrent()) useCommentStore.setState({ ...withList(early.reduce(applyCommentEvent, list)), isOwner: owner })
  } catch (err: unknown) {
    if (isCurrent()) useCommentStore.setState({ error: errorMessage(err, 'Could not load the comments.') })
  }
  loaded = true
  return () => void close()
}

/** Loads and follows a project's comments while the screen is shown. `teamId` is '' for a link holder (never the owner). */
export function useNodeComments(projectId: string | null, teamId: string): void {
  useEffect(() => {
    if (projectId === null) return
    let current = true
    const closing = openComments(projectId, teamId, () => current)
    return () => {
      current = false
      void closing.then((close) => close())
      useCommentStore.setState({ projectId: null, ...withList([]), error: null })
    }
  }, [projectId, teamId])
}
