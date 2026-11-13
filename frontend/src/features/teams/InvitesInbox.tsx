import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import type { Invite } from '../../backend/types'
import { errorMessage } from '../errorMessage'

interface InvitesInboxProps {
  onAccepted?: () => void
}

export function InvitesInbox({ onAccepted }: InvitesInboxProps) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState<string | null>(null)

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
    <div data-testid="invite-inbox">
      <h3>Invites</h3>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      <ul>
        {invites.map((invite) => (
          <li key={invite.id}>
            {invite.teamName} (invited by {invite.invitedByName})
            <button onClick={() => handleAccept(invite.id)}>Accept</button>
            <button onClick={() => handleDecline(invite.id)}>Decline</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
