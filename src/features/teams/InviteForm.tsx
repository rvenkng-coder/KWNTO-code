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
    try {
      await backend.teams.invite(teamId, email)
      setSent(true)
      setEmail('')
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to send invite'))
    }
  }

  return (
    <form onSubmit={handleInvite}>
      <h3>Invite</h3>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <button type="submit">Send invite</button>
      {sent && <p>Invite sent!</p>}
      {error && <p data-testid="form-error">{error}</p>}
    </form>
  )
}
