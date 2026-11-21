// When the sync engine counts as offline (plan 2026-11-20-sharing Task 7, D15). The browser's own
// online flag only changes when the network card does; a stopped server or a dropped live
// connection never flips it, so the top bar kept saying nothing until an edit failed.

export const STREAM_GRACE_MS = 3000

/**
 * Offline when the browser says so, or when the live connection has been down for at least the
 * grace time (`downSinceMs` is when it dropped, null when it has not). A brief reconnect is not offline.
 */
export function isOffline(browserOnline: boolean, streamConnected: boolean, downSinceMs: number | null, nowMs: number): boolean {
  if (!browserOnline) return true
  if (streamConnected || downSinceMs === null) return false
  return nowMs - downSinceMs >= STREAM_GRACE_MS
}
