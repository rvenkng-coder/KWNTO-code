import { useState } from 'react'
import { backend } from '../../backend'
import { BackendError } from '../../backend/errors'

export const RESET_SUCCESS = 'Your password was changed. Sign in with the new password.'
export const RESET_FAILURE = 'This reset link is not valid or has expired. Ask for a new one from the sign-in screen.'
export const MISMATCH = 'The two passwords are not the same.'

type Outcome = { kind: 'form'; message: string | null } | { kind: 'done' } | { kind: 'failed' }

// A refusal about the password (its rules) stays on the form; a refusal about the token is a dead link.
function toOutcome(err: unknown): Outcome {
  if (err instanceof BackendError && err.kind === 'invalid' && err.fields.token === undefined) {
    const message = err.fields.password ?? err.fields.passwordConfirm ?? err.message
    return { kind: 'form', message }
  }
  return { kind: 'failed' }
}

/** The page a reset mail links to (`#/reset/<token>`): sets a new password through the door. */
export function ResetPasswordScreen({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'form', message: null })
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== repeat) {
      setOutcome({ kind: 'form', message: MISMATCH })
      return
    }
    setBusy(true)
    try {
      await backend.auth.confirmPasswordReset(token, password, repeat)
      setOutcome({ kind: 'done' })
    } catch (err) {
      setOutcome(toOutcome(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold">KWNTO</h1>
      {outcome.kind === 'form' && (
        <form onSubmit={submit} className="panel flex flex-col gap-2">
          <h2>Set a new password</h2>
          <div>
            <label htmlFor="reset-password">New password</label>
            <input className="field" id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="reset-repeat">Repeat new password</label>
            <input className="field" id="reset-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          </div>
          {outcome.message !== null && <p role="alert">{outcome.message}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>Set password</button>
        </form>
      )}
      {outcome.kind === 'done' && <p role="status">{RESET_SUCCESS}</p>}
      {outcome.kind === 'failed' && <p role="alert">{RESET_FAILURE}</p>}
      {outcome.kind !== 'form' && <a href="#/">Go to KWNTO</a>}
    </div>
  )
}
