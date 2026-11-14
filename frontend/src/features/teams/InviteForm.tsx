import { useState } from 'react'
import { backend } from '../../backend'
import { errorMessage } from '../errorMessage'

interface InviteFormProps {
  teamId: string
}

export function InviteForm({ teamId }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(false)
    try {
      await backend.teams.invite(teamId, email)
      setSent(true)
      setEmail('')
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to send invite'))
    }
  }

  return (
    <form onSubmit={handleInvite} className="flex max-w-sm w-full flex-col gap-2">
      <h3>Invite</h3>
      <input
        className="field"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Invitee email"
      />
      <button type="submit" className="btn">Send invite</button>
      {sent && <p>Invite sent!</p>}
      {error && <p data-testid="form-error" role="alert">{error}</p>}
    </form>
  )
}
