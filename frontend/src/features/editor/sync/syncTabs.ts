import type { NewEntry, OutboxEntry } from './outbox'
import { planAdd } from './outbox'
import type { OutboxStorage } from './outboxStorage'
import type { PendingConflict, SyncDeps } from './syncEngine'

// Two helpers of the sync engine (kept out of syncEngine.ts for its size): writing one new entry, and what the tab
// that sends tells the tabs that do not (offline sync plan, whole-branch review I4).

/**
 * Plans and writes one new entry, in the tab that sends. It is planned on the cached `queue` and written without a
 * read first: the first storage call is made at once, so a text flushed on `pagehide` reaches IndexedDB before the page
 * goes. The new entry is written before the cancelled ones are removed, so a stop in between loses nothing.
 * `dropped` are the seqs of waiting edits the new one cancelled.
 */
export async function writeEntry(storage: OutboxStorage, queue: OutboxEntry[], locked: number | null, entry: NewEntry): Promise<{ seq: number; dropped: number[] }> {
  const plan = planAdd(queue, entry, locked)
  let seq = 0
  if (plan.replace !== null) {
    await storage.put(plan.replace)
    seq = plan.replace.seq
  } else if (plan.append !== null) {
    seq = await storage.add(plan.append)
  }
  await storage.remove(plan.drop)
  return { seq, dropped: plan.drop }
}

/** What the tab that sends tells the others (whether the server is reachable, whether a conflict waits), and what the others keep of it. */
export class TabLink {
  remoteOnline = true
  remoteConflict: PendingConflict | null = null
  private shared: { online: boolean; conflict: PendingConflict | null } | null = null
  private channel: SyncDeps['channel']

  constructor(channel: SyncDeps['channel']) {
    this.channel = channel
  }

  /** This tab now sends: what another tab said is no longer true, and the others must hear from this one. */
  becameOwner(): void {
    this.remoteOnline = true
    this.remoteConflict = null
    this.shared = null
  }

  /** Called by the tab that sends after every change of its state; posts only what changed unless `force`. */
  share(online: boolean, conflict: PendingConflict | null, force: boolean): void {
    const same = this.shared !== null && this.shared.online === online && this.shared.conflict === conflict
    if (same && !force) return
    this.shared = { online, conflict }
    this.channel.post({ type: 'state', online, conflict })
  }

  take(online: boolean, conflict: PendingConflict | null): void {
    this.remoteOnline = online
    this.remoteConflict = conflict
  }
}
