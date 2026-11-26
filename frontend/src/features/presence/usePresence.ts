import { useEffect } from 'react'
import { create } from 'zustand'
import { useSync } from '../editor/sync/syncStore'
import { backend, type PresenceEvent, type PresenceRow } from '../../backend'

// Who is editing what. The store holds the rows this browser has received and when
// (its own clock); the field the person has focus on is reported by a heartbeat.

export const HEARTBEAT_MS = 10_000
// The clock that decides "fresh" moves every 2 s (the plan says 5 s): with the 30 s timeout a closed tab is then gone within 32 s even when the page could not send its own clean-up (Firefox cancels it).
const TICK_MS = 2_000
const DEFAULT_TIMEOUT_MS = 30_000
const CLEAR_DELAY_MS = 400

interface PresenceState {
  rows: Record<string, PresenceRow>
  seenAt: Record<string, number>
  now: number
  timeoutMs: number
  focus: { nodeId: string; field: string } | null
}

export const usePresenceStore = create<PresenceState>(() => ({
  rows: {},
  seenAt: {},
  now: Date.now(),
  timeoutMs: DEFAULT_TIMEOUT_MS,
  focus: null,
}))

/** Props for an input: while it has focus the person is shown as editing this field. */
export function presenceFocus(nodeId: string, field: string) {
  return {
    onFocus: () => usePresenceStore.setState({ focus: { nodeId, field } }),
    onBlur: () => usePresenceStore.setState({ focus: null }),
  }
}

function receive(e: PresenceEvent): void {
  usePresenceStore.setState((s) => {
    const rows = { ...s.rows }
    const seenAt = { ...s.seenAt }
    if (e.action === 'delete') {
      delete rows[e.record.id]
      delete seenAt[e.record.id]
    } else {
      rows[e.record.id] = e.record
      seenAt[e.record.id] = Date.now()
    }
    return { rows, seenAt }
  })
}

// Follows the project's rows and keeps the clock for "fresh" moving. The subscription is closed
// while the editor is offline, as the project's own is: a stream kept open by presence alone
// changes how the editor reconnects (see useNodeComments).
function useFollowRows(projectId: string): void {
  const online = useSync((s) => s?.online ?? true)
  useEffect(() => {
    if (!online) return
    let cancelled = false
    let close: () => Promise<void> = () => Promise.resolve()
    backend.appSettings
      .get()
      .then((s) => usePresenceStore.setState({ timeoutMs: s.presenceTimeoutSeconds * 1000 }))
      .catch(() => undefined)
    backend.presence
      .subscribe(projectId, receive)
      .then((closer) => {
        if (cancelled) void closer()
        else close = closer
      })
      .catch(() => undefined)
    const tick = setInterval(() => usePresenceStore.setState({ now: Date.now() }), TICK_MS)
    return () => {
      cancelled = true
      clearInterval(tick)
      void close()
      usePresenceStore.setState({ rows: {}, seenAt: {} })
    }
  }, [projectId, online])
}

// Reports the focused field at once and every 10 s; removes the row shortly after focus leaves
// (not at once, so moving from one field to the next does not flicker), when the project closes
// and when the page is hidden. Nothing is sent while the browser is offline.
function useReportFocus(projectId: string): void {
  const nodeId = usePresenceStore((s) => s.focus?.nodeId ?? null)
  const field = usePresenceStore((s) => s.focus?.field ?? null)
  useEffect(() => {
    if (nodeId === null || field === null) return
    const send = () => {
      if (navigator.onLine) void backend.presence.set(projectId, nodeId, field).catch(() => undefined)
    }
    send()
    const beat = setInterval(send, HEARTBEAT_MS)
    return () => {
      clearInterval(beat)
      // Only if focus is still nowhere then: when it moved to another field the new run reports that one.
      setTimeout(() => {
        if (usePresenceStore.getState().focus === null && navigator.onLine)
          void backend.presence.clear(projectId).catch(() => undefined)
      }, CLEAR_DELAY_MS)
    }
  }, [projectId, nodeId, field])
  useEffect(() => {
    const hide = () => void backend.presence.clear(projectId).catch(() => undefined)
    window.addEventListener('pagehide', hide)
    return () => {
      window.removeEventListener('pagehide', hide)
      hide()
      usePresenceStore.setState({ focus: null })
    }
  }, [projectId])
}

/** Starts and stops presence with the project. Used by a leaf component so it re-renders nothing else. */
export function usePresence(projectId: string): void {
  useFollowRows(projectId)
  useReportFocus(projectId)
}
