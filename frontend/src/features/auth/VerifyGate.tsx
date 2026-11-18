import { useState } from 'react'
import { backend } from '../../backend'

interface VerifyGateProps {
  email: string
}

export function VerifyGate({ email }: VerifyGateProps) {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleResend = async () => {
    setStatus('idle')
    setErrorMessage(null)
    try {
      await backend.auth.requestVerification(email)
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMessage('Failed to resend verification email.')
    }
  }

  return (
    <div>
      <p className="gate text-muted">Verify your email to create or join a team.</p>
      <button type="button" className="link-button" onClick={handleResend}>
        Resend verification email
      </button>
      {status === 'sent' && <p>Sent. Check your inbox.</p>}
      {status === 'error' && (
        <p data-testid="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
