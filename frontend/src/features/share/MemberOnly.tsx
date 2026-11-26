import { useEffect, useState, type ReactNode } from 'react'
import { backend } from '../../backend'

/**
 * Shows its children to members of the project's team only. A person working through an edit
 * link is not a member: the server refuses export and share links to them, so the controls are
 * not offered. While the answer is unknown nothing is shown.
 */
export function MemberOnly({ teamId, children }: { teamId: string; children: ReactNode }) {
  const [member, setMember] = useState(false)
  useEffect(() => {
    let cancelled = false
    backend.teams
      .list()
      .then((teams) => {
        if (!cancelled) setMember(teams.some((t) => t.id === teamId))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [teamId])
  return member ? <>{children}</> : null
}
