import { useRef, useState } from 'react'
import { useSession } from './useSession'

const PASSWORD_RULES =
  'At least 10 characters, with a letter and a number. Very common passwords are rejected.'

interface SignUpFormProps {
  onSignIn: () => void
}

export function SignUpForm({ onSignIn }: SignUpFormProps) {
  const { signUp, error } = useSession()
  const [signedUp, setSignedUp] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current!
    const ok = await signUp(
      (form.elements.namedItem('email') as HTMLInputElement).value,
      (form.elements.namedItem('password') as HTMLInputElement).value,
      (form.elements.namedItem('name') as HTMLInputElement).value,
    )
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
    <form ref={formRef} onSubmit={handleSubmit} className="panel flex w-full max-w-sm flex-col gap-2">
      <h2>Sign up</h2>
      <div>
        <label htmlFor="signup-email">Email</label>
        <input
          className="field"
          id="signup-email"
          type="email"
          name="email"
          required
        />
      </div>
      <div>
        <label htmlFor="signup-name">Name</label>
        <input
          className="field"
          id="signup-name"
          type="text"
          name="name"
          required
        />
      </div>
      <div>
        <label htmlFor="signup-password">Password</label>
        <input
          className="field"
          id="signup-password"
          type="password"
          name="password"
          required
        />
        <small>{PASSWORD_RULES}</small>
      </div>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary">Sign up</button>
    </form>
  )
}
