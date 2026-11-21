import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import type { Invite } from '../../backend/types'
import { errorMessage } from '../errorMessage'
import { useSession } from '../auth/useSession'

interface InvitesInboxProps {
  onAccepted?: () => void
}

export function InvitesInbox({ onAccepted }: InvitesInboxProps) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState<string | null>(null)
  const { user } = useSession()

  useEffect(() => {
    async function load() {
      try {
        const invitesList = await backend.teams.invites()
        setInvites(invitesList)
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load invites'))
      }
    }
    load()
  }, [])

  const handleAccept = async (inviteId: string) => {
    try {
      await backend.teams.acceptInvite(inviteId)
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      onAccepted?.()
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to accept invite'))
    }
  }

  const handleDecline = async (inviteId: string) => {
    try {
      await backend.teams.declineInvite(inviteId)
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to decline invite'))
    }
  }

  if (invites.length === 0) {
    return error ? <p data-testid="form-error" role="alert">{error}</p> : null
  }

  return (
    <div data-testid="invite-inbox" className="panel flex flex-col gap-2">
      <h3 className="section-label">Invitations</h3>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      <ul className="flex flex-col gap-1">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center gap-2">
            {invite.teamName} (invited by {invite.invitedByName})
            <button className="btn-primary" onClick={() => handleAccept(invite.id)} disabled={!user?.verified}>Accept</button>
            <button className="btn" onClick={() => handleDecline(invite.id)}>Decline</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
