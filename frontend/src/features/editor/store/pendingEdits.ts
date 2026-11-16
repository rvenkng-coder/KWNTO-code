// Text typed in the panel waits here before it is saved (plan Global Constraints, "Saving per
// attribute"): a save runs 800 ms after the last keystroke, on blur, or when the person moves on
// (another node, chapter or project, or leaving the page). Keys are `${kind}:${id}:${field}`.

export const TEXT_SAVE_DELAY_MS = 800

export interface PendingEdits {
  set(key: string, save: () => void): void
  flush(key: string): void
  flushAll(): void
  size(): number
}

export function createPendingEdits(schedule: (fn: () => void, ms: number) => unknown, cancel: (handle: unknown) => void): PendingEdits {
  const pending = new Map<string, { save: () => void; handle: unknown }>()

  function flush(key: string): void {
    const entry = pending.get(key)
    if (entry === undefined) return
    pending.delete(key)
    cancel(entry.handle)
    entry.save()
  }

  return {
    set(key, save) {
      const existing = pending.get(key)
      if (existing) cancel(existing.handle)
      const handle = schedule(() => flush(key), TEXT_SAVE_DELAY_MS)
      pending.set(key, { save, handle })
    },
    flush,
    flushAll() {
      for (const key of [...pending.keys()]) flush(key)
    },
    size: () => pending.size,
  }
}

export function shouldWarnOnLeave(pending: number, saving: number): boolean {
  return pending > 0 || saving > 0
}

/** The app's one instance, on the browser's timers. */
export const pendingEdits = createPendingEdits((fn, ms) => setTimeout(fn, ms), (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
