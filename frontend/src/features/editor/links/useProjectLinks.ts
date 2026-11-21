import { useEffect } from 'react'
import { create } from 'zustand'
import { backend } from '../../../backend/index.ts'
import type { LinkEvent, NodeLink } from '../../../backend/link-types.ts'
import { keepMediaOpen, type OnlinePort } from '../media/keepMediaOpen.ts'
import { currentSnapshot, subscribeSnapshot } from '../sync/syncStore'
import { checkLinkUrl } from './linkCheck.ts'
import { applyLinkEvent } from './linksList.ts'

interface LinksStoreState {
  projectId: string | null
  links: NodeLink[]
  error: string | null
  open(projectId: string): Promise<() => void>
  close(): void
  add(nodeId: string, title: string, url: string): Promise<boolean>
  remove(link: NodeLink): Promise<void>
  setError(err: string | null): void
}

type SetFn = (fn: (s: LinksStoreState) => Partial<LinksStoreState>) => void

// Writes for one project only land while that project is still the open one,
// so a response that arrives after a switch is dropped.
function forProject(projectId: string, set: SetFn): SetFn {
  return (fn) => set((s) => (s.projectId === projectId ? fn(s) : {}))
}

function messageOf(err: unknown): string {
  const e = err as { kind?: string; fields?: Record<string, string>; message?: string } | null
  if (e?.kind === 'unreachable') return 'Links need a connection. Try again when you are back online.'
  return e?.fields?.url ?? e?.message ?? String(err)
}

// The editor's connection state: the sync engine of whoever is signed in.
const appOnline: OnlinePort = {
  online: () => currentSnapshot()?.online ?? true,
  subscribe: (fn) => subscribeSnapshot(fn),
}

async function openProjectLinks(projectId: string, rawSet: SetFn): Promise<() => void> {
  rawSet(() => ({ projectId, error: null }))
  const set = forProject(projectId, rawSet)

  // Subscribe first so nothing between the list fetch and the subscription is lost;
  // events that arrive before the list is loaded are replayed over it.
  let loaded = false
  const early: LinkEvent[] = []
  let unsubscribe: () => void = () => {}
  try {
    unsubscribe = await backend.links.subscribe(projectId, (event) => {
      if (!loaded) early.push(event)
      else set((s) => ({ links: applyLinkEvent(s.links, event) }))
    })
  } catch (err) {
    set(() => ({ error: messageOf(err) }))
  }

  try {
    const list = await backend.links.list(projectId)
    set(() => ({ links: early.reduce(applyLinkEvent, list) }))
  } catch (err) {
    set(() => ({ error: messageOf(err) }))
  }
  loaded = true
  return unsubscribe
}

// The most characters a link title can have (the same limit as the node_links collection).
export const TITLE_MAX = 120

// Adds in flight, so a double click or a double Enter sends one request, not two.
const adding = new Set<string>()

async function addProjectLink(
  nodeId: string,
  title: string,
  url: string,
  get: () => LinksStoreState,
  rawSet: SetFn,
): Promise<boolean> {
  const { projectId } = get()
  if (!projectId) return false
  const set = forProject(projectId, rawSet)
  const check = checkLinkUrl(url)
  if (!check.ok) {
    set(() => ({ error: check.message }))
    return false
  }
  if (title.trim().length > TITLE_MAX) {
    set(() => ({ error: `The title is longer than ${TITLE_MAX} characters.` }))
    return false
  }
  const key = [projectId, nodeId, title.trim(), check.url].join('\n')
  if (adding.has(key)) return false
  adding.add(key)
  try {
    const created = await backend.links.add(projectId, nodeId, title.trim(), check.url)
    set((s) => ({ links: applyLinkEvent(s.links, { action: 'create', record: created }), error: null }))
    return true
  } catch (err) {
    set(() => ({ error: messageOf(err) }))
    return false
  } finally {
    adding.delete(key)
  }
}

async function removeProjectLink(link: NodeLink, get: () => LinksStoreState, rawSet: SetFn): Promise<void> {
  const { projectId } = get()
  if (!projectId) return
  const set = forProject(projectId, rawSet)
  try {
    await backend.links.remove(link.id)
    set((s) => ({ links: applyLinkEvent(s.links, { action: 'delete', record: link }) }))
  } catch (err) {
    set(() => ({ error: messageOf(err) }))
  }
}

export const useLinksStore = create<LinksStoreState>((set, get) => ({
  projectId: null,
  links: [],
  error: null,
  setError: (error) => set({ error }),
  open: (projectId) => openProjectLinks(projectId, set),
  close: () => set({ projectId: null, links: [], error: null }),
  add: (nodeId, title, url) => addProjectLink(nodeId, title, url, get, set),
  remove: (link) => removeProjectLink(link, get, set),
}))

// Keeps the project's links loaded and live while the editor is open, like useProjectMedia.
export function useProjectLinks(projectId: string | null): void {
  useEffect(() => {
    if (!projectId) {
      useLinksStore.getState().close()
      return
    }
    const stop = keepMediaOpen(() => useLinksStore.getState().open(projectId), appOnline)
    return () => {
      stop()
      useLinksStore.getState().close()
    }
  }, [projectId])
}
