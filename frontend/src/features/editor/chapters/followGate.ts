// Whether a screen change that waits for a save is still wanted when the save ends.

export interface FollowGate {
  /** The person chose where to be, even if it is where they already are. */
  moved(): void
  /** Call when the wait starts; the answer says whether to still go there: false after `moved`, a newer claim or another route. */
  claim(): () => boolean
}

export function createFollowGate(whereNow: () => string): FollowGate {
  let latest = 0
  return {
    moved: () => void (latest += 1),
    claim() {
      const mine = (latest += 1)
      const from = whereNow()
      return () => mine === latest && whereNow() === from
    },
  }
}
