import { useState } from 'react'
import { useSession } from './useSession'
import { backend } from '../../backend'

export function SignInForm() {
  const { signIn, error } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await signIn(email, password)
  }

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await backend.auth.requestPasswordReset(email)
      setResetSent(true)
    } catch {
      // Neutral message regardless of whether the email exists
      setResetSent(true)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <div>
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p data-testid="form-error">{error}</p>}
      {resetSent && (
        <p className="neutral">If that account exists, we sent a link.</p>
      )}
      <a href="#" onClick={handleForgotPassword}>
        Forgot password?
      </a>
      <button type="submit">Sign in</button>
    </form>
  )
}
