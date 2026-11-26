import { useState } from 'react'
import { useSession } from './useSession'

const PASSWORD_RULES = 'At least 10 characters, with a letter and a number. Very common passwords are rejected.'

interface SignUpFormProps {
  onSignIn: () => void
}

export function SignUpForm({ onSignIn }: SignUpFormProps) {
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

  if (signedUp) {
    return (
      <div className="panel flex w-full max-w-sm flex-col gap-2">
        <h2>Sign up</h2>
        <p>Check your email to verify your account, then sign in.</p>
        <button type="button" className="btn-primary" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex w-full max-w-sm flex-col gap-2">
      <h2>Sign up</h2>
      <div>
        <label htmlFor="signup-email">Email</label>
        <input
          className="field"
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
          className="field"
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
          className="field"
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <small>{PASSWORD_RULES}</small>
      </div>
      {error && (
        <p data-testid="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary">
        Sign up
      </button>
    </form>
  )
}
