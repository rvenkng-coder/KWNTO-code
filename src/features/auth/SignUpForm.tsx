import { useState } from 'react'
import { useSession } from './useSession'

const PASSWORD_RULES =
  'At least 10 characters, with a letter and a number. Very common passwords are rejected.'

export function SignUpForm() {
  const { signUp, error } = useSession()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [signedUp, setSignedUp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await signUp(email, password, name)
    if (ok) setSignedUp(true)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign up</h2>
      <div>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <small>{PASSWORD_RULES}</small>
      </div>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      {signedUp && !error && (
        <p>Check your email for a verification link.</p>
      )}
      <button type="submit">Sign up</button>
    </form>
  )
}
